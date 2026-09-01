import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { User, Users } from "lucide-react";
import { useGetCandidates, getGetCandidatesQueryKey } from "@workspace/api-client-react";
import type { Candidate } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import type { DataTableColumn } from "@/components/ui/data-table";

function initials(name: string | null | undefined) {
  return (name ?? "?")
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function CandidatesPage() {
  const [, setLocation] = useLocation();
  const candidatesQuery = useGetCandidates({ query: { queryKey: getGetCandidatesQueryKey() } });
  const candidates = Array.isArray(candidatesQuery.data) ? candidatesQuery.data : [];

  const columns: DataTableColumn<Candidate>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Candidate",
        sortable: true,
        sortValue: (c) => c.name ?? "",
        exportValue: (c) => c.name ?? "—",
        render: (c) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {initials(c.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate" data-testid={`text-candidate-name-${c.id}`}>
                {c.name ?? "Unnamed Candidate"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{c.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "email",
        label: "Email Address",
        sortable: true,
        sortValue: (c) => c.email ?? "",
        exportValue: (c) => c.email ?? "",
        render: (c) => <span className="text-sm font-mono text-muted-foreground">{c.email}</span>,
      },
      {
        key: "phone",
        label: "Phone",
        sortable: true,
        sortValue: (c) => c.phone ?? "",
        exportValue: (c) => c.phone ?? "—",
        render: (c) => <span className="text-sm text-muted-foreground">{c.phone || "—"}</span>,
      },
      {
        key: "skills",
        label: "Key Skills",
        sortable: false,
        exportValue: (c) => {
          const parsed = c.parsedData as Record<string, unknown> | null;
          const skills = parsed?.skills as string[] | undefined;
          return skills?.join(", ") ?? "—";
        },
        render: (c) => {
          const parsed = c.parsedData as Record<string, unknown> | null;
          const skills = parsed?.skills as string[] | undefined;
          if (!skills || skills.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex gap-1 flex-wrap max-w-xs">
              {skills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[11px] px-1.5 py-0">
                  {skill}
                </Badge>
              ))}
              {skills.length > 3 && (
                <span className="text-[10px] text-muted-foreground self-center">+{skills.length - 3}</span>
              )}
            </div>
          );
        },
      },
      {
        key: "createdAt",
        label: "Registered Date",
        sortable: true,
        sortValue: (c) => c.createdAt ?? "",
        exportValue: (c) => (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"),
        render: (c) => (
          <span className="text-xs text-muted-foreground">
            {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        resizable: false,
        render: (c) => (
          <div className="flex items-center gap-2 print:hidden">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/candidates/${c.id}`);
              }}
              asChild
            >
              <Link href={`/candidates/${c.id}`}>View Profile</Link>
            </Button>
          </div>
        ),
      },
    ],
    [setLocation],
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-candidates">
              <Users className="w-6 h-6 text-primary" />
              Candidate Talent Pool
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registered job applicants, parsed CV profiles, and applicant qualification records
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={candidates}
          getRowId={(c) => c.id}
          searchPlaceholder="Search candidates by name, email, or skill..."
          getSearchText={(c) => {
            const parsed = c.parsedData as Record<string, unknown> | null;
            const skills = (parsed?.skills as string[] | undefined)?.join(" ") ?? "";
            return `${c.name ?? ""} ${c.email} ${c.phone ?? ""} ${skills}`;
          }}
          exportFilename={`nisit-candidates-${new Date().toISOString().slice(0, 10)}`}
          isLoading={candidatesQuery.isLoading}
        />
      </div>
    </AppLayout>
  );
}
