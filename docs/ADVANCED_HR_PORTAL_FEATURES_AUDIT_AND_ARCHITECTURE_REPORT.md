# Advanced HR Portal Features Audit & Architecture Report

**System:** NISIT Integrated HR Portal  
**Assessment type:** Architecture and readiness audit  
**Scope:** Eighteen proposed advanced capabilities; no advanced-feature implementation is authorised by this report.

## 1. Executive Summary

NISIT already has a credible transactional HR foundation: identity and role control, employee records, organisation/positions, recruitment, contracts, leave, attendance, benefits, housing, training, performance, documents, notifications, audit records, reporting, approvals, integrations and a wiki. The portal should evolve these services rather than introduce parallel platforms.

The best first investment is **Employee 360 and an authoritative lifecycle timeline**. It has high business value, uses existing data, reveals data-quality gaps early, and creates the safe navigation layer needed by skills, succession, planning and AI. AI Copilot, talent matching and predictive features should not be built until access controls, data ownership, workflow versioning, eventing, and KPI definitions are mature.

## 2. Current Platform Readiness

| Layer | Current implementation | Readiness |
|---|---|---|
| Frontend | React, Vite, TypeScript, TanStack Query, Tailwind/Radix UI, Wouter | Strong |
| API | Express 5, TypeScript, Zod contracts | Strong |
| Data | PostgreSQL with Drizzle ORM | Strong |
| Identity | JWT authentication, roles/permissions, agency scoping | Partial; privileged MFA/SSO and database RLS remain gaps |
| Employee master | Employee, department, position, grade, supervisor and employment fields | Strong foundation |
| Documents | Object-storage abstraction, private file access, signed-contract history, HR letters | Partial; no OCR/index/metadata verification workflow |
| Workflow | Definitions, approval instances/actions, delegation/escalation scheduler | Partial; no versioning/conditional routing engine |
| AI | OpenAI CV parsing, AI scoring/mapping endpoints | Partial; no controlled tool gateway or policy-grounded assistant |
| Reporting | Dashboards, operational reports, CSV/PDF/XLSX paths | Partial; KPI registry and semantic analytics layer absent |
| Operations | In-process scheduled approval escalation | Partial; no durable queue, cache, event bus, or worker separation identified |

## 3. Existing Reusable Components

| Shared component | Reuse in advanced capabilities |
|---|---|
| Employee master, departments, positions, grades | Employee 360, skills, establishment, marketplace, succession, planning, career pathways |
| Roles, permissions, agency access helpers | Every advanced feature; apply scope before data retrieval |
| Audit logging | High-risk AI actions, cases, workflows, document verification and policy changes |
| Notifications | Alerts, approval inbox, overdue work, development plans |
| Approval instances/actions and workflow definitions | Unified approvals, workflow builder, case escalation |
| Wiki articles and file/document service | Knowledge base and policy assistant |
| Training, performance, contracts, onboarding/offboarding | Timeline, skills evidence, career/succession and early warnings |
| Recruitment candidates, jobs and normalised candidate skills | AI-assisted recruitment and later internal talent matching |
| OpenAI integration package | Controlled, consented AI only; never direct database access |

## 4. Advanced Feature Gap Matrix

| Feature | Existing capability | Status | Gap | Recommended action | Priority | Complexity |
|---|---|---|---|---|---|---|
| AI HR Copilot | OpenAI client and AI routes | PARTIAL | No scoped tools, citations, conversations or guardrails | BUILD controlled tool gateway after foundations | P3 | VERY HIGH |
| Skills & competency | Candidate skills; training/certifications | PARTIAL | No employee skill taxonomy, proficiency or verification | EXTEND master data and evidence model | P1 | HIGH |
| Talent marketplace | Jobs, employees, positions, training | MISSING | No internal opportunity or explainable matching model | BUILD after skills/career data | P3 | HIGH |
| Succession/talent pools | Positions, performance, training | PARTIAL | No critical-role/successor/readiness model | EXTEND position-centric planning | P3 | HIGH |
| Workforce planning | Org chart, positions, reports | PARTIAL | No isolated scenarios or forecast assumptions | BUILD scenario layer | P3 | VERY HIGH |
| Predictive alerts | Approval escalation scheduler, notifications | PARTIAL | No generic rule/event/alert lifecycle | EXTEND rules engine | P2 | HIGH |
| Lifecycle timeline | Module histories and workflow records | PARTIAL | No canonical read model | BUILD derived timeline view | P1 | MEDIUM |
| Employee 360 | Employee master plus core modules | PARTIAL | No unified, permission-aware profile composition | EXTEND employee experience | P1 | MEDIUM |
| Workflow builder | Workflow definitions/instances/actions | PARTIAL | No versioning, conditions, transitions, SLA policy | REFACTOR shared workflow engine | P2 | VERY HIGH |
| No-code forms | Application forms/wiki content | MISSING | No form metadata, publish/versioning or safe validation | BUILD after workflow engine | P2 | HIGH |
| Unified approval inbox | Approval instances/actions | PARTIAL | No consolidated work queue, filters and workload model | EXTEND approvals service | P2 | MEDIUM |
| Intelligent documents | Private storage, documents, wiki | PARTIAL | No extraction, index, classification, verification | EXTEND documents after access-index design | P3 | HIGH |
| Case management | Audit, documents, workflow primitives | MISSING | No highly restricted case domain | BUILD separate restricted module | P4 | VERY HIGH |
| Position establishment | Positions and org chart counts | PARTIAL | Approved establishment is not a separate authoritative entity | EXTEND position control | P1 | HIGH |
| Career pathways | Positions, grades, training | PARTIAL | No pathway graph or required competencies | EXTEND after skills/establishment | P3 | HIGH |
| Knowledge base/policy assistant | Wiki CRUD, uploads | PARTIAL | No policy lifecycle, source citations or retrieval controls | EXTEND wiki first | P3 | HIGH |
| People analytics | Dashboard/reports | PARTIAL | No governed KPI catalogue, dimensions or metric lineage | REFACTOR analytics definitions | P3 | HIGH |
| AI-assisted recruitment | CV parsing, candidate skills, AI scores | PARTIAL | No explainable, human-review-only recommendation workflow | IMPROVE governed recruitment assistance | P3 | HIGH |

