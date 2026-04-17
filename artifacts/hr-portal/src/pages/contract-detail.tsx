import { useRoute, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useGetContract, getGetContractQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/layouts/app-layout";
import { Link } from "wouter";

export default function ContractDetailPage() {
  const [match, params] = useRoute("/contracts/:id");
  const [, setLocation] = useLocation();
  const contractId = match ? parseInt(params!.id) : 0;

  const { data: contract, isLoading } = useGetContract(contractId, {
    query: { enabled: !!contractId && params?.id !== "new", queryKey: getGetContractQueryKey(contractId) },
  });

  if (isLoading) {
    return <AppLayout><div className="p-6"><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }

  if (!contract) {
    return <AppLayout><div className="p-6 text-center py-20 text-muted-foreground">Contract not found.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contracts
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" data-testid="heading-contract">Contract #{contract.id}</h1>
          <Badge variant={contract.status === "active" ? "default" : contract.status === "expired" ? "destructive" : "outline"}>
            {contract.status}
          </Badge>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Contract Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee</span>
              <Link href={`/employees/${contract.employeeId}`}>
                <span className="text-primary hover:underline cursor-pointer">Employee #{contract.employeeId}</span>
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{contract.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span>{contract.startDate ? new Date(contract.startDate).toLocaleDateString() : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span>{contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "Ongoing"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
