import { useGetAgencies, getGetAgenciesQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/layouts/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AgenciesPage() {
  const agencies = useGetAgencies({ query: { queryKey: getGetAgenciesQueryKey() } });

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-agencies">Agency</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This deployment is locked to a single agency.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {agencies.isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <div data-testid="list-agencies">
                {agencies.data?.map((agency) => (
                  <div
                    key={agency.id}
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
                    data-testid={`row-agency-${agency.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{agency.name}</p>
                      {agency.type && (
                        <Badge variant="outline" className="text-xs mt-1 capitalize">
                          {agency.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {agencies.data?.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">
                    No agency configured
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
