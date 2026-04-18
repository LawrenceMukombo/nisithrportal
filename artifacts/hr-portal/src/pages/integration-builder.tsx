import { useState } from "react";
import {
  Plus, Puzzle, Play, Trash2, ChevronDown, ChevronRight, Loader2,
  Sparkles, CheckCircle2, XCircle, Clock, Eye, EyeOff, Pencil, TestTube2, X,
  AlertTriangle, Activity, TrendingUp, Zap,
} from "lucide-react";
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
  method: string;
  apiKeyRef: string | null;
  authType: string;
  authHeaderName: string | null;
  headers: Record<string, string> | null;
  fieldMappings: Record<string, string> | null;
  responseMapping: Record<string, string> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationLog {
  id: number;
  status: string;
  durationMs: number | null;
  errorMessage: string | null;
  requestPayload: Record<string, unknown> | null;
  responsePayload: Record<string, unknown> | null;
  createdAt: string;
  triggeredBy: string | null;
}

interface PerConfigHealth {
  configId: number;
  configName: string;
  executions24h: number;
  successRate24h: number | null;
  lastStatus: string | null;
  lastExecutionAt: string | null;
  health: "healthy" | "degraded" | "failing" | "unknown";
}

interface RecentFailure {
  logId: number;
  configId: number | null;
  configName: string;
  errorMessage: string | null;
  createdAt: string | null;
}

interface IntegrationStats {
  totalConfigs: number;
  activeConfigs: number;
  executions7d: number;
  successRate7d: number;
  avgDurationMs: number;
  perConfig: PerConfigHealth[];
  recentFailures: RecentFailure[];
}

const HEALTH_META = {
  healthy:  { label: "Healthy",  color: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  degraded: { label: "Degraded", color: "bg-amber-100  text-amber-800  border-amber-200",  dot: "bg-amber-500"  },
  failing:  { label: "Failing",  color: "bg-red-100    text-red-800    border-red-200",    dot: "bg-red-500"    },
  unknown:  { label: "No data",  color: "bg-gray-100   text-gray-500   border-gray-200",   dot: "bg-gray-400"   },
};

function HealthBadge({ health }: { health: "healthy" | "degraded" | "failing" | "unknown" }) {
  const meta = HEALTH_META[health];
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${meta.color}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  );
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
    const rawErr = (err as { error?: unknown }).error;
    const msg = typeof rawErr === "string"
      ? rawErr
      : rawErr != null
        ? JSON.stringify(rawErr)
        : res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function safeJsonParse(str: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(str);
    return typeof v === "object" && v !== null ? v : null;
  } catch {
    return null;
  }
}

function parseExternalFields(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch { }
  return trimmed.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

function JsonEditorField({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  const isValid = value.trim() === "" || safeJsonParse(value) !== null;
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">
        {label}
        {value.trim() !== "" && (
          <span className={`text-xs ml-auto font-normal ${isValid ? "text-emerald-600" : "text-red-600"}`}>
            {isValid ? "valid JSON" : "invalid JSON"}
          </span>
        )}
      </Label>
      <Textarea
        className="font-mono text-xs h-24 resize-none"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '{\n  "key": "value"\n}'}
        data-testid={testId}
      />
    </div>
  );
}

