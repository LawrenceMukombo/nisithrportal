# NISIT HR Portal Requirements Gathering Checklist

**Project:** PNG NISIT Integrated HR Portal

**Purpose:** Capture, validate, prioritise and approve requirements before implementation or release.
**How to use:** Mark each item as **Confirmed**, **Not required**, **Needs decision**, or **Deferred**. Record the owner, evidence/source and approval date in the project register. A checked box means the requirement has been confirmed—not merely discussed.

## 1. Discovery governance

- [ ] Name the executive sponsor, product owner, HR process owner, ICT owner, security owner and data-protection owner.
- [ ] Define the project scope, release scope, exclusions and success measures.
- [ ] Agree the requirements baseline, change-control process and approval authority.
- [ ] Identify all stakeholder groups: executives, HR, payroll/finance, hiring managers, staff, applicants, ICT, legal/compliance and auditors.
- [ ] Schedule discovery workshops, process walkthroughs, data review and UAT sessions.
- [ ] Record every decision, assumption, issue, dependency and open question in one controlled register.
- [ ] Agree whether the portal is single-agency only or must support multiple agencies/tenants.

## 2. Current-state process and policy discovery

- [ ] Collect current HR policies, procedures, delegations, templates, forms, registers and service-level targets.
- [ ] Map the current process for recruitment, appointment, onboarding, transfer, acting appointment, contract renewal, leave, performance, training, benefits, housing and offboarding.
- [ ] Identify manual approvals, spreadsheets, shared drives, email inboxes and external systems to be retired or integrated.
- [ ] Confirm statutory, public-service, PNG government and institutional rules that govern each process.
- [ ] Identify pain points, duplicate data entry, delays, missing controls and reporting gaps.
- [ ] Define which legacy records must be migrated, retained, archived or excluded.

## 3. Users, roles and access

- [ ] Confirm every user population: applicant, employee, manager, HR officer, HR manager, executive, system administrator, auditor and integration account.
- [ ] Define role permissions by module and action: view, create, edit, delete, approve, export, sign, administer and audit.
- [ ] Define team/manager scope, HR scope, executive scope and cross-agency access rules.
- [ ] Confirm who may view sensitive data: NID/passport, date of birth, medical/leave attachments, benefits, housing, disciplinary/case material and salary.
- [ ] Define delegation, temporary acting authority, revocation and emergency-access rules.
- [ ] Confirm staff identity source, applicant registration/verification process, password policy, MFA/SSO requirements and inactive-user treatment.
- [ ] Approve an access-review cadence and offboarding deprovisioning SLA.

## 4. Employee master and organisation

- [ ] Confirm mandatory employee fields, validation rules, data owners and evidence requirements.
- [ ] Confirm employee number format, naming conventions, status values, employment types and effective-date rules.
- [ ] Confirm departments, divisions, locations, cost centres, grades, reporting lines and acting arrangements.
- [ ] Confirm the authoritative source for each field and whether it is editable by employee, manager, HR or administrator.
- [ ] Confirm duplicate-person matching rules and merge/correction authority.
- [ ] Confirm employable-age, appointment-date, retirement-date and probation-date rules.
- [ ] Confirm historical transfer, promotion, grade and supervisor-change requirements.

## 5. Position establishment and workforce control

- [ ] Define approved position number, title, grade, department, location, funding source and effective dates.
- [ ] Define establishment states: approved, filled, vacant, frozen, abolished and proposed.
- [ ] Confirm whether one position may have multiple incumbents and how headcount is calculated.
- [ ] Confirm vacancy creation approval, requisition linkage and budget validation requirements.
- [ ] Define who can create, change, freeze or abolish a position and required approval levels.
- [ ] Confirm required establishment reports and audit evidence.

## 6. Recruitment and applicant management

- [ ] Define requisition, advertisement, approval, publication, closing, extension and withdrawal workflows.
- [ ] Confirm mandatory vacancy fields, screening questions, eligibility checks and public visibility rules.
- [ ] Confirm applicant account, email verification, duplicate application and withdrawal rules.
- [ ] Define application stages, allowed transitions, ownership, SLA and automated communications.
- [ ] Confirm shortlisting, panel membership, conflict-of-interest declarations, scoring criteria and consensus rules.
- [ ] Confirm interview scheduling, assessments, reference checks, background checks and offer approvals.
- [ ] Define candidate retention, consent, document access and deletion/archival requirements.
- [ ] Confirm whether internal applicants require a distinct pathway and what data HR may see.

