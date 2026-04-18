import { useState } from "react";
import { Plus, Puzzle, Play, Trash2, ChevronDown, ChevronRight, Loader2, Sparkles, CheckCircle2, XCircle, Clock, Eye, EyeOff } from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ConnectorField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
}

interface ConnectorCatalogItem {
  type: string;
  label: string;
  description: string;
  category: string;
  fields: ConnectorField[];
  samplePayload: Record<string, unknown>;
}

interface IntegrationConfig {
  id: number;
  agencyId: number | null;
  integrationType: string;
  name: string;
  description: string | null;
  endpointUrl: string | null;
  apiKeyRef: string | null;
  fieldMappings: Record<string, string> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationLog {
  id: number;
  status: string;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  triggeredBy: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  payroll: "Payroll",
  verification: "Verification",
  identity: "Identity",
  learning: "Learning",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  payroll: "bg-emerald-100 text-emerald-800 border-emerald-200",
  verification: "bg-blue-100 text-blue-800 border-blue-200",
  identity: "bg-violet-100 text-violet-800 border-violet-200",
  learning: "bg-amber-100 text-amber-800 border-amber-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("hr_portal_token");
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

function LogRow({ log }: { log: IntegrationLog }) {
  const statusIcon = log.status === "success"
    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    : <XCircle className="h-3.5 w-3.5 text-red-600" />;

  return (
    <div className="flex items-center gap-3 py-1.5 text-xs border-b border-border last:border-0">
      {statusIcon}
      <span className={log.status === "success" ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
        {log.status}
      </span>
      {log.durationMs && (
        <span className="text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-3 w-3" /> {log.durationMs}ms
        </span>
      )}
      {log.errorMessage && <span className="text-red-600 truncate max-w-xs">{log.errorMessage}</span>}
      <span className="ml-auto text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
    </div>
  );
}

function IntegrationConfigCard({
  config,
  catalog,
  onDeleted,
}: {
  config: IntegrationConfig;
  catalog: ConnectorCatalogItem[];
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const connector = catalog.find(c => c.type === config.integrationType);

  const logQuery = useQuery({
    queryKey: ["integration-logs", config.id],
    queryFn: () => apiFetch<IntegrationLog[]>(`/api/integration-config/${config.id}/logs`),
    enabled: showLogs,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch(`/api/integration-config/${config.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration-configs"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/integration-config/${config.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Integration deleted" });
      onDeleted();
    },
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/integration/${config.integrationType}/execute`, {
        method: "POST",
        body: JSON.stringify({ configId: config.id, payload: {} }),
      }),
    onSuccess: (result) => {
      const r = result as { success: boolean; status: number };
      if (r.success) {
        toast({ title: `Integration executed successfully (HTTP ${r.status})` });
      } else {
        toast({ title: `Integration returned HTTP ${r.status}`, variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["integration-logs", config.id] });
    },
    onError: (e: Error) => toast({ title: `Execution failed: ${e.message}`, variant: "destructive" }),
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm">{config.name}</CardTitle>
                {connector && (
                  <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[connector.category] ?? ""}`}>
                    {CATEGORY_LABELS[connector.category] ?? connector.category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">{config.integrationType}</Badge>
              </div>
              <CardDescription className="mt-0.5 text-xs">{connector?.label ?? config.integrationType}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              data-testid={`switch-integration-enabled-${config.id}`}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => executeMutation.mutate()}
              disabled={!config.enabled || !config.endpointUrl || executeMutation.isPending}
              title={!config.endpointUrl ? "Set an endpoint URL first" : "Run integration"}
              data-testid={`button-run-integration-${config.id}`}
            >
              {executeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Delete this integration?")) deleteMutation.mutate(); }}
              data-testid={`button-delete-integration-${config.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Endpoint URL</p>
              <p className="font-mono text-xs break-all">{config.endpointUrl || <span className="text-muted-foreground italic">Not set</span>}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">API Key Ref</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs">{showApiKey ? (config.apiKeyRef || "—") : (config.apiKeyRef ? "••••••••" : "—")}</p>
                {config.apiKeyRef && (
                  <button onClick={() => setShowApiKey(!showApiKey)} className="text-muted-foreground hover:text-foreground">
                    {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          {config.fieldMappings && Object.keys(config.fieldMappings).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Field Mappings</p>
              <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                {Object.entries(config.fieldMappings).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-primary">{k}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Execution Logs {logQuery.data ? `(${logQuery.data.length})` : ""}
          </Button>
          {showLogs && (
            <div className="rounded-md border bg-muted/20 p-2">
              {logQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading logs...
                </div>
              ) : logQuery.data?.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No executions yet.</p>
              ) : (
                logQuery.data?.map(log => <LogRow key={log.id} log={log} />)
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function NewIntegrationDialog({
  catalog,
  onCreated,
}: {
  catalog: ConnectorCatalogItem[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [apiKeyRef, setApiKeyRef] = useState("");
  const [externalSchema, setExternalSchema] = useState("");
  const [aiMappings, setAiMappings] = useState<Record<string, string> | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();

  const selectedConnector = catalog.find(c => c.type === selectedType);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/integration-config", {
        method: "POST",
        body: JSON.stringify({
          integrationType: selectedType,
          name: name || selectedConnector?.label || selectedType,
          endpointUrl,
          apiKeyRef,
          fieldMappings: aiMappings ?? {},
          enabled: true,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Integration created successfully" });
      setOpen(false);
      setSelectedType("");
      setName("");
      setEndpointUrl("");
      setApiKeyRef("");
      setAiMappings(null);
      setAiNotes("");
      setExternalSchema("");
      onCreated();
    },
    onError: (e: Error) => toast({ title: `Failed: ${e.message}`, variant: "destructive" }),
  });

  const handleAiSuggest = async () => {
    if (!selectedType || !externalSchema.trim()) {
      toast({ title: "Select a connector type and enter the external schema first", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await apiFetch<{ mappings: Record<string, string>; notes: string }>(
        "/api/integration/ai/suggest-mapping",
        {
          method: "POST",
          body: JSON.stringify({ connectorType: selectedType, externalSchema }),
        }
      );
      setAiMappings(result.mappings);
      setAiNotes(result.notes);
      toast({ title: "AI field mappings generated" });
    } catch (e) {
      toast({ title: `AI suggestion failed: ${(e as Error).message}`, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2" data-testid="button-new-integration">
        <Plus className="h-4 w-4" /> New Integration
      </Button>
    );
  }

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create New Integration</CardTitle>
        <CardDescription>Connect to a government system or external service</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Integration Type *</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-integration-type">
                <SelectValue placeholder="Select a connector..." />
              </SelectTrigger>
              <SelectContent>
                {catalog.map(c => (
                  <SelectItem key={c.type} value={c.type}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[c.category] ?? ""}`}>
                        {CATEGORY_LABELS[c.category] ?? c.category}
                      </Badge>
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedConnector && (
              <p className="text-xs text-muted-foreground mt-1">{selectedConnector.description}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Display Name *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={selectedConnector?.label ?? "e.g. IFMIS Production"}
              data-testid="input-integration-name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <Input
              value={endpointUrl}
              onChange={e => setEndpointUrl(e.target.value)}
              placeholder="https://api.example.gov.pg/v1/endpoint"
              data-testid="input-integration-endpoint"
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Key / Auth Token</Label>
            <Input
              type="password"
              value={apiKeyRef}
              onChange={e => setApiKeyRef(e.target.value)}
              placeholder="Paste API key or token"
              data-testid="input-integration-apikey"
            />
          </div>
        </div>

        {selectedConnector && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-semibold">AI Field Mapping Assistant</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste the external system's field names or schema below, and our AI will suggest the best field mappings automatically.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">External System Schema / Field Names</Label>
              <Textarea
                className="font-mono text-xs h-24 resize-none"
                placeholder={`e.g.\nemployeeNumber, fullName, birthDate, department, position, grade\n\nor paste a JSON schema...`}
                value={externalSchema}
                onChange={e => setExternalSchema(e.target.value)}
                data-testid="textarea-external-schema"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={handleAiSuggest}
              disabled={isAiLoading || !selectedType || !externalSchema.trim()}
              data-testid="button-ai-suggest-mapping"
            >
              {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-violet-500" />}
              Suggest Mappings with AI
            </Button>

            {aiMappings && Object.keys(aiMappings).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Suggested Mappings:</p>
                <div className="rounded border bg-background p-2 space-y-1">
                  {Object.entries(aiMappings).map(([internal, external]) => (
                    <div key={internal} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-primary font-semibold">{internal}</span>
                      <span className="text-muted-foreground">←</span>
                      <span className="text-emerald-700">{external}</span>
                    </div>
                  ))}
                </div>
                {aiNotes && (
                  <p className="text-xs text-muted-foreground italic">{aiNotes}</p>
                )}
              </div>
            )}

            {selectedConnector.fields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Available Internal Fields:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedConnector.fields.map(f => (
                    <Badge key={f.key} variant="secondary" className="text-xs font-mono" title={f.description}>
                      {f.key}
                      {f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-integration">
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!selectedType || createMutation.isPending}
            data-testid="button-save-integration"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Integration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegrationBuilderPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const catalogQuery = useQuery({
    queryKey: ["integration-catalog"],
    queryFn: () => apiFetch<ConnectorCatalogItem[]>("/api/integration-catalog"),
  });

  const configsQuery = useQuery({
    queryKey: ["integration-configs"],
    queryFn: () => apiFetch<IntegrationConfig[]>("/api/integration-config"),
  });

  const catalog = catalogQuery.data ?? [];
  const configs = configsQuery.data ?? [];

  const grouped = catalog.reduce<Record<string, IntegrationConfig[]>>((acc, c) => {
    acc[c.category] = configs.filter(cfg => cfg.integrationType === c.type);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Puzzle className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Integration Builder</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Connect PNG NISIT HR Portal to government systems. Configure endpoints, field mappings, and monitor executions.
            </p>
          </div>
        </div>

        {catalogQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading connector catalog...
          </div>
        ) : (
          <NewIntegrationDialog
            catalog={catalog}
            onCreated={() => qc.invalidateQueries({ queryKey: ["integration-configs"] })}
          />
        )}

        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold mb-1">Available Connectors</h2>
            <p className="text-xs text-muted-foreground">Pre-configured connectors for PNG government systems.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {catalog.map(c => (
              <Card key={c.type} className="border-dashed hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[c.category] ?? ""}`}>
                      {CATEGORY_LABELS[c.category] ?? c.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{c.type}</span>
                  </div>
                  <CardTitle className="text-sm">{c.label}</CardTitle>
                  <CardDescription className="text-xs">{c.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-1.5">Fields:</p>
                  <div className="flex flex-wrap gap-1">
                    {c.fields.map(f => (
                      <Badge key={f.key} variant="secondary" className="text-xs font-mono" title={f.description}>
                        {f.key}{f.required && <span className="text-red-500">*</span>}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {(grouped[c.category]?.length ?? 0)} configured · Active: {(grouped[c.category]?.filter(i => i.enabled).length ?? 0)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {configsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations...
          </div>
        ) : configs.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl text-center py-16 text-muted-foreground">
            <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">No integrations configured yet</p>
            <p className="text-sm mt-1">Create your first integration using the form above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Configured Integrations ({configs.length})</h2>
            {configs.map(cfg => (
              <IntegrationConfigCard
                key={cfg.id}
                config={cfg}
                catalog={catalog}
                onDeleted={() => qc.invalidateQueries({ queryKey: ["integration-configs"] })}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
