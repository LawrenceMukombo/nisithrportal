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

export interface ExecuteIntegrationOptions {
  connectorType: string;
  endpointUrl: string;
  apiKey?: string;
  payload: Record<string, unknown>;
}

export interface ExecuteIntegrationResult {
  success: boolean;
  status: number;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export async function executeIntegration(opts: ExecuteIntegrationOptions): Promise<ExecuteIntegrationResult> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (opts.apiKey) {
      headers["Authorization"] = `Bearer ${opts.apiKey}`;
      headers["X-Api-Key"] = opts.apiKey;
    }
    const res = await fetch(opts.endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(opts.payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => null);
    return {
      success: res.ok,
      status: res.status,
      data,
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