## 7. Employment lifecycle

- [ ] Define appointment, probation, confirmation, transfer, promotion, acting, secondment, renewal, separation and retirement events.
- [ ] Confirm which source records create each lifecycle event and who may correct it.
- [ ] Define Employee 360 tabs, sensitive-tab access policy and timeline event categories.
- [ ] Confirm onboarding tasks, owners, due dates, dependencies, evidence and completion conditions.
- [ ] Confirm offboarding trigger types, notice periods, asset return, access revocation, exit interview and final clearance requirements.
- [ ] Define employee notification requirements for every lifecycle event.

## 8. Contracts and HR letters

- [ ] Confirm contract types, start/end-date rules, permanent versus fixed-term treatment and renewal conditions.
- [ ] Define expiry, probation and renewal alerts, including non-applicable-date handling.
- [ ] Approve contract and HR-letter templates, variable list, approval/signatory sequence and official wording.
- [ ] Confirm signed-document upload, replacement, versioning, supersession, deletion and audit requirements.
- [ ] Define digital-signature, stamp, verification code and certificate requirements.
- [ ] Confirm who can generate, approve, sign, download and externally share each document type.

## 9. Leave, attendance, benefits and housing

- [ ] Define leave categories, entitlements, accrual, carry-over, blackout dates, public holidays and evidence rules.
- [ ] Define leave calculation: calendar days versus working days, half-days, overlaps and non-applicable dates.
- [ ] Confirm leave approval routing, delegation, escalation, cancellation and balance-adjustment authority.
- [ ] Define attendance sources, location/time rules, corrections, overtime, exceptions and manager approval.
- [ ] Define benefit catalogue, enrolment eligibility, contribution fields, beneficiaries, effective/expiry dates and confidentiality.
- [ ] Define housing schemes, eligibility, supporting documents, review stages, approval limits and payment/integration needs.

## 10. Training, performance and development

- [ ] Define training catalogue, mandatory training, enrolment, completion evidence, certificate expiry and renewal rules.
- [ ] Define performance cycle, goals/OKRs, rating scale, moderation, acknowledgements and overdue-review escalation.
- [ ] Confirm manager, employee and HR permissions for reviews, comments and final ratings.
- [ ] Confirm development plans, mentoring, leadership programmes and career-interest information.
- [ ] Define which fields are sensitive and excluded from general manager or employee views.

## 11. Documents, knowledge and records management

- [ ] Classify document types and assign owner, access level, retention period and legal-hold policy.
- [ ] Confirm upload formats, size limits, malware scanning, quarantine and content validation requirements.
- [ ] Define document metadata, versioning, expiry tracking, verification and replacement rules.
- [ ] Define search permissions; search results must never bypass document access control.
- [ ] Confirm policy/knowledge-base article lifecycle: draft, review, publish, effective, superseded, archive and delete.
- [ ] Confirm attachment, screenshot, image and file-upload rules for the wiki/help module.

## 12. Workflows, approvals and notifications

- [ ] List every approval-producing process and its authoritative record.
- [ ] Define approval steps, roles, conditional routing, quorum, return/resubmit, rejection and cancellation rules.
- [ ] Define delegation, acting approver, escalation, reminder, due-date and breach rules.
- [ ] Confirm whether workflow definitions require versioning and how running instances remain unchanged.
- [ ] Define the Unified Approval Inbox filters, sorting, bulk actions, audit details and notification channels.
- [ ] Confirm email, in-app, SMS or other notification templates, triggers, sender identities and opt-out rules.

## 13. Reporting, dashboards and exports

- [ ] List each KPI, business definition, numerator, denominator, source, owner, frequency and approved audience.
- [ ] Confirm dashboard cards, drilldowns, filters, date ranges and empty-state behaviour.
- [ ] Define report formats: screen, CSV, XLSX, PDF and scheduled delivery.
- [ ] Confirm export permissions, watermarks, retention, download audit events and data masking requirements.
- [ ] Define reconciliation reports against source systems and acceptable variance.
- [ ] Confirm privacy thresholds for small groups and sensitive demographic breakdowns.

