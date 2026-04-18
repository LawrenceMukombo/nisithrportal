import { eq, and } from "drizzle-orm";
import { db, integrationConfigsTable } from "@workspace/db";

// ─── Connector catalog types (UI discovery) ────────────────────────────────────

export interface ConnectorField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
  required?: boolean;
  description?: string;
}

export interface ConnectorConfig {
  type: string;
  label: string;
  description: string;
  category: "payroll" | "verification" | "identity" | "learning" | "other";
  fields: ConnectorField[];
  samplePayload: Record<string, unknown>;
}

export const CONNECTOR_CATALOG: ConnectorConfig[] = [
  {
    type: "ifmis",
    label: "IFMIS (Integrated Financial Management)",
    description: "Sync employee payroll and financial data with the PNG Government Integrated Financial Management Information System.",
    category: "payroll",
    fields: [
      { key: "employee_id", label: "Employee ID", type: "string", required: true, description: "The NISIT employee identifier" },
      { key: "payroll_code", label: "Payroll Code", type: "string", required: true, description: "IFMIS payroll reference code" },
      { key: "department_code", label: "Department Code", type: "string", required: true, description: "Government department code" },
      { key: "grade", label: "Salary Grade", type: "string", description: "Public service salary grade" },
      { key: "step", label: "Salary Step", type: "number", description: "Step within the salary grade" },
    ],
    samplePayload: {
      employee_id: "EMP-12345",
      payroll_code: "NISIT-2024-001",
      department_code: "ICT-001",
      grade: "G8",
      step: 3,
    },
  },
  {
    type: "exam-verify",
    label: "Examination & Qualification Verification",
    description: "Verify academic credentials and examination results through the PNG Department of Higher Education, Research, Science and Technology.",
    category: "verification",
    fields: [
      { key: "applicant_name", label: "Applicant Full Name", type: "string", required: true },
      { key: "institution", label: "Institution Name", type: "string", required: true },
      { key: "qualification", label: "Qualification Title", type: "string", required: true },
      { key: "year_completed", label: "Year Completed", type: "number", required: true },
      { key: "national_id", label: "National ID", type: "string", description: "PNG National ID number" },
    ],
    samplePayload: {
      applicant_name: "John Kaupa",
      institution: "University of Technology PNG",
      qualification: "Bachelor of Information Technology",
      year_completed: 2020,
      national_id: "1234567890",
    },
  },
  {
    type: "identity-verify",
    label: "National Identity Verification",
    description: "Verify PNG national identity documents through the Civil Registry and Identity Service.",
    category: "identity",
    fields: [
      { key: "national_id", label: "National ID Number", type: "string", required: true },
      { key: "full_name", label: "Full Legal Name", type: "string", required: true },
      { key: "date_of_birth", label: "Date of Birth", type: "date", required: true },
      { key: "province_of_birth", label: "Province of Birth", type: "string" },
      { key: "passport_number", label: "Passport Number", type: "string" },
    ],
    samplePayload: {
      national_id: "1234567890",
      full_name: "John Kaupa",
      date_of_birth: "1990-05-15",
      province_of_birth: "NCD",
    },
  },
  {
    type: "lms",
    label: "Learning Management System (LMS)",
    description: "Sync employee training, certifications, and professional development records with the government LMS.",
    category: "learning",
    fields: [
      { key: "employee_id", label: "Employee ID", type: "string", required: true },
      { key: "course_code", label: "Course Code", type: "string", required: true },
      { key: "completion_date", label: "Completion Date", type: "date" },
      { key: "certificate_url", label: "Certificate URL", type: "string" },
    ],
    samplePayload: {
      employee_id: "EMP-12345",
      course_code: "ICT-SEC-101",
      completion_date: "2024-03-01",
    },
  },
];

export function getConnector(type: string): ConnectorConfig | undefined {
  return CONNECTOR_CATALOG.find(c => c.type === type);
}

// ─── Static integration configs (full executable) ─────────────────────────────
// These define the initial set of integrations. DB-saved configs take precedence.

export type AuthType = "bearer" | "api_key" | "header";

export interface StaticIntegrationConfig {
  type: string;
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  authType: AuthType;
  authEnvVar?: string;
  authHeaderName?: string;
  headers: Record<string, string>;
  mapping: Record<string, string>;
  responseMapping: Record<string, string>;
}

