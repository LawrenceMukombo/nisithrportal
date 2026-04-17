import { useState } from "react";
import { Link } from "wouter";
import { Search, User } from "lucide-react";
import { useGetCandidates, getGetCandidatesQueryKey } from "@workspace/api-client-react";
import type { Candidate } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function CandidateCard({ c }: { c: Candidate }) {
  const initials = (c.name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const parsedData = c.parsedData as Record<string, unknown> | null;
  const skills = parsedData?.skills as string[] | undefined;

  return (
    <Link href={`/candidates/${c.id}`}>
      <div
        className="flex items-center gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
        data-testid={`row-candidate-${c.id}`}
      >
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" data-testid={`text-candidate-name-${c.id}`}>{c.name}</p>
          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {skills && skills.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {skills.slice(0, 2).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const candidates = useGetCandidates({ query: { queryKey: getGetCandidatesQueryKey() } });

  const filtered = candidates.data?.filter((c) =>
    (c.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-candidates">Candidates</h1>
          <p className="text-sm text-muted-foreground mt-1">{candidates.data?.length ?? 0} registered candidates</p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-candidates"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {candidates.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No candidates found</p>
              </div>
            ) : (
              <div data-testid="list-candidates">
                {filtered.map((c) => <CandidateCard key={c.id} c={c} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