function LogRow({ log }: { log: IntegrationLog }) {
  const [showDetail, setShowDetail] = useState(false);
  const statusIcon = log.status === "success"
    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
    : <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 py-1.5 text-xs cursor-pointer" onClick={() => setShowDetail(!showDetail)}>
        {statusIcon}
        <span className={log.status === "success" ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
          {log.status}
        </span>
        {log.durationMs != null && (
          <span className="text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-3 w-3" /> {log.durationMs}ms
          </span>
        )}
        {log.errorMessage && <span className="text-red-600 truncate max-w-xs">{log.errorMessage}</span>}
        <span className="ml-auto text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
        {(log.requestPayload || log.responsePayload) && (
          <span className="text-muted-foreground text-xs">{showDetail ? "▲" : "▼"}</span>
        )}
      </div>
      {showDetail && (log.requestPayload || log.responsePayload) && (
        <div className="pb-2 pl-5 space-y-1.5">
          {log.requestPayload && (
            <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-28 font-mono">
              {JSON.stringify(log.requestPayload, null, 2)}
            </pre>
          )}
          {log.responsePayload && (
            <pre className="text-xs bg-emerald-50 rounded p-2 overflow-auto max-h-28 font-mono border border-emerald-200">
              {JSON.stringify(log.responsePayload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function TestPanel({
  config,
  onClose,
}: {
  config: IntegrationConfig;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState(() =>
    JSON.stringify(config.fieldMappings && Object.keys(config.fieldMappings).length > 0
      ? config.fieldMappings
      : {}, null, 2)
  );
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const parsedPayload = safeJsonParse(payload);
  const isValidPayload = payload.trim() === "" || parsedPayload !== null;

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await apiFetch<Record<string, unknown>>(
        `/api/integration/${config.integrationType}`,
        { method: "POST", body: JSON.stringify(parsedPayload ?? {}) }
      );
      setResult(res);
      const r = res as { success?: boolean; status?: number };
      if (r.success) {
        toast({ title: `Test succeeded (HTTP ${r.status ?? "?"})` });
      } else {
        toast({ title: `Test returned HTTP ${r.status ?? "?"}`, variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["integration-logs", config.id] });
    } catch (e) {
      toast({ title: `Test failed: ${(e as Error).message}`, variant: "destructive" });
      setResult({ error: (e as Error).message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TestTube2 className="h-4 w-4 text-primary" />
          Test Integration
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter a sample JSON payload to send through this integration. The response will be shown below.
      </p>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1 text-xs">
          Sample Payload (JSON)
          {payload.trim() !== "" && (
            <span className={`ml-auto font-normal ${isValidPayload ? "text-emerald-600" : "text-red-600"}`}>
              {isValidPayload ? "valid JSON" : "invalid JSON"}
            </span>
          )}
        </Label>
        <Textarea
          className="font-mono text-xs h-28 resize-none"
          value={payload}
          onChange={e => setPayload(e.target.value)}
          placeholder='{\n  "employeeId": "E001"\n}'
          data-testid="textarea-test-payload"
        />
      </div>
      <Button
        size="sm"
        className="gap-2 w-full"
        onClick={handleRun}
        disabled={isRunning || !config.endpointUrl || !isValidPayload}
        title={!config.endpointUrl ? "Set an endpoint URL first" : undefined}
        data-testid="button-run-test"
      >
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {isRunning ? "Running..." : "Run Test"}
      </Button>
      {!config.endpointUrl && (
        <p className="text-xs text-amber-600">Set an endpoint URL on this integration before testing.</p>
      )}
      {result !== null && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Response:</p>
          <pre className="text-xs bg-background rounded border p-2 overflow-auto max-h-40 font-mono">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface IntegrationFormState {
  name: string;
  description: string;
  endpointUrl: string;
  method: string;
  apiKeyRef: string;
  authType: string;
  authHeaderName: string;
  headersJson: string;
  fieldMappingsJson: string;
  responseMappingJson: string;
  enabled: boolean;
}

function emptyForm(defaults?: Partial<IntegrationFormState>): IntegrationFormState {
  return {
    name: "",
    description: "",
    endpointUrl: "",
    method: "POST",
    apiKeyRef: "",
    authType: "bearer",
    authHeaderName: "",
    headersJson: "{}",
    fieldMappingsJson: "{}",
    responseMappingJson: "{}",
    enabled: true,
    ...defaults,
  };
}

function configToForm(c: IntegrationConfig): IntegrationFormState {
  return {
    name: c.name,
    description: c.description ?? "",
    endpointUrl: c.endpointUrl ?? "",
    method: c.method ?? "POST",
    apiKeyRef: c.apiKeyRef ?? "",
    authType: c.authType ?? "bearer",
    authHeaderName: c.authHeaderName ?? "",
    headersJson: JSON.stringify(c.headers ?? {}, null, 2),
    fieldMappingsJson: JSON.stringify(c.fieldMappings ?? {}, null, 2),
    responseMappingJson: JSON.stringify(c.responseMapping ?? {}, null, 2),
    enabled: c.enabled,
  };
}

function IntegrationForm({
  form,
  setForm,
  connector,
  onAiMap,
  isAiLoading,
  aiMappings,
  aiNotes,
  externalSchema,
  setExternalSchema,
}: {
  form: IntegrationFormState;
  setForm: (f: IntegrationFormState) => void;
  connector: ConnectorCatalogItem | undefined;
  onAiMap: () => void;
  isAiLoading: boolean;
  aiMappings: Record<string, string> | null;
  aiNotes: string;
  externalSchema: string;
  setExternalSchema: (v: string) => void;
}) {
  const set = (key: keyof IntegrationFormState) => (val: string | boolean) =>
    setForm({ ...form, [key]: val });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Display Name *</Label>
          <Input
            value={form.name}
            onChange={e => set("name")(e.target.value)}
            placeholder="e.g. IFMIS Production"
            data-testid="input-integration-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={e => set("description")(e.target.value)}
            placeholder="Short description (optional)"
            data-testid="input-integration-description"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Endpoint URL</Label>
          <Input
            value={form.endpointUrl}
            onChange={e => set("endpointUrl")(e.target.value)}
            placeholder="https://api.example.gov.pg/v1/endpoint"
            data-testid="input-integration-endpoint"
          />
        </div>
        <div className="space-y-1.5">
          <Label>HTTP Method</Label>
          <Select value={form.method} onValueChange={set("method")}>
            <SelectTrigger data-testid="select-integration-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Auth Type</Label>
          <Select value={form.authType} onValueChange={set("authType")}>
            <SelectTrigger data-testid="select-integration-authtype">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="api_key">API Key (query)</SelectItem>
              <SelectItem value="header">Custom Header</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.authType === "header" && (
          <div className="space-y-1.5">
            <Label>Auth Header Name</Label>
            <Input
              value={form.authHeaderName}
              onChange={e => set("authHeaderName")(e.target.value)}
              placeholder="X-Api-Key"
              data-testid="input-integration-authheader"
            />
          </div>
        )}
        <div className={`space-y-1.5 ${form.authType === "header" ? "" : "md:col-span-2"}`}>
          <Label>API Key / Token</Label>
          <Input
            type="password"
            value={form.apiKeyRef}
            onChange={e => set("apiKeyRef")(e.target.value)}
            placeholder="Paste API key or bearer token"
            data-testid="input-integration-apikey"
          />
        </div>
      </div>

      <JsonEditorField
        label="Custom Headers (JSON)"
        value={form.headersJson}
        onChange={set("headersJson")}
        placeholder={'{\n  "Accept": "application/json"\n}'}
        testId="textarea-integration-headers"
      />

      <JsonEditorField
        label="Field Mapping (JSON)"
        value={form.fieldMappingsJson}
        onChange={set("fieldMappingsJson")}
        placeholder={'{\n  "internal_field": "external_field"\n}'}
        testId="textarea-integration-fieldmappings"
      />

      <JsonEditorField
        label="Response Mapping (JSON)"
        value={form.responseMappingJson}
        onChange={set("responseMappingJson")}
        placeholder={'{\n  "response_key": "internal_key"\n}'}
        testId="textarea-integration-responsemapping"
      />

      {connector && (
        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-semibold">AI Field Mapping Assistant</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste the external system's field names or schema. The AI will suggest field mappings and populate the Field Mapping editor.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">External System Fields / Schema</Label>
            <Textarea
              className="font-mono text-xs h-24 resize-none"
              placeholder={`e.g. employeeNumber, fullName, birthDate, department, position\n\nor paste a JSON schema...`}
              value={externalSchema}
              onChange={e => setExternalSchema(e.target.value)}
              data-testid="textarea-external-schema"
            />
          </div>
          {connector.fields.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Internal System Fields (HR Portal):</p>
              <div className="flex flex-wrap gap-1">
                {connector.fields.map(f => (
                  <Badge key={f.key} variant="secondary" className="text-xs font-mono" title={f.description}>
                    {f.key}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={onAiMap}
            disabled={isAiLoading || !externalSchema.trim()}
            data-testid="button-ai-suggest-mapping"
          >
            {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-violet-500" />}
            Auto Map with AI
          </Button>

          {aiMappings && Object.keys(aiMappings).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700">Mappings applied to Field Mapping editor above:</p>
              <div className="rounded border bg-background p-2 space-y-1">
                {Object.entries(aiMappings).map(([internal, external]) => (
                  <div key={internal} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-primary font-semibold">{internal}</span>
                    <span className="text-muted-foreground">←</span>
                    <span className="text-emerald-700">{external}</span>
                  </div>
                ))}
              </div>
              {aiNotes && <p className="text-xs text-muted-foreground italic">{aiNotes}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          checked={form.enabled}
          onCheckedChange={v => set("enabled")(v)}
          data-testid="switch-integration-enabled-form"
        />
        <Label>Enabled</Label>
      </div>
    </div>
  );
}

function EditIntegrationDialog({
  config,
  catalog,
  onUpdated,
  onClose,
}: {
  config: IntegrationConfig;
  catalog: ConnectorCatalogItem[];
  onUpdated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<IntegrationFormState>(() => configToForm(config));
  const [externalSchema, setExternalSchema] = useState("");
  const [aiMappings, setAiMappings] = useState<Record<string, string> | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();

  const connector = catalog.find(c => c.type === config.integrationType);

  const jsonFieldsValid =
    (form.headersJson.trim() === "" || safeJsonParse(form.headersJson) !== null) &&
    (form.fieldMappingsJson.trim() === "" || safeJsonParse(form.fieldMappingsJson) !== null) &&
    (form.responseMappingJson.trim() === "" || safeJsonParse(form.responseMappingJson) !== null);

  const updateMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name,
        method: form.method,
        authType: form.authType,
        enabled: form.enabled,
        description: form.description,
        endpointUrl: form.endpointUrl,
        apiKeyRef: form.apiKeyRef,
        authHeaderName: form.authHeaderName,
      };
      const headers = safeJsonParse(form.headersJson);
      if (headers) body.headers = headers;
      const fieldMappings = safeJsonParse(form.fieldMappingsJson);
      if (fieldMappings) body.fieldMappings = fieldMappings;
      const responseMapping = safeJsonParse(form.responseMappingJson);
      if (responseMapping) body.responseMapping = responseMapping;
      return apiFetch(`/api/integration-config/${config.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast({ title: "Integration updated" });
      onUpdated();
      onClose();
    },
    onError: (e: Error) => toast({ title: `Failed: ${e.message}`, variant: "destructive" }),
  });

  const handleAiMap = async () => {
    if (!externalSchema.trim()) {
      toast({ title: "Enter external field names first", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    try {
      const internalFields = connector?.fields.map(f => f.key) ?? [];
      const externalFields = parseExternalFields(externalSchema);

      const result = await apiFetch<{ mappings: Record<string, string>; notes: string }>(
        "/api/integration/ai/suggest-mapping",
        {
          method: "POST",
          body: JSON.stringify({ internalFields, externalFields, connectorType: config.integrationType }),
        }
      );
      setAiMappings(result.mappings);
      setAiNotes(result.notes);
      setForm(f => ({ ...f, fieldMappingsJson: JSON.stringify(result.mappings, null, 2) }));
      toast({ title: "AI field mappings applied" });
    } catch (e) {
      toast({ title: `AI suggestion failed: ${(e as Error).message}`, variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Edit Integration</CardTitle>
            <CardDescription className="text-xs">{config.integrationType} · ID {config.id}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <IntegrationForm
          form={form}
          setForm={setForm}
          connector={connector}
          onAiMap={handleAiMap}
          isAiLoading={isAiLoading}
          aiMappings={aiMappings}
          aiNotes={aiNotes}
          externalSchema={externalSchema}
          setExternalSchema={setExternalSchema}
        />
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (!jsonFieldsValid) {
                toast({ title: "Fix invalid JSON fields before saving", variant: "destructive" });
                return;
              }
              updateMutation.mutate();
            }}
            disabled={!form.name || updateMutation.isPending}
            data-testid="button-update-integration"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationConfigCard({
  config,
  catalog,
  health,
  onDeleted,
  onUpdated,
}: {
  config: IntegrationConfig;
  catalog: ConnectorCatalogItem[];
  health?: "healthy" | "degraded" | "failing" | "unknown";
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration-configs"] });
      qc.invalidateQueries({ queryKey: ["integration-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/integration-config/${config.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Integration deleted" });
      onDeleted();
    },
  });

  if (isEditing) {
    return (
      <EditIntegrationDialog
        config={config}
        catalog={catalog}
        onUpdated={() => { qc.invalidateQueries({ queryKey: ["integration-configs"] }); onUpdated(); }}
        onClose={() => setIsEditing(false)}
      />
    );
  }

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
                <Badge variant="outline" className="text-xs font-mono">{config.method ?? "POST"}</Badge>
                <Badge variant="outline" className="text-xs">{config.integrationType}</Badge>
                {health && <HealthBadge health={health} />}
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
              onClick={() => { setIsTesting(!isTesting); setExpanded(true); }}
              data-testid={`button-test-integration-${config.id}`}
            >
              <TestTube2 className="h-3.5 w-3.5" />
              Test
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
              title="Edit integration"
              data-testid={`button-edit-integration-${config.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
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

          {isTesting && (
            <TestPanel config={config} onClose={() => setIsTesting(false)} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Endpoint URL</p>
              <p className="font-mono text-xs break-all">{config.endpointUrl || <span className="text-muted-foreground italic">Not set</span>}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Auth</p>
              <p className="text-xs">
                <span className="font-mono bg-muted px-1 rounded">{config.authType ?? "bearer"}</span>
                {config.authHeaderName && <span className="ml-1 text-muted-foreground">({config.authHeaderName})</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">API Key / Token</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs">{showApiKey ? (config.apiKeyRef || "—") : (config.apiKeyRef ? "••••••••" : "—")}</p>
                {config.apiKeyRef && (
                  <button onClick={() => setShowApiKey(!showApiKey)} className="text-muted-foreground hover:text-foreground">
                    {showApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>
            {config.headers && Object.keys(config.headers).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Custom Headers</p>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(config.headers).map(k => (
                    <Badge key={k} variant="secondary" className="text-xs font-mono">{k}</Badge>
                  ))}
                </div>
              </div>
            )}
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

          {config.responseMapping && Object.keys(config.responseMapping).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Response Mapping</p>
              <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                {Object.entries(config.responseMapping).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-emerald-700">{k}</span>
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
  const [form, setForm] = useState<IntegrationFormState>(emptyForm());
  const [externalSchema, setExternalSchema] = useState("");
  const [aiMappings, setAiMappings] = useState<Record<string, string> | null>(null);
  const [aiNotes, setAiNotes] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();

  const selectedConnector = catalog.find(c => c.type === selectedType);

  const createJsonFieldsValid =
    (form.headersJson.trim() === "" || safeJsonParse(form.headersJson) !== null) &&
    (form.fieldMappingsJson.trim() === "" || safeJsonParse(form.fieldMappingsJson) !== null) &&
    (form.responseMappingJson.trim() === "" || safeJsonParse(form.responseMappingJson) !== null);

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        integrationType: selectedType,
        name: form.name || selectedConnector?.label || selectedType,
        method: form.method,
        authType: form.authType,
        enabled: form.enabled,
        description: form.description,
        endpointUrl: form.endpointUrl,
        apiKeyRef: form.apiKeyRef,
        authHeaderName: form.authHeaderName,
      };
      const headers = safeJsonParse(form.headersJson);
      if (headers) body.headers = headers;
      const fieldMappings = safeJsonParse(form.fieldMappingsJson);
      if (fieldMappings) body.fieldMappings = fieldMappings;
      const responseMapping = safeJsonParse(form.responseMappingJson);
      if (responseMapping) body.responseMapping = responseMapping;
      return apiFetch("/api/integration-config", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({ title: "Integration created successfully" });
      setOpen(false);
      setSelectedType("");
      setForm(emptyForm());
      setAiMappings(null);
      setAiNotes("");
      setExternalSchema("");
      onCreated();
    },
    onError: (e: Error) => toast({ title: `Failed: ${e.message}`, variant: "destructive" }),
  });

  const handleAiMap = async () => {
    if (!selectedType || !externalSchema.trim()) {
      toast({ title: "Select a connector and enter external field names first", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    try {
      const internalFields = selectedConnector?.fields.map(f => f.key) ?? [];
      const externalFields = parseExternalFields(externalSchema);

      const result = await apiFetch<{ mappings: Record<string, string>; notes: string }>(
        "/api/integration/ai/suggest-mapping",
        {
          method: "POST",
          body: JSON.stringify({ internalFields, externalFields, connectorType: selectedType }),
        }
      );
      setAiMappings(result.mappings);
      setAiNotes(result.notes);
      setForm(f => ({ ...f, fieldMappingsJson: JSON.stringify(result.mappings, null, 2) }));
      toast({ title: "AI field mappings applied to editor" });
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Create New Integration</CardTitle>
            <CardDescription>Connect to a government system or external service</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Integration Type *</Label>
          <Select value={selectedType} onValueChange={v => { setSelectedType(v); setForm(emptyForm()); }}>
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
            <p className="text-xs text-muted-foreground">{selectedConnector.description}</p>
          )}
        </div>

        {selectedType && (
          <IntegrationForm
            form={form}
            setForm={setForm}
            connector={selectedConnector}
            onAiMap={handleAiMap}
            isAiLoading={isAiLoading}
            aiMappings={aiMappings}
            aiNotes={aiNotes}
            externalSchema={externalSchema}
            setExternalSchema={setExternalSchema}
          />
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-integration">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!createJsonFieldsValid) {
                toast({ title: "Fix invalid JSON fields before saving", variant: "destructive" });
                return;
              }
              createMutation.mutate();
            }}
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

  const catalogQuery = useQuery({
    queryKey: ["integration-catalog"],
    queryFn: () => apiFetch<ConnectorCatalogItem[]>("/api/integration-catalog"),
  });

  const configsQuery = useQuery({
    queryKey: ["integration-configs"],
    queryFn: () => apiFetch<IntegrationConfig[]>("/api/integration-config"),
  });

  const statsQuery = useQuery({
    queryKey: ["integration-stats"],
    queryFn: () => apiFetch<IntegrationStats>("/api/integration-stats"),
    refetchInterval: 60_000,
  });

  const catalog = catalogQuery.data ?? [];
  const configs = configsQuery.data ?? [];
  const stats = statsQuery.data;

  const grouped = catalog.reduce<Record<string, IntegrationConfig[]>>((acc, c) => {
    acc[c.type] = configs.filter(cfg => cfg.integrationType === c.type);
    return acc;
  }, {});

  const healthMap: Record<number, "healthy" | "degraded" | "failing" | "unknown"> =
    Object.fromEntries((stats?.perConfig ?? []).map(p => [p.configId, p.health]));

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

        {/* ── Health Dashboard ── */}
        {stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Puzzle className="h-3.5 w-3.5" />
                    <span className="text-xs">Total</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalConfigs}</p>
                  <p className="text-xs text-muted-foreground">{stats.activeConfigs} active</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="text-xs">Executions (7d)</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.executions7d}</p>
                  <p className="text-xs text-muted-foreground">avg {stats.avgDurationMs}ms</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs">Success Rate (7d)</span>
                  </div>
                  <p className={`text-2xl font-bold ${stats.successRate7d >= 80 ? "text-emerald-600" : stats.successRate7d >= 50 ? "text-amber-600" : "text-red-600"}`}>
                    {stats.executions7d > 0 ? `${stats.successRate7d}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.executions7d > 0
                      ? stats.successRate7d >= 80 ? "Nominal" : stats.successRate7d >= 50 ? "Degraded" : "Critical"
                      : "No executions"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-xs">24h Health</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {stats.perConfig.filter(p => p.health === "healthy").length}
                    <span className="text-sm font-normal text-muted-foreground">/{stats.totalConfigs}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">integrations healthy</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Failures */}
            {stats.recentFailures.length > 0 && (
              <Card className="border-red-200 bg-red-50/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <CardTitle className="text-sm text-red-800">Recent Failures</CardTitle>
                    <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-200 ml-auto">
                      {stats.recentFailures.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {stats.recentFailures.map(f => (
                      <a
                        key={f.logId}
                        href={f.configId ? `#integration-config-${f.configId}` : undefined}
                        onClick={e => {
                          if (!f.configId) return;
                          e.preventDefault();
                          const el = document.getElementById(`integration-config-${f.configId}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="flex items-start gap-3 text-xs p-2 rounded-md bg-white border border-red-100 hover:border-red-300 hover:bg-red-50/60 transition-colors cursor-pointer no-underline"
                        title={`Jump to ${f.configName}`}
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-red-800 underline-offset-2 hover:underline">{f.configName}</span>
                          {f.errorMessage && (
                            <p className="text-muted-foreground truncate mt-0.5">{f.errorMessage}</p>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0 font-mono">
                          {f.createdAt ? new Date(f.createdAt).toLocaleString() : "—"}
                        </span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : statsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading health data...
          </div>
        ) : null}

        {catalogQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading connector catalog...
          </div>
        ) : (
          <NewIntegrationDialog
            catalog={catalog}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["integration-configs"] });
              qc.invalidateQueries({ queryKey: ["integration-stats"] });
            }}
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
                    {(grouped[c.type]?.length ?? 0)} configured · Active: {(grouped[c.type]?.filter(i => i.enabled).length ?? 0)}
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
              <div key={cfg.id} id={`integration-config-${cfg.id}`}>
                <IntegrationConfigCard
                  config={cfg}
                  catalog={catalog}
                  health={healthMap[cfg.id]}
                  onDeleted={() => {
                    qc.invalidateQueries({ queryKey: ["integration-configs"] });
                    qc.invalidateQueries({ queryKey: ["integration-stats"] });
                  }}
                  onUpdated={() => {
                    qc.invalidateQueries({ queryKey: ["integration-configs"] });
                    qc.invalidateQueries({ queryKey: ["integration-stats"] });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