export const STATIC_INTEGRATION_CONFIGS: StaticIntegrationConfig[] = [
  {
    type: "ifmis",
    name: "IFMIS Employee Create",
    description: "Create/sync employee records in the PNG Integrated Financial Management Information System.",
    method: "POST",
    url: process.env["IFMIS_API_URL"] ?? "https://ifmis.example.gov.pg/api/v1/employees",
    authType: "bearer",
    authEnvVar: "IFMIS_API_KEY",
    authHeaderName: "Authorization",
    headers: { "X-Client-Id": "NISIT-HR-SYSTEM", "X-Agency": "NISIT" },
    mapping: {
      employee_id: "employeeCode",
      payroll_code: "payrollReference",
      department_code: "departmentCode",
      grade: "salaryGrade",
      step: "salaryStep",
    },
    responseMapping: {
      id: "ifmisId",
      status: "syncStatus",
      message: "syncMessage",
    },
  },
  {
    type: "exam-verify",
    name: "Exam Result Verification",
    description: "Verify academic qualifications via the PNG Dept. of Higher Education, Research, Science and Technology.",
    method: "POST",
    url: process.env["EXAM_VERIFY_API_URL"] ?? "https://dherst.example.gov.pg/api/v1/verify",
    authType: "api_key",
    authEnvVar: "EXAM_VERIFY_API_KEY",
    authHeaderName: "X-Api-Key",
    headers: { "X-System": "NISIT-HR" },
    mapping: {
      applicant_name: "fullName",
      institution: "institutionName",
      qualification: "qualificationTitle",
      year_completed: "yearOfCompletion",
      national_id: "nationalId",
    },
    responseMapping: {
      verified: "isVerified",
      certificate_number: "certificateRef",
      verification_date: "verifiedAt",
    },
  },
  {
    type: "identity-verify",
    name: "National Identity Verification",
    description: "Verify PNG national identity documents through the Civil Registry and Identity Service.",
    method: "POST",
    url: process.env["IDENTITY_VERIFY_API_URL"] ?? "https://cris.example.gov.pg/api/v1/identify",
    authType: "header",
    authEnvVar: "IDENTITY_VERIFY_TOKEN",
    authHeaderName: "X-Auth-Token",
    headers: { "X-System": "NISIT-HR", "X-Country": "PG" },
    mapping: {
      national_id: "nationalIdNumber",
      full_name: "legalFullName",
      date_of_birth: "dateOfBirth",
      province_of_birth: "provinceCode",
      passport_number: "passportNumber",
    },
    responseMapping: {
      match: "identityMatched",
      confidence: "matchConfidence",
      person_id: "registryPersonId",
    },
  },
];

// ─── Executable integration config (unified shape) ────────────────────────────

export interface ExecutableIntegrationConfig {
  type: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  authType: AuthType;
  credential?: string;
  authHeaderName?: string;
  headers: Record<string, string>;
  mapping: Record<string, string>;
  responseMapping: Record<string, string>;
  source: "db" | "static";
}

// ─── DB-backed config loader ───────────────────────────────────────────────────
// Prefers DB config over static config when one exists and is enabled.

export async function loadIntegrationConfig(
  type: string,
  agencyId?: number | null,
): Promise<ExecutableIntegrationConfig | null> {
  try {
    const filters = [
      eq(integrationConfigsTable.integrationType, type),
      eq(integrationConfigsTable.enabled, true),
    ];
    if (agencyId != null) {
      filters.push(eq(integrationConfigsTable.agencyId, agencyId));
    }
    const [dbCfg] = await db
      .select()
      .from(integrationConfigsTable)
      .where(and(...filters))
      .limit(1);

    if (dbCfg) {
      const credential = dbCfg.apiKeyRef ? resolveCredential(dbCfg.apiKeyRef) : undefined;
      return {
        type: dbCfg.integrationType,
        name: dbCfg.name,
        method: (dbCfg.method ?? "POST") as ExecutableIntegrationConfig["method"],
        url: dbCfg.endpointUrl ?? "",
        authType: (dbCfg.authType ?? "bearer") as AuthType,
        credential,
        authHeaderName: dbCfg.authHeaderName ?? undefined,
        headers: (dbCfg.headers as Record<string, string>) ?? {},
        mapping: (dbCfg.fieldMappings as Record<string, string>) ?? {},
        responseMapping: (dbCfg.responseMapping as Record<string, string>) ?? {},
        source: "db",
      };
    }
  } catch {
    // DB unavailable — fall through to static config
  }

  // Fall back to static config
  const staticCfg = STATIC_INTEGRATION_CONFIGS.find(c => c.type === type);
  if (!staticCfg) return null;

  const credential = staticCfg.authEnvVar ? resolveCredential(staticCfg.authEnvVar) : undefined;
  return {
    type: staticCfg.type,
    name: staticCfg.name,
    method: staticCfg.method,
    url: staticCfg.url,
    authType: staticCfg.authType,
    credential,
    authHeaderName: staticCfg.authHeaderName,
    headers: staticCfg.headers,
    mapping: staticCfg.mapping,
    responseMapping: staticCfg.responseMapping,
    source: "static",
  };
}