## 5. AI Architecture Assessment

Current AI use is endpoint-driven and includes CV parsing and administrative mapping support. It must not become an unrestricted natural-language query to HR tables.

Recommended target flow:

```text
Authenticated user -> RBAC + agency/employee scope -> allowlisted HR tool -> minimal result
  -> prompt assembly with policy and injection controls -> model -> cited response -> audit event
```

Requirements:

1. Define read-only tools such as `get_my_leave_balance`, `get_my_contract_expiry`, and `get_team_pending_leave`; each calls existing scoped services.
2. Enforce permissions before tool execution, never in the prompt alone.
3. Minimise/redact personal data; obtain consent before CV/document AI processing.
4. Keep policy answers retrieval-grounded, dated, cited and version-aware.
5. Require explicit confirmation for letters, notifications, workflow actions or record changes.
6. Log tool name, data classification, outcome and user—not raw sensitive prompts by default.
7. Treat candidate scoring/matching as an assistive explanation, never automatic rejection or appointment.

## 6. Employee 360 Assessment

The employee table and related contracts, leave, attendance, benefits, housing, training, performance, documents, onboarding and offboarding can supply an Employee 360 view without duplicating records. The feature should be a **read composition layer**, not a new employee database.

Recommended tabs: Overview, Personal, Contact, Emergency, Employment, Organisation, History, Contracts, Documents, Leave, Attendance, Benefits, Housing, Training, Skills, Performance, Career, Onboarding, Offboarding and Audit. Each tab must apply the existing `canReadEmployee`/management scope before loading records.

## 7. Skills Architecture Assessment

Candidate skills are normalised, but employee skills, standardised taxonomy, skill requirements and verification are absent.

Required additive entities: `skill_categories`, `skills`, `competency_scales`, `employee_skills`, `position_skill_requirements`, `training_skill_mappings`, and `skill_evidence`. Keep proficiency scales agency-configurable. Track source as self-declared, manager-verified, HR-verified or certification-verified; AI extraction is only a suggested source pending verification.

## 8. Position Establishment Assessment

Positions already support organisational structure and counts, but establishment approval/funding/lifecycle must be independent of employee occupancy. Introduce an additive `position_establishments` record keyed to position/agency with position number, approved headcount, funding state, establishment state, effective dates and authoritative approval reference. Derive filled/vacant counts; do not write them manually from employee events.

## 9. Workflow Architecture Assessment

The portal has workflow definitions, approval instances/actions, delegation and an in-process overdue escalation scheduler. This is a useful base, but not a configurable workflow platform.

Before a visual builder, add immutable workflow versions, version-bound instances, explicit transitions, typed conditions, assignment-resolution rules, SLA/escalation policies, task history and idempotency. Preserve existing leave/onboarding/offboarding/contract integrations as adapters to the shared engine.

## 10. Document Intelligence Assessment

The original stored file must remain authoritative. Add document metadata/extraction separately: document type, extracted text pointer, confidence, extracted expiry date, verification state, verifier and extraction provenance. Index only documents the requesting user can read. OCR/classification must use a queue, quarantine uploads, and never overwrite originals.

## 11. Talent Intelligence Assessment

Internal matching depends on employee skills, position requirements, current grade, career interests, performance/training and explicit opportunity types. It should produce transparent factors and gaps, not a single opaque score. Exclude protected attributes and prohibit automatic employment decisions.

## 12. Workforce Planning Assessment

Create a separate scenario model: scenario, assumptions, scenario position changes, expected separations, planned recruitment and dated snapshots. It must be read-only with respect to operational records. Forecasts should label assumptions, source dates and uncertainty rather than presenting predictions as facts.

## 13. People Analytics Assessment

Operational reports exist but metrics are not centrally governed. Add a KPI catalogue with definition, owner, formula, numerator, denominator, period, filters, authoritative source and privacy classification. Build aggregate-first analytics; apply minimum cohort thresholds before exposing breakdowns.