## 14. Integrations and technical architecture

- [ ] Identify each upstream/downstream system: identity/SSO, payroll, finance, email, storage, biometric attendance, SMS and government services.
- [ ] Confirm API owner, purpose, data fields, direction, frequency, failure handling, retries and reconciliation.
- [ ] Confirm integration authentication, secret storage, IP/domain allowlist, TLS and data-processing agreement requirements.
- [ ] Confirm object storage location, encryption, backup, recovery and document URL/access model.
- [ ] Define scheduled jobs, queue/worker needs, monitoring, alerting and idempotency requirements.
- [ ] Confirm non-production environments, anonymised test data, release process, CI/CD and rollback procedure.

## 15. Security, privacy and compliance

- [ ] Complete a data inventory and classify public, internal, confidential and highly sensitive HR data.
- [ ] Confirm retention, archive, deletion, legal-hold, subject-access and correction procedures.
- [ ] Confirm encryption in transit/at rest, key/secret management, backup encryption and recovery testing.
- [ ] Require least privilege, tenant isolation, audit logging for sensitive reads/downloads and periodic access reviews.
- [ ] Confirm MFA/SSO requirements for privileged roles and secure session/token design.
- [ ] Define incident response, breach notification, vulnerability management, penetration testing and audit evidence requirements.
- [ ] Define AI governance: consent, permitted data, model/vendor approval, data residency, prompt retention, human review and prohibited automated decisions.

## 16. Advanced features discovery

- [ ] Employee 360: approve tabs, data sources, event categories and sensitive-information policy.
- [ ] Skills: approve taxonomy, proficiency scale, verification sources, expiry/evidence and position requirements.
- [ ] Position establishment: approve authoritative establishment controls before workforce planning.
- [ ] Workflow builder: approve configuration ownership, versioning and guardrails before no-code design.
- [ ] Alerts: approve rules, recipients, escalation policy and distinction between rules and predictions.
- [ ] Knowledge assistant: approve policy sources, citation rules and retrieval permissions before AI chat.
- [ ] AI recruitment/talent matching: approve explanation, human review, fairness testing and prohibited data use.
- [ ] Case management: define restricted roles, case classification, evidence, retention and audit before any build.

## 17. Data migration and quality

- [ ] Identify source systems, data owners, extracts, field mapping and transformation rules.
- [ ] Define duplicate resolution, missing values, invalid dates, orphan records and rejected-record treatment.
- [ ] Confirm migration rehearsals, reconciliation totals, sampling plan and business acceptance criteria.
- [ ] Confirm legacy document migration, access labels and evidence of completeness.
- [ ] Obtain written sign-off before production migration; preserve source backup and rollback plan.

## 18. UAT, release and operational readiness

- [ ] Write role-based end-to-end UAT scenarios from vacancy to hire and employee exit.
- [ ] Include negative permission tests, date-rule tests, notification tests, document access tests and export tests.
- [ ] Define performance, accessibility, browser/device, backup/restore and security test acceptance criteria.
- [ ] Confirm training, user guides, help/wiki content, support model and service-desk escalation path.
- [ ] Confirm go-live checklist, downtime communication, support coverage, monitoring and post-go-live review.
- [ ] Obtain formal approval from HR, ICT/security, executive sponsor and data owner.

## 19. Requirement record template

| ID | Requirement | Module | Priority | Owner | Source/Evidence | Acceptance criteria | Status | Approval |
|---|---|---|---|---|---|---|---|---|
| HR-001 | Example: Manager approves annual leave above five days | Leave/Workflow | Must | HR Director | Leave policy | Routed to manager then HR; actions audited | Needs decision | |

## 20. Final sign-off checklist

- [ ] All must-have requirements have owners and measurable acceptance criteria.
- [ ] All policy decisions and workflow exceptions are approved in writing.
- [ ] Sensitive-data access, retention and audit requirements are approved by ICT/security and HR.
- [ ] Integration owners approve field mappings and operational support commitments.
- [ ] Data migration approach and quality thresholds are approved.
- [ ] UAT exit criteria, release plan and rollback plan are approved.
- [ ] Deferred requirements are prioritised into a future roadmap and do not block go-live.

---

**Approval:** This checklist becomes the project baseline only after it is reviewed and signed by the nominated HR, ICT/security and executive owners.