// ─── Credential resolution ─────────────────────────────────────────────────────
// Resolves a credential reference: if it starts with "$" treat as env var name,
// otherwise use as literal value (for dev/testing).

function resolveCredential(ref: string): string | undefined {
  if (ref.startsWith("$")) {
    return process.env[ref.slice(1)] ?? undefined;
  }
  return process.env[ref] ?? ref;
}

// ─── Payload transformation ────────────────────────────────────────────────────
// Maps input keys to target keys based on the mapping config.
// Unmapped keys are passed through as-is.

function applyMapping(
  input: Record<string, unknown>,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [inKey, value] of Object.entries(input)) {
    const outKey = mapping[inKey] ?? inKey;
    result[outKey] = value;
  }
  return result;
}

// ─── Response normalization ────────────────────────────────────────────────────
// Renames response keys from external names to internal names.

function applyResponseMapping(
  response: unknown,
  responseMapping: Record<string, string>,
): unknown {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return response;
  }
  const raw = response as Record<string, unknown>;
  if (Object.keys(responseMapping).length === 0) return raw;
  const result: Record<string, unknown> = {};
  for (const [extKey, value] of Object.entries(raw)) {
    const internalKey = responseMapping[extKey] ?? extKey;
    result[internalKey] = value;
  }
  return result;
}

// ─── Auth header builder ───────────────────────────────────────────────────────
// Supports three patterns:
//   bearer — Authorization: Bearer <token>
//   api_key — <authHeaderName>: <token> (defaults to X-Api-Key)
//   header — <authHeaderName>: <token> (plain passthrough, defaults to X-Auth-Token)

function buildAuthHeaders(
  authType: AuthType,
  credential?: string,
  authHeaderName?: string,
): Record<string, string> {
  if (!credential) return {};
  switch (authType) {
    case "bearer":
      return { Authorization: `Bearer ${credential}` };
    case "api_key":
      return { [authHeaderName ?? "X-Api-Key"]: credential };
    case "header":
      return { [authHeaderName ?? "X-Auth-Token"]: credential };
    default:
      return {};
  }
}

// ─── Execute integration (main engine) ────────────────────────────────────────

export interface ExecuteIntegrationResult {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export async function executeIntegration(
  config: ExecutableIntegrationConfig,
  inputData: Record<string, unknown>,
): Promise<ExecuteIntegrationResult> {
  const start = Date.now();

  if (!config.url) {
    return { success: false, status: 0, error: "Endpoint URL is not configured", durationMs: 0 };
  }

  const mappedPayload = applyMapping(inputData, config.mapping);
  const authHeaders = buildAuthHeaders(config.authType, config.credential, config.authHeaderName);
  const allHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
    ...authHeaders,
  };

  try {
    const res = await fetch(config.url, {
      method: config.method,
      headers: allHeaders,
      body: config.method !== "GET" ? JSON.stringify(mappedPayload) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    const rawData = await res.json().catch(() => null);
    const normalizedData = applyResponseMapping(rawData, config.responseMapping);

    return {
      success: res.ok,
      status: res.status,
      data: normalizedData,
      error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      success: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

// ─── Legacy: simple execute for backward compatibility with existing route ─────

export interface ExecuteIntegrationOptions {
  connectorType: string;
  endpointUrl: string;
  apiKey?: string;
  payload: Record<string, unknown>;
}

/** @deprecated Use executeIntegration(config, inputData) instead */
export async function executeIntegrationLegacy(opts: ExecuteIntegrationOptions): Promise<ExecuteIntegrationResult> {
  const config: ExecutableIntegrationConfig = {
    type: opts.connectorType,
    name: opts.connectorType,
    method: "POST",
    url: opts.endpointUrl,
    authType: "bearer",
    credential: opts.apiKey,
    headers: {},
    mapping: {},
    responseMapping: {},
    source: "static",
  };
  return executeIntegration(config, opts.payload);
}