## 14. Knowledge Base Assessment

The wiki already provides authenticated article CRUD and publication state. Extend it with policy owner, effective/review/retirement dates, version chain, approval status, attachments, taxonomy and role visibility. Only then add retrieval that searches published, current, authorised articles and returns citations.

## 15. Security & Privacy Assessment

Recent access-control hardening improved reports, benefit/training enrolments, uploads, application identity, password-reset token storage and integration SSRF defence. Advanced work must still address database-level tenant isolation, persistent secret management, MFA/SSO for privileged users, durable audit retention, malware scanning, document retention/deletion, AI consent/data processing, and least-privilege search indexes.

Cases, medical/benefit information, disciplinary records and AI prompts are sensitive-data classes. They require stricter roles, access audit events, retention schedules and secondary approval for exceptional access.

## 16. Database Changes Required

Use additive migrations only. Prioritised schema groups:

1. Employee 360 timeline projection/read model (or view), plus event references—not duplicate event data.
2. Position establishment and effective-dated occupancy.
3. Skills, competency scales, employee evidence and position requirements.
4. Workflow versions/transitions/conditions/SLA policies.
5. Alerts/rules/alert instances.
6. Knowledge-policy versioning and document metadata.
7. Scenarios, succession pools and career pathways after foundations.

## 17. API Changes Required

Expose scoped composition APIs rather than frontend fan-out: `GET /employees/:id/360`, `GET /employees/:id/timeline`, and typed read-only summary endpoints. Add workflow, alert and policy APIs only after their schemas and permission contracts exist. AI endpoints must call allowlisted server tools; no generic query or raw-SQL endpoint.

## 18. Shared Platform Services Required

| Service | Needed capability |
|---|---|
| Authorisation | Central policy checks, tenant scope, employee/team ownership |
| Audit | Sensitive-read/download/action audit events and immutable export/retention path |
| Eventing | Transactional domain events for timeline, alerts and analytics |
| Background work | Durable queue/worker for OCR, AI, alerts and scheduled recalculation |
| Search | Permission-filtered index with document ACL propagation |
| Configuration | Versioned metadata for workflows, forms, alerts and KPI definitions |
| AI gateway | Tool allowlist, consent, minimisation, citations, confirmation and audit |

## 19. Dependency Map

```text
Employee master + position establishment
  ├─ Employee 360 + lifecycle timeline
  ├─ Skills/competencies ──> career pathways ──> marketplace/succession
  └─ establishment ──> workforce scenarios

Workflow versions + notification + audit ──> approval inbox, forms, rules/alerts
Wiki + controlled documents ──> policy knowledge retrieval ──> AI Copilot
All capabilities ──> RBAC, tenant scope, audit, documents and data governance
```

## 20. Recommended Implementation Order

1. Employee 360 and lifecycle timeline.
2. Position establishment control.
3. Skills and competency architecture.
4. Workflow versioning and unified approval inbox.
5. Rules/early warning engine.
6. No-code forms.
7. Career pathways, succession and internal marketplace.
8. Workforce scenario planning.
9. Policy knowledge base lifecycle.
10. Controlled AI Copilot, intelligent documents, people analytics and AI recruitment.
11. Case management last, behind enhanced privacy controls.

## 21. Risks

| Risk | Mitigation |
|---|---|
| Duplicate truth across new modules | Derive from authoritative records and use references, not copies |
| AI data leakage or hallucination | Scoped tools, consent, citations, minimisation and human confirmation |
| Cross-tenant/employee disclosure | Central policy checks plus future database RLS |
| Workflow changes corrupt live cases | Version definitions; bind each instance to its starting version |
| Analytics misinterpretation | Governed KPI catalogue and visible definitions |
| High-impact automated decisions | Make recommendations advisory; record human decision and rationale |

## 22. Effort / Complexity Classification

Low: lifecycle timeline, unified approval inbox.  
Medium: Employee 360, early warning rules.  
High: skills, establishment, forms, career, knowledge base, intelligent documents, analytics, AI recruitment.  
Very high: AI Copilot, workflow builder, talent marketplace, succession, workforce planning and case management.

## 23. Quick Wins

1. Permission-aware Employee 360 read view.
2. Derived lifecycle timeline from existing contracts, training, performance and workflow records.
3. Unified approval queue over existing approval instances.
4. Contract/training/leave SLA rule alerts using the notification service.
5. Wiki policy effective/review dates and status filters.

## 24. Strategic Features

The highest long-term value—and architectural investment—lies in position establishment, skills/competency intelligence, versioned workflows, scenario planning, controlled knowledge retrieval, and an AI tool gateway. These enable the marketplace, succession, predictive alerts and explainable AI without creating siloed data.

## 25. First Implementation Task

**Implement a permission-aware Employee 360 API and profile shell with a derived lifecycle timeline.**

It reuses the existing employee, contracts, training, performance, leave, document, onboarding and offboarding modules; creates no duplicate HR record; validates data ownership; and supplies the foundation for the next phases. Before work begins, approve the final tab list, event categories, sensitive-tab role policy and retention/audit requirements.
