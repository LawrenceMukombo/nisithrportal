import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, wikiArticlesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const body = (raw: any) => ({ title: String(raw.title ?? "").trim().slice(0, 200), slug: slugify(String(raw.slug || raw.title || "")).slice(0, 200), summary: String(raw.summary ?? "").trim().slice(0, 500), category: String(raw.category ?? "General").trim().slice(0, 100), content: String(raw.content ?? "").slice(0, 100000), attachments: Array.isArray(raw.attachments) ? raw.attachments.filter((item: any) => item?.name && item?.url && String(item.url).length <= 2_800_000).slice(0, 12).map((item: any) => ({ name: String(item.name).slice(0, 255), url: String(item.url), type: item.type === "image" ? "image" : "file" })) : [], published: Boolean(raw.published) });

router.get("/wiki/articles", authMiddleware, async (req, res): Promise<void> => {
  const query = String(req.query.q ?? "").trim();
  const isAdmin = req.user?.roleName === "admin";
  const clauses = isAdmin ? [] : [eq(wikiArticlesTable.published, true)];
  if (query) clauses.push(or(ilike(wikiArticlesTable.title, `%${query}%`), ilike(wikiArticlesTable.summary, `%${query}%`), ilike(wikiArticlesTable.category, `%${query}%`))!);
  res.json(await db.select().from(wikiArticlesTable).where(clauses.length ? and(...clauses) : undefined).orderBy(desc(wikiArticlesTable.updatedAt)));
});
router.get("/wiki/articles/:id", authMiddleware, async (req, res): Promise<void> => {
  const [article] = await db.select().from(wikiArticlesTable).where(eq(wikiArticlesTable.id, Number(req.params.id)));
  if (!article || (!article.published && req.user?.roleName !== "admin")) { res.status(404).json({ error: "Article not found" }); return; }
  res.json(article);
});
router.post("/wiki/articles", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const data = body(req.body); if (!data.title || !data.slug) { res.status(400).json({ error: "Title is required" }); return; }
  const [created] = await db.insert(wikiArticlesTable).values({ ...data, createdByUserId: req.user!.userId, updatedByUserId: req.user!.userId }).returning(); res.status(201).json(created);
});
router.patch("/wiki/articles/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const data = body(req.body); if (!data.title || !data.slug) { res.status(400).json({ error: "Title is required" }); return; }
  const [updated] = await db.update(wikiArticlesTable).set({ ...data, updatedByUserId: req.user!.userId }).where(eq(wikiArticlesTable.id, Number(req.params.id))).returning(); if (!updated) { res.status(404).json({ error: "Article not found" }); return; } res.json(updated);
});
router.delete("/wiki/articles/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => { await db.delete(wikiArticlesTable).where(eq(wikiArticlesTable.id, Number(req.params.id))); res.json({ success: true }); });
export default router;
