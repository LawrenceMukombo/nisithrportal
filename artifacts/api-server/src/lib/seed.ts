import { and, eq, count, isNull, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, rolesTable, agenciesTable, departmentsTable, positionsTable, jobsTable, usersTable, candidatesTable, permissionsTable, rolePermissionsTable, wikiArticlesTable, employeesTable } from "@workspace/db";
import { logger } from "./logger";
import { seedCompleteData, seedPrdReferenceData } from "./seed-data";

const DEFAULT_ROLES = [
  { name: "admin", permissions: { all: true } },
  { name: "hr_officer", permissions: { jobs: true, applications: true, candidates: true, employees: true, contracts: true, documents: ["read", "create", "delete", "sign", "stamp"] } },
  { name: "hiring_manager", permissions: { applications: ["read", "review", "screen", "interview", "shortlist"], candidates: ["read"] } },
  { name: "executive", permissions: { dashboard: true, employees: ["read"], contracts: ["read"], documents: ["read", "sign", "stamp"], applications: ["read", "hire"] } },
  { name: "applicant", permissions: { jobs: ["read"], applications: ["create", "read"] } },
];

const DEFAULT_PERMISSION_GRANTS = [
  // Document management, digital signing, and official statutory stamping
  { role: "admin", resource: "documents", action: "sign", scope: "organisation" },
  { role: "admin", resource: "documents", action: "stamp", scope: "organisation" },
  { role: "admin", resource: "documents", action: "read", scope: "organisation" },
  { role: "admin", resource: "documents", action: "create", scope: "organisation" },
  { role: "admin", resource: "documents", action: "delete", scope: "organisation" },

  { role: "hr_officer", resource: "documents", action: "sign", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "stamp", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "read", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "create", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "delete", scope: "organisation" },

  { role: "executive", resource: "documents", action: "sign", scope: "organisation" },
  { role: "executive", resource: "documents", action: "stamp", scope: "organisation" },
  { role: "executive", resource: "documents", action: "read", scope: "organisation" },

  // Job application recruitment workflow accountability
  { role: "admin", resource: "applications", action: "screen", scope: "organisation" },
  { role: "admin", resource: "applications", action: "shortlist", scope: "organisation" },
  { role: "admin", resource: "applications", action: "interview", scope: "organisation" },
  { role: "admin", resource: "applications", action: "offer", scope: "organisation" },
  { role: "admin", resource: "applications", action: "hire", scope: "organisation" },

  { role: "hr_officer", resource: "applications", action: "screen", scope: "organisation" },
  { role: "hr_officer", resource: "applications", action: "shortlist", scope: "organisation" },
  { role: "hr_officer", resource: "applications", action: "interview", scope: "organisation" },
  { role: "hr_officer", resource: "applications", action: "offer", scope: "organisation" },
  { role: "hr_officer", resource: "applications", action: "hire", scope: "organisation" },

  { role: "hiring_manager", resource: "applications", action: "screen", scope: "department" },
  { role: "hiring_manager", resource: "applications", action: "shortlist", scope: "department" },
  { role: "hiring_manager", resource: "applications", action: "interview", scope: "department" },

  { role: "executive", resource: "applications", action: "hire", scope: "organisation" },
];

const NISIT_AGENCY_NAME = "PNG National Institute of Standards and Industrial Technology";

async function seedWikiArticles(): Promise<void> {
  const [admin] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, "admin@nisit.gov.pg"));
  if (!admin) return;

  const articles = [
    {
      title: "PNG NISIT HR Portal: System Overview & Architecture",
      slug: "system-overview",
      category: "Getting Started",
      summary: "High-level overview of the PNG National Institute of Standards and Industrial Technology (NISIT) Human Resource Information System.",
      published: true,
      content: `## 1. System Overview
The PNG NISIT HR Portal is a unified, digital Human Resource Information System (HRIS) designed to streamline statutory workforce planning, talent acquisition, employee service delivery, establishment control, and executive reporting.

### Core Architectural Pillars
- **Public Recruitment & Applicant Portal**: Fast, accessible job application workflow with automated CV parsing, screening question scoring, and draft persistence.
- **Talent Pipeline**: Multi-stage review workflow (Applied → Screening → Assessment → Interview → Offer → Hired → Onboarding) with cross-functional panel evaluations.
- **Statutory Organizational Hierarchy**: Real-time interactive establishment structure builder, Director General / CEO configuration, and division staff allocations.
- **Employee Lifecycle Management**: Complete staff records, digital personnel files, grade level tracking, and emergency contacts.
- **Employee Self-Service (ESS)**: Leave requests, attendance timesheets, training nominations, and benefits enrollments.
- **Executive Governance & Compliance**: Audit trails, RBAC permission matrix, contract expiry warnings, and statutory establishment ceilings.

### Navigation Overview
- **Overview**: Executive Dashboard, Strategic Briefing, and Organizational Hierarchy.
- **Recruitment**: Vacancy Management, Candidate Applications, Shortlisted Pipeline, Candidate CRM, and Automated Workflow.
- **People Management**: Employee Directory, Digital Onboarding, Contract Management, and Offboarding Clearance.
- **Employee Services**: Leave & Absence, Attendance Timesheets, Performance Reviews & OKRs, Housing & Benefits, and Training Catalog.
- **Administration**: User Accounts & Roles, Statutory Documents, and this living Help & User Guide Wiki.`,
    },
    {
      title: "Public Job Board & Applicant Portal Guide",
      slug: "job-vacancies-applicant-portal",
      category: "Recruitment",
      summary: "How external candidates and internal staff search vacancies, track applications, and manage applicant accounts.",
      published: true,
      content: `## 1. Finding & Filtering Vacancies
1. Navigate to **Job Vacancies** or the public portal landing page.
2. Filter positions by **Division / Department**, **Employment Type** (Permanent, Fixed-Term Contract, Secondment), or **Location / Province**.
3. Use the search bar to find positions by title, keyword, or minimum qualification requirements.
4. Review key job criteria: **Grade Level**, **Closing Date**, **Remuneration / Salary Band**, and **Core Responsibilities**.

## 2. Submitting an Application
- Click **Apply Now** on any open vacancy before the advertised closing date.
- Complete the 8-stage digital wizard:
  1. **Personal Information**: Legal names, date of birth, gender, and national identification.
  2. **Contact Details**: Residential address, phone numbers, and permanent email.
  3. **Position & Availability**: Notice period, expected start date, and relocation preferences.
  4. **Education & Credentials**: Tertiary degrees, diplomas, institutions, and completion years.
  5. **Work Experience**: Previous employers, job titles, key responsibilities, and achievements.
  6. **Skills & Competencies**: Technical proficiencies, language capabilities, and personal statement.
  7. **Documents & Resume**: PDF CV upload, cover letter, and certified qualification certificates.
  8. **Statutory Screening & Declarations**: Mandatory compliance answers, conflict of interest declarations, and consent to background checks.

## 3. Application Tracking & Status Updates
- Sign in to your applicant account to view **My Applications**.
- Each application displays real-time stage badges: **Application Received**, **CV Screening**, **Assessment**, **Interview**, **Offer Extended**, or **Outcome Determined**.`,
    },
    {
      title: "Recruitment Pipeline & Shortlisting Management",
      slug: "recruitment-shortlisting-pipeline",
      category: "Recruitment",
      summary: "Operational guide for HR Officers and Hiring Managers to screen candidates, score qualifications, and manage shortlisted applicants.",
      published: true,
      content: `## 1. Candidate Review & Screening
1. Navigate to **Applications** or **Shortlisted Candidates** from the Recruitment menu.
2. Filter applications by status (**Pending Review**, **Screening**, **Interview**, **Offer**, **Hired**).
3. Open any application to review the candidate's complete profile dossier:
   - AI Match & Compatibility Score
   - Verified Educational Qualifications
   - Chronological Employment History
   - Statutory Declarations & Screening Answers
   - Downloadable CV and Supporting Documents

## 2. Moving Candidates Across Workflow Stages
- **Advance to Shortlist**: Moves the applicant from preliminary CV review into the departmental shortlist.
- **Schedule Interview**: Queues candidate for panel interview scheduling and email notifications.
- **Advance to Offer**: Generates formal employment contract and offer letter.
- **Reject with Notification**: Sends polite, standardized outcome notification to unsuccessful applicants.

## 3. Bulk Selection & Batch Actions
- Use the table checkboxes to select multiple candidates for batch status transitions (e.g. moving 10 candidates to Interview stage in one click).
- Export shortlisted lists to Excel or printable PDF format for panel briefing meetings.`,
    },
    {
      title: "Interactive Organizational Hierarchy & Drag-and-Drop Structure Builder",
      slug: "organizational-hierarchy-builder",
      category: "Organizational Structure",
      summary: "How administrators and HR leaders visualize reporting lines, drag and drop personnel across divisions, and modify establishment ceilings.",
      published: true,
      content: `## 1. Viewing Organizational Diagrams
1. Open **Org Hierarchy** from the main navigation menu.
2. The **Org Chart Diagram** tab renders the full statutory hierarchy of NISIT:
   - Office of the Director General / Chief Executive Officer
   - Executive Divisions (Administration, Finance, Human Resources, Industrial Development, Information Technology, Operations)
   - Real-time KPI summaries: **Total Headcount**, **Filled Positions**, **Vacant Establishment Slots**, and **Approved Ceilings**.

## 2. Using the Interactive Structure Builder (Drag & Drop)
1. Select the **Structure Builder (Drag & Drop)** tab.
2. Drag position chips or staff cards between division containers to instantly reassign reporting units:
   - Moving a **Position** updates the department allocation for that role and all attached vacancies.
   - Moving an **Assigned Officer** reassigns the employee's department in their employee profile.
3. Click **Add Division** to create a new organizational branch with custom division code.
4. Click **Save Structure** to persist all reassignments, new positions, and division changes to the database.

## 3. Changing the Director General / CEO Position
1. Click the **Change CEO / Director General** button at the top of the Org Hierarchy page.
2. Either select an existing senior staff member from the dropdown or input custom executive credentials (Title, Full Name, Official Email, Grade Level).
3. Click **Save Executive Position** to immediately update the root apex of the organizational hierarchy across all executive reports.`,
    },
    {
      title: "Employee Records & Personnel Management",
      slug: "employee-management-records",
      category: "People Management",
      summary: "Comprehensive handbook for maintaining statutory employee profiles, grade levels, emergency contacts, and position history.",
      published: true,
      content: `## 1. Employee Directory
1. Navigate to **Employees** under People Management.
2. The employee directory provides sortable, searchable staff records with active status indicators, department tags, and grade level classifications.
3. Filter by department, status (Active, On Leave, Probation, Suspended, Separated), or search by staff name / employee number.

## 2. Maintaining Employee Profiles
- **Personal Information**: Full name, Date of Birth, Gender, National ID / Passport, and Residential Address.
- **Employment Information**: Division, Position Title, Grade Level (Grade 10 to Grade 20), Employment Type (Permanent, Contract), and Supervisor.
- **Emergency Contacts**: Primary contact name, phone number, relationship, and residential address.
- **Position History**: Audit log tracking appointments, promotions, transfers, and acting appointments over time.

## 3. Creating & Onboarding New Employees
- Click **New Employee** to register a staff member.
- When an applicant accepts a job offer, the system allows one-click conversion of candidate dossiers into official employee records.`,
    },
    {
      title: "Leave & Absence Management",
      slug: "leave-absence-management",
      category: "Employee Services",
      summary: "Procedures for submitting leave applications, supervisor approvals, balance computations, and public holiday calendars.",
      published: true,
      content: `## 1. Applying for Leave (Employee Self-Service)
1. Navigate to **Leave & Absence** under Employee Services.
2. Click **Apply for Leave**.
3. Choose the appropriate statutory leave category:
   - **Annual Recreation Leave**
   - **Sick Leave** (requires medical certificate attachment for >2 days)
   - **Maternity / Paternity Leave**
   - **Compassionate & Bereavement Leave**
   - **Study / Examination Leave**
   - **Leave Without Pay (LWOP)**
4. Select valid Start and End dates. The system automatically computes working days excluding weekends and gazetted PNG public holidays.
5. Provide handover officer details and submit for supervisor endorsement.

## 2. Supervisor & HR Approval Workflow
- Line managers receive instant portal notifications for pending leave endorsements.
- Managers can **Approve**, **Reject with Comment**, or **Request Modification**.
- Approved leave immediately updates the employee's remaining leave balance and marks their attendance schedule as on-leave.`,
    },
    {
      title: "Attendance Tracking & Timesheets",
      slug: "attendance-timesheets",
      category: "Employee Services",
      summary: "Monitoring daily staff attendance, biometric clock-ins, manual timesheets, and overtime logs.",
      published: true,
      content: `## 1. Daily Check-In & Check-Out
- Staff can record their daily clock-in and clock-out timestamps via the portal dashboard or designated kiosk terminals.
- The system automatically tags attendance status: **Present**, **Late**, **Half-Day**, **On Leave**, or **Absent**.

## 2. Timesheet Review & Overtime Endorsements
- HR Officers and Line Managers can review monthly attendance logs for their division.
- Overtime hours are automatically calculated based on statutory working hours (40 hours/week) for payroll processing.`,
    },
    {
      title: "Performance Appraisals & OKR Management",
      slug: "performance-goals-okrs",
      category: "Employee Services",
      summary: "Annual appraisal cycles, goal setting, self-assessments, and 360-degree managerial evaluations.",
      published: true,
      content: `## 1. Annual Appraisal Cycles
1. HR Administrators initiate structured appraisal cycles (e.g. Annual Review, Mid-Year Review, Probation Review).
2. Staff receive automated prompts to complete their **Self-Evaluation** across defined Key Performance Indicators (KPIs) and core institutional competencies.

## 2. Setting Departmental & Individual OKRs
- Staff and supervisors collaborate on setting quarterly Objectives and Key Results (OKRs).
- Progress sliders allow real-time tracking of goal milestones throughout the operational year.
- Performance scores directly feed into promotion recommendations, training nominations, and annual increment eligibility.`,
    },
    {
      title: "Contracts, Compensation & Benefits Schemes",
      slug: "housing-allowances-benefits",
      category: "People Management",
      summary: "Managing employment contracts, expiration alerts, statutory housing schemes, and medical benefits.",
      published: true,
      content: `## 1. Fixed-Term Contracts & Secondments
- Navigate to **Contracts** under People Management to view all active, renewing, and expiring staff contracts.
- Automated system alerts flag contracts expiring within 90, 60, and 30 days to facilitate timely renewal or gratuity calculations.

## 2. Housing Schemes & Allowances
- Review institutional housing allocations and rental allowance schedules under **Housing & Benefits**.
- Track employee eligibility based on grade levels and divisional postings.`,
    },
    {
      title: "Training & Professional Development Catalog",
      slug: "training-development-catalog",
      category: "Employee Services",
      summary: "Course catalog, staff training nominations, skills gap tracking, and certification records.",
      published: true,
      content: `## 1. Browsing the Course Catalog
1. Open **Training & Development** from the Employee Services menu.
2. Explore available statutory accreditation courses, standards training (ISO/IEC), compliance workshops, and executive leadership seminars.

## 2. Nominations & Certifications
- Supervisors can nominate team members for specialized technical workshops.
- Completed courses issue digital certificates that are automatically linked to the employee's permanent skills matrix and personnel profile.`,
    },
    {
      title: "Onboarding & Offboarding Clearance Workflows",
      slug: "onboarding-offboarding-workflows",
      category: "People Management",
      summary: "Step-by-step checklists for welcoming new recruits and executing separation / clearance protocols.",
      published: true,
      content: `## 1. Digital Onboarding
- Automated onboarding tasks are assigned across HR, IT, Finance, and Facilities upon hiring a new employee:
  - IT Asset Provisioning (Laptop, Email, System Access)
  - ID Card Issuance & Biometric Registration
  - Superannuation (Nasfund/Nambawan Super) Enrollment
  - Code of Conduct & Public Service Orientation

## 2. Offboarding & Asset Clearance
- Formal separation workflows for resignation, retirement, end-of-contract, or transfer.
- Departmental clearance checklists ensure return of institutional property, access revocation, and calculation of final terminal benefits.`,
    },
    {
      title: "Role-Based Access Control (RBAC) & Security Governance",
      slug: "security-rbac-audit-logs",
      category: "Administration",
      summary: "Security protocols, user roles, permission grants, audit logs, and data privacy governance.",
      published: true,
      content: `## 1. Standard System Roles
- **System Admin**: Full unrestricted access across all agency records, user accounts, system configuration, and audit logs.
- **HR Officer**: Full management of jobs, candidate applications, shortlisting, employee profiles, contracts, leave, and letters.
- **Hiring Manager**: Divisional read and review access to applications and candidates allocated to their department.
- **Executive**: Strategic dashboard reporting, employee establishment summaries, and high-level analytics.
- **Applicant / Public User**: Restricted to browsing vacancies, submitting applications, and managing personal profile details.

## 2. Real-Time RBAC & Audit Trail
- Every administrative action (role change, profile update, salary adjustment, structure change, approval decision) is immutably recorded in the **Audit Log** with user timestamps, IP addresses, and before/after payloads.
- Role upgrades take effect instantly across active user sessions.`,
    },
    {
      title: "System Release Notes, Features & Bug Fixes (Changelog)",
      slug: "release-notes-changelog",
      category: "System Updates",
      summary: "Living record of platform enhancements, latest features, architectural upgrades, and resolved issues.",
      published: true,
      content: `## Version 1.2.0 (Current Release)

### 🚀 Major Features & Enhancements
1. **Interactive Organizational Structure Builder**:
   - Drag-and-drop hierarchy builder allowing visual reassignment of positions and employees across divisions.
   - Dynamic Director General / CEO position editor for real-time leadership apex updates.
   - Live establishment metrics tracking total headcount, filled positions, vacancies, and approved ceilings.

2. **Shortlisting & Candidate Review Hub**:
   - Upgraded candidate pipeline supporting multi-stage transitions (Screening, Assessment, Interview, Offer).
   - Candidate dossiers showing AI match score, contact info, and certified documents.
   - Real-time search and filter tabs across candidate names, job titles, and review stages.

3. **Help & User Guide Wiki**:
   - Comprehensive living documentation covering all 14 HRIS operational modules.
   - Searchable knowledge base with category filters and printable article views.
   - Official downloadable Word handbooks (End-to-End Manual, Staff User Guide, Applicant Guide).

4. **Real-Time Role Resolution & Dynamic RBAC**:
   - Instant permission synchronization when user roles are updated in the admin panel.
   - Single-tenant NISIT agency scoping fallback ensuring zero record isolation for newly converted administrators.

### 🛠️ Resolved Issues & Bug Fixes
- **Fixed Hierarchy Persistence Route Mismatch**: Corrected Express route path mounting for \`/org-chart/structure\` and \`/org-chart/executive\`, ensuring smooth persistence and authorization for structure changes.
- **Resolved Admin Conversion Data Visibility**: Ensured dynamic database role lookup in \`authMiddleware\` so converted admin accounts immediately access all records.
- **Cleaned Up Route Typing & Joins**: Fixed position table joins and type safety in Performance, Training, and Storage routes.`,
    },
  ];

  for (const article of articles) {
    await db.insert(wikiArticlesTable).values({
      ...article,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    }).onConflictDoUpdate({
      target: wikiArticlesTable.slug,
      set: {
        title: article.title,
        category: article.category,
        summary: article.summary,
        content: article.content,
        published: article.published,
        updatedAt: new Date(),
      },
    });
  }
}

/** Add a fixed number of days to a date and return YYYY-MM-DD string. */
function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Past date for closed vacancies (already closed). */
function pastDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function vacancies(deptMap: Record<string, number>, agencyId: number) {
  const hr = deptMap["Human Resources"]!;
  const fin = deptMap["Finance"]!;
  const it = deptMap["Information Technology"]!;
  const ops = deptMap["Operations"]!;
  const sm = deptMap["Standards and Metrology"]!;
  const ind = deptMap["Industrial Development"]!;
  const rd = deptMap["Research and Development"]!;
  const adm = deptMap["Administration"]!;

  return [
    // ── Human Resources ───────────────────────────────────────────────────
    {
      title: "HR Officer – Recruitment & Selection (Grade 12)",
      description: `## Overview
The HR Officer – Recruitment & Selection is responsible for coordinating end-to-end recruitment activities across all divisions of PNG NISIT. This role ensures that recruitment processes are transparent, merit-based, and compliant with the Public Services (Management) Act 2014 and relevant Public Service General Orders.

## Key Responsibilities
- Manage the full recruitment lifecycle: job advertising, shortlisting, interview coordination, referee checks, and appointment letters
- Liaise with line managers and department heads to develop accurate position descriptions and selection criteria
- Maintain the Applicant Tracking System and ensure all candidate records are accurate and up-to-date
- Prepare recruitment reports for the HR Manager and senior executive team
- Advise hiring managers on merit-based selection principles and ensure EEO compliance
- Coordinate onboarding activities for newly appointed officers

## Required Qualifications
- Bachelor's degree in Human Resource Management, Business Administration, or related discipline
- Minimum 3 years of HR experience, preferably in the Papua New Guinea public sector
- Sound knowledge of PNG Public Service General Orders and the Public Services (Management) Act
- Proficient in Microsoft Office Suite; experience with HRIS or ATS platforms desirable
- Strong written and verbal communication skills in English

## Desirable Attributes
- Postgraduate qualification in HRM or related field
- Experience with competency-based interviewing techniques
- Demonstrated ability to manage multiple concurrent recruitment campaigns
- Commitment to Equal Employment Opportunity and gender-inclusive hiring practices`,
      departmentId: hr,
      agencyId,
      status: "open",
      closingDate: addDays(43),
    },
    {
      title: "Learning & Development Coordinator",
      description: `## Overview
The Learning & Development Coordinator supports the design, delivery, and evaluation of training and professional development programs for all NISIT staff. The incumbent works closely with the HR Manager and department heads to identify capability gaps and implement targeted development initiatives aligned to NISIT's Strategic Plan 2024–2028.

## Key Responsibilities
- Conduct Training Needs Analysis (TNA) across all divisions and produce an Annual Training Plan
- Source, coordinate, and evaluate internal and external training programs, workshops, and seminars
- Manage relationships with registered training organisations (RTOs) and tertiary institutions
- Maintain accurate training records and produce reports on training outcomes and ROI
- Develop and maintain an e-learning library and coordinate access for all staff
- Support succession planning initiatives and mentoring programs

## Required Qualifications
- Bachelor's degree in Human Resource Management, Education, Organisational Psychology, or equivalent
- Minimum 2 years of experience in a learning and development or training coordination role
- Strong project management skills; ability to plan and deliver multiple programs simultaneously
- Familiarity with adult learning principles and competency frameworks
- Proficient in Microsoft Office Suite and experience with LMS platforms

## Desirable Attributes
- Certificate IV in Training and Assessment (TAE40122) or equivalent
- Knowledge of PNG Government capacity-building frameworks
- Experience designing blended learning solutions (face-to-face + digital)`,
      departmentId: hr,
      agencyId,
      status: "open",
      closingDate: addDays(57),
    },

    // ── Finance ───────────────────────────────────────────────────────────
    {
      title: "Senior Finance Analyst",
      description: `## Overview
The Senior Finance Analyst provides high-quality financial analysis, budgeting, and reporting support to NISIT's Director Finance and senior leadership. The role ensures accurate and timely financial information is available to support evidence-based decision-making and government accountability requirements.

## Key Responsibilities
- Prepare monthly, quarterly, and annual financial statements and management reports in compliance with the Public Finances (Management) Act 1995
- Lead the annual budget formulation process, coordinating input from all cost-centre managers
- Conduct variance analysis and forecast updates; identify risks and recommend corrective actions
- Liaise with the Department of Finance and Treasury, Auditor General's Office, and PNGIPA on financial compliance matters
- Maintain the chart of accounts and ensure proper cost allocation across programs and projects
- Supervise a small team of finance officers and provide on-the-job coaching

## Required Qualifications
- Bachelor's degree in Accounting, Finance, or Commerce; CPA PNG membership (or equivalent) highly regarded
- Minimum 5 years of professional finance experience, with at least 2 years in the public sector
- Proficiency in government financial management systems (e.g., FinPlus, TechOne, or equivalent)
- Strong analytical skills and advanced Excel proficiency
- Excellent attention to detail and ability to meet strict reporting deadlines

## Desirable Attributes
- Postgraduate qualification in Finance or Accounting
- Experience managing government appropriations and supplementary budgets
- Knowledge of IPSAS (International Public Sector Accounting Standards)`,
      departmentId: fin,
      agencyId,
      status: "open",
      closingDate: addDays(38),
    },
    {
      title: "Procurement & Contracts Officer",
      description: `## Overview
The Procurement & Contracts Officer is responsible for all procurement activities at NISIT, ensuring compliance with the Public Procurement Act 2018 and the Government's procurement policies. The role manages the full procurement cycle from needs identification through contract management and supplier performance evaluation.

## Key Responsibilities
- Plan and execute procurement processes including open tenders, limited tenders, and direct procurement in line with approved thresholds
- Prepare tender documents, evaluation criteria, and bid evaluation reports for the Contracts Committee
- Manage supplier relationships and monitor contract KPIs and deliverables
- Maintain the procurement register and ensure all acquisitions are accurately documented
- Advise budget holders on procurement rules, approved suppliers, and value-for-money principles
- Coordinate with Finance on payment scheduling and budget availability checks

## Required Qualifications
- Bachelor's degree in Business Administration, Finance, Supply Chain Management, or related field
- Minimum 3 years of procurement experience; public-sector experience strongly preferred
- Knowledge of the Public Procurement Act 2018 and associated regulations
- Strong contract management and negotiation skills
- High level of integrity and commitment to transparency in public spending

## Desirable Attributes
- Professional membership with CIPS (Chartered Institute of Procurement & Supply) or equivalent
- Experience with e-procurement platforms
- Familiarity with World Bank or ADB procurement guidelines`,
      departmentId: fin,
      agencyId,
      status: "draft",
      closingDate: addDays(65),
    },

    // ── Information Technology ────────────────────────────────────────────
    {
      title: "Senior Software Developer – Enterprise Systems",
      description: `## Overview
The Senior Software Developer is responsible for the design, development, and maintenance of NISIT's enterprise applications and digital services. The incumbent leads technical delivery across the organisation's software portfolio and mentors junior developers within the ICT Division.

## Key Responsibilities
- Architect, develop, test, and deploy enterprise web applications using modern full-stack technologies
- Lead code reviews and enforce coding standards, security best practices, and performance benchmarks
- Integrate internal systems with government shared-services platforms (PNGID, eTax, GovPay)
- Manage technical backlogs in collaboration with business analysts and department stakeholders
- Document system architectures, APIs, and data flows to ensure maintainability
- Support DevSecOps practices including CI/CD pipeline management and vulnerability remediation

## Required Qualifications
- Bachelor's degree in Computer Science, Software Engineering, or Information Technology
- Minimum 5 years of professional software development experience
- Proficiency in at least two of: TypeScript/Node.js, Python, Java, Go; and experience with PostgreSQL or equivalent RDBMS
- Demonstrated experience with RESTful API design and microservices architecture
- Strong understanding of software security principles (OWASP Top 10, authentication, data protection)

## Desirable Attributes
- Experience with cloud platforms (AWS, GCP, or Azure) and containerisation (Docker/Kubernetes)
- Familiarity with PNG government ICT frameworks and GovNet infrastructure
- Contributions to open-source projects or public code portfolios`,
      departmentId: it,
      agencyId,
      status: "open",
      closingDate: addDays(35),
    },
    {
      title: "Network & Infrastructure Engineer",
      description: `## Overview
The Network & Infrastructure Engineer is responsible for the design, implementation, and operational management of NISIT's network infrastructure, server environments, and telecommunications systems. The role ensures secure, reliable, and high-performance connectivity across all NISIT sites in Port Moresby and regional offices.

## Key Responsibilities
- Design and maintain LAN/WAN infrastructure including routers, switches, firewalls, and VPN gateways
- Administer on-premises servers (Windows Server, Linux) and virtualisation platforms (VMware/Hyper-V)
- Implement and maintain network security controls: IDS/IPS, network segmentation, patch management
- Manage internet and GovNet connectivity, including SLAs with ICT service providers
- Develop and maintain disaster recovery and business continuity plans for ICT infrastructure
- Monitor system performance using SNMP and monitoring tools; proactively address capacity and availability issues

## Required Qualifications
- Bachelor's degree in Information Technology, Computer Science, or Network Engineering
- Minimum 4 years of hands-on network and systems administration experience
- Cisco CCNA certification or equivalent; CCNP desirable
- Experience with Microsoft Active Directory, DNS, DHCP, and group policy management
- Knowledge of information security standards (ISO 27001, Essential Eight)

## Desirable Attributes
- Experience with SD-WAN technologies and cloud networking (AWS/Azure VPC)
- Familiarity with PNGIPA ICT infrastructure standards and GovNet connectivity requirements
- ITIL Foundation certification`,
      departmentId: it,
      agencyId,
      status: "open",
      closingDate: addDays(52),
    },
    {
      title: "ICT Helpdesk & Systems Support Officer",
      description: `## Overview
The ICT Helpdesk & Systems Support Officer provides first and second-level technical support to NISIT staff across all divisions. The role is the first point of contact for ICT-related incidents, service requests, and queries, ensuring timely resolution and a positive experience for all end-users.

## Key Responsibilities
- Log, prioritise, and resolve ICT incidents and service requests via the ITSM system within agreed SLAs
- Provide desktop support: hardware troubleshooting, software installation, printer and peripheral management
- Administer user accounts, access rights, and device enrolment in Active Directory and MDM platforms
- Assist in the rollout of new hardware, software, and ICT policies
- Develop user-friendly guides and deliver basic ICT training to staff
- Escalate unresolved complex incidents to senior ICT staff with accurate documentation

## Required Qualifications
- Diploma or Bachelor's degree in Information Technology or Computer Science
- Minimum 2 years of ICT helpdesk or desktop support experience
- Working knowledge of Windows 10/11, Microsoft 365, and common business applications
- Strong customer-service orientation and excellent communication skills
- Experience with ticketing systems (e.g., Jira Service Management, ServiceNow, Freshdesk)

## Desirable Attributes
- CompTIA A+ or Microsoft 365 Fundamentals certification
- Experience supporting remote/regional users via VPN and remote-access tools`,
      departmentId: it,
      agencyId,
      status: "draft",
      closingDate: addDays(70),
    },

    // ── Operations ────────────────────────────────────────────────────────
    {
      title: "Operations Manager",
      description: `## Overview
The Operations Manager oversees the day-to-day operational activities of NISIT, ensuring efficient delivery of corporate services, facilities management, fleet operations, and logistics across all sites. The role works closely with division heads and the Director General's office to maintain high service standards and operational continuity.

## Key Responsibilities
- Plan, direct, and coordinate operational activities across NISIT's Port Moresby headquarters and regional field offices
- Manage facilities services including building maintenance, security, cleaning, and utilities
- Oversee fleet management: vehicle allocation, servicing schedules, driver management, and fuel monitoring
- Develop and manage the operational budget; identify efficiency improvements and cost-reduction opportunities
- Ensure compliance with Work Health and Safety (WHS) legislation and manage workplace incident reporting
- Manage service contracts with external vendors for facilities, security, catering, and transport

## Required Qualifications
- Bachelor's degree in Business Administration, Operations Management, or related discipline
- Minimum 6 years of operations or facilities management experience, preferably in the public sector
- Demonstrated budget management and vendor contract management skills
- Strong leadership and people management ability; experience supervising multi-disciplinary teams
- Sound knowledge of PNG Work Health and Safety Act 2004

## Desirable Attributes
- Postgraduate qualification in Operations or Project Management (PMP, PRINCE2)
- Experience managing dispersed/remote operational sites across PNG provinces
- Knowledge of government asset management frameworks`,
      departmentId: ops,
      agencyId,
      status: "open",
      closingDate: addDays(47),
    },
    {
      title: "Logistics & Procurement Support Officer",
      description: `## Overview
The Logistics & Procurement Support Officer assists the Operations Manager in coordinating procurement activities, managing inventory, and ensuring the smooth movement of goods and supplies across NISIT facilities. The role maintains accurate records of assets, stores, and consumables in compliance with government property management requirements.

## Key Responsibilities
- Coordinate the receipt, storage, and distribution of office supplies, laboratory equipment, and consumables
- Maintain the asset register, conduct periodic stocktakes, and reconcile discrepancies
- Raise purchase requisitions, obtain quotations, and liaise with Finance and vendors on order fulfilment
- Arrange freight, customs clearance, and transportation for equipment and materials (domestic and international)
- Monitor supplier performance on delivery, quality, and price; escalate issues to the Procurement Officer
- Maintain accurate records and prepare monthly logistics and inventory reports

## Required Qualifications
- Diploma or Bachelor's degree in Logistics, Supply Chain Management, Business Administration, or equivalent
- Minimum 2 years of experience in logistics, warehousing, or procurement support
- Proficiency in Microsoft Excel and inventory management software
- Strong organisational skills with attention to detail
- Ability to work independently and manage competing priorities

## Desirable Attributes
- Experience with government stores and asset management systems
- Forklift or materials-handling licence
- Knowledge of customs and quarantine requirements for scientific equipment importation into PNG`,
      departmentId: ops,
      agencyId,
      status: "open",
      closingDate: addDays(60),
    },

    // ── Standards and Metrology ───────────────────────────────────────────
    {
      title: "Standards Technical Officer – Electrical & Electronics",
      description: `## Overview
The Standards Technical Officer (Electrical & Electronics) develops, reviews, and promotes adoption of PNG national standards in the electrical and electronics sector. The role supports NISIT's mandate under the Standards Act to facilitate safe and quality products in the Papua New Guinea market.

## Key Responsibilities
- Research, draft, and review PNG national standards (PNG Standards) in the electrical and electronics domain, aligned to ISO/IEC international standards
- Participate in ISO and IEC technical committee meetings as Papua New Guinea's representative
- Conduct pre-market and post-market surveillance activities in partnership with the Customs Service and ICCC
- Provide technical advisory services to industry, importers, and government agencies on standards compliance
- Deliver training workshops on electrical standards compliance for manufacturers and importers
- Manage the standards database and ensure current standards are accessible to stakeholders

## Required Qualifications
- Bachelor's degree in Electrical Engineering, Electronics Engineering, or a related technical discipline
- Minimum 3 years of professional experience in the electrical or electronics industry or a standards/regulatory body
- Knowledge of ISO/IEC standards development processes and international standardisation activities
- Excellent technical writing skills; ability to translate complex technical requirements into clear documentation
- Strong stakeholder engagement skills

## Desirable Attributes
- Postgraduate qualification in Metrology, Quality Management, or Standards Engineering
- Membership with Engineers PNG or a relevant professional engineering body
- Experience delivering technical training or compliance workshops`,
      departmentId: sm,
      agencyId,
      status: "open",
      closingDate: addDays(33),
    },
    {
      title: "Metrologist – Legal Metrology & Verification",
      description: `## Overview
The Metrologist – Legal Metrology & Verification is responsible for the verification, calibration, and testing of measuring instruments used in trade and commerce across Papua New Guinea. The role enforces the Metrology Act to ensure consumers and businesses are protected from inaccurate measurements.

## Key Responsibilities
- Verify and stamp weighing scales, fuel dispensing pumps, water meters, and other trade measurement instruments across PNG
- Operate and maintain primary and secondary measurement standards and calibration equipment in NISIT's metrology laboratory
- Conduct market surveillance and compliance inspections in markets, fuel stations, and commercial premises
- Issue certificates of verification and maintain accurate records of all verification activities
- Investigate complaints from consumers and businesses regarding measurement fraud or inaccuracy
- Represent NISIT in legal proceedings related to measurement offences under the Metrology Act

## Required Qualifications
- Bachelor's degree in Physics, Applied Mathematics, Metrology, Mechanical Engineering, or equivalent
- Minimum 2 years of experience in metrology, calibration, or a closely related technical field
- Proficiency in operating precision measurement equipment and laboratory instruments
- Strong knowledge of the International System of Units (SI) and traceability requirements
- Valid Papua New Guinea driver's licence (regional travel is required)

## Desirable Attributes
- Completion of an OIML or BIPM accredited metrology training course
- Experience with accreditation under ISO/IEC 17025
- Familiarity with ASEAN Consultative Committee for Standards and Quality (ACCSQ) metrology frameworks`,
      departmentId: sm,
      agencyId,
      status: "open",
      closingDate: addDays(75),
    },

    // ── Industrial Development ────────────────────────────────────────────
    {
      title: "Industrial Development Officer – SME & Manufacturing",
      description: `## Overview
The Industrial Development Officer provides technical and advisory services to small and medium enterprises (SMEs) and manufacturing businesses in Papua New Guinea, supporting their growth, competitiveness, and compliance with PNG industrial standards. The role works across sectors including food processing, building materials, agro-processing, and light manufacturing.

## Key Responsibilities
- Conduct industrial assessments and business diagnostic reviews for SME clients across key sectors
- Develop and deliver advisory programs on quality management, productivity improvement, and standards compliance
- Facilitate access to NISIT's testing, calibration, and certification services for manufacturing SMEs
- Liaise with the MSME Policy Unit, BPNG, and IPA on SME support programs and regulatory requirements
- Prepare technical reports, feasibility studies, and industrial development proposals
- Coordinate with regional NISIT offices to deliver outreach programs in provincial industrial centres

## Required Qualifications
- Bachelor's degree in Industrial Engineering, Manufacturing Technology, Business Administration, or related field
- Minimum 3 years of experience in industrial advisory, SME development, or manufacturing management
- Demonstrated knowledge of quality management systems (ISO 9001) and industrial standards
- Strong stakeholder engagement, facilitation, and report-writing skills
- Willingness to travel to provincial and remote locations across PNG

## Desirable Attributes
- Postgraduate qualification in Industrial Development, Business Development, or Technology Management
- Experience with value chain analysis and cluster-based industrial development
- Knowledge of PNG's key export sectors and SME financing landscape`,
      departmentId: ind,
      agencyId,
      status: "open",
      closingDate: addDays(55),
    },
    {
      title: "Business Development Specialist – Industrial Services",
      description: `## Overview
The Business Development Specialist is responsible for growing NISIT's revenue-generating services including testing, calibration, certification, and industrial advisory services. The role identifies market opportunities, develops service propositions, and builds strategic partnerships with industry, government, and development partners.

## Key Responsibilities
- Develop and implement a business development strategy for NISIT's fee-for-service technical offerings
- Identify and cultivate relationships with industry clients in the extractives, manufacturing, and agri-processing sectors
- Prepare service proposals, tenders, and partnership agreements for major industrial clients
- Manage the client engagement pipeline and report on revenue targets and conversion rates
- Coordinate with technical divisions to ensure service delivery meets client requirements and SLAs
- Represent NISIT at industry forums, trade expos, and investment promotion events

## Required Qualifications
- Bachelor's degree in Business Development, Marketing, Commerce, or related discipline
- Minimum 4 years of experience in business development, sales, or client relationship management
- Demonstrated track record of growing revenue or developing new client relationships
- Strong presentation, negotiation, and stakeholder management skills
- Understanding of PNG's industrial and regulatory environment

## Desirable Attributes
- Experience with testing, calibration, or industrial services sector
- Postgraduate qualification in Business Administration or Marketing
- Familiarity with development-partner-funded projects (ADB, World Bank, AusAID)`,
      departmentId: ind,
      agencyId,
      status: "closed",
      closingDate: pastDate(5),
    },

    // ── Research and Development ──────────────────────────────────────────
    {
      title: "Research Scientist – Materials Testing & Analysis",
      description: `## Overview
The Research Scientist – Materials Testing & Analysis conducts scientific research and testing services in NISIT's materials laboratory, supporting the development of PNG national standards and providing independent technical testing services to industry and government. The role contributes to building PNG's technical capacity in materials characterisation.

## Key Responsibilities
- Conduct physical, chemical, and mechanical testing of construction materials, agricultural commodities, and industrial products
- Develop and validate laboratory test methods aligned to ISO/ASTM/AS standards
- Design and lead research projects in collaboration with universities, industry, and government agencies
- Prepare scientific reports, research papers, and technical opinions for clients and regulatory bodies
- Maintain laboratory equipment, calibration schedules, and quality management documentation under ISO/IEC 17025
- Supervise laboratory technicians and graduate assistants in daily testing activities

## Required Qualifications
- Master's degree or PhD in Materials Science, Chemistry, Chemical Engineering, or related scientific discipline
- Minimum 4 years of laboratory research or testing experience, including data analysis and report writing
- Proficiency with analytical instruments (FTIR, XRF, GC-MS, SEM, or equivalent)
- Strong knowledge of accredited laboratory practices (ISO/IEC 17025)
- Excellent scientific writing skills and experience preparing peer-reviewed publications or technical standards

## Desirable Attributes
- Experience working in an accredited testing laboratory or government research institution
- Knowledge of PNG's construction, agricultural, or extractive sectors
- Research collaboration experience with Pacific regional or international institutions`,
      departmentId: rd,
      agencyId,
      status: "open",
      closingDate: addDays(79),
    },
    {
      title: "R&D Project Officer – Innovation & Technology Transfer",
      description: `## Overview
The R&D Project Officer supports the planning, coordination, and monitoring of NISIT's applied research and technology transfer projects. The role facilitates collaboration between NISIT's technical divisions, universities, industry partners, and development donors to ensure research outputs are translated into practical industrial and economic benefits for Papua New Guinea.

## Key Responsibilities
- Coordinate a portfolio of R&D projects from inception through completion, ensuring milestones, budgets, and deliverables are met
- Liaise with funding agencies (ADB, DFAT, EU) on grant reporting, compliance, and disbursement requirements
- Develop project briefs, concept papers, and research proposals to attract new research funding
- Facilitate technology transfer workshops, pilot demonstrations, and knowledge-sharing events with industry partners
- Monitor and evaluate project outcomes against defined performance indicators
- Prepare quarterly progress reports, final project reports, and communications materials for stakeholders

## Required Qualifications
- Bachelor's degree in Science, Engineering, Technology, or related field; postgraduate qualification desirable
- Minimum 3 years of project management experience, preferably in a research, technology, or development context
- Demonstrated experience in grant management and donor reporting
- Strong analytical, problem-solving, and written communication skills
- Proficiency in project management tools (MS Project, Asana, or equivalent)

## Desirable Attributes
- PMP, PRINCE2, or AgilePM project management certification
- Experience engaging with Pacific regional research networks (SPC, SPTO, USP)
- Knowledge of technology commercialisation and intellectual property management`,
      departmentId: rd,
      agencyId,
      status: "open",
      closingDate: addDays(48),
    },

    // ── Administration ────────────────────────────────────────────────────
    {
      title: "Executive Assistant to the Director General",
      description: `## Overview
The Executive Assistant provides high-level personal and administrative support to NISIT's Director General. The role manages the Director General's office with exceptional discretion, professionalism, and efficiency, acting as the primary liaison between the Director General and internal/external stakeholders.

## Key Responsibilities
- Manage the Director General's diary, schedule meetings, and coordinate travel and accommodation arrangements
- Prepare, edit, and proofread correspondence, briefing papers, submissions, Ministerial letters, and Cabinet papers
- Coordinate the Director General's participation in Board meetings, Ministerial briefings, and interagency forums
- Screen and triage incoming correspondence, emails, and calls; draft routine responses on behalf of the Director General
- Maintain a confidential filing system and ensure timely follow-up on outstanding actions
- Organise events, high-level meetings, official visits, and ceremonial functions for the DG's office

## Required Qualifications
- Diploma or Bachelor's degree in Business Administration, Secretarial Studies, or related discipline
- Minimum 5 years of executive assistant or senior administrative officer experience
- Exceptional written and verbal communication skills; ability to draft ministerial-level correspondence
- High degree of discretion, professionalism, and ability to handle confidential information
- Advanced proficiency in Microsoft Office Suite (Word, Excel, PowerPoint, Outlook)

## Desirable Attributes
- Experience in a Papua New Guinea government ministerial office or public-sector executive team
- Familiarity with Cabinet procedures and Ministerial briefing paper formats
- Shorthand or speed-typing skills`,
      departmentId: adm,
      agencyId,
      status: "open",
      closingDate: addDays(41),
    },
    {
      title: "Records & Archives Officer",
      description: `## Overview
The Records & Archives Officer is responsible for the management of NISIT's corporate records and archives in accordance with the National Archives Act and government records management policies. The role ensures that official records are properly created, captured, maintained, accessible, and disposed of in a systematic and accountable manner.

## Key Responsibilities
- Implement and maintain NISIT's Records Management Policy and File Classification Scheme
- Manage the physical and digital records repositories, including file creation, tracking, retrieval, and disposal
- Digitise priority records and maintain an electronic document management system (EDMS)
- Conduct records audits across divisions to ensure compliance with retention schedules and disposal authorities
- Advise staff on records management practices and deliver periodic training sessions
- Liaise with the National Archives of Papua New Guinea on transfer of archival records

## Required Qualifications
- Diploma or Bachelor's degree in Records Management, Archiving, Library Science, or Information Management
- Minimum 2 years of experience in records, archiving, or document management
- Knowledge of PNG National Archives Act and government records management standards
- Attention to detail and ability to manage large volumes of records systematically
- Proficiency in EDMS software (SharePoint, HP TRIM/Content Manager, or equivalent)

## Desirable Attributes
- Certified Records Manager (CRM) accreditation or equivalent
- Experience managing digitisation projects and optical character recognition (OCR) workflows
- Knowledge of metadata standards and digital preservation principles`,
      departmentId: adm,
      agencyId,
      status: "closed",
      closingDate: pastDate(10),
    },
    {
      title: "Administrative Officer – Corporate Services (Grade 10)",
      description: `## Overview
The Administrative Officer – Corporate Services provides general administrative support across NISIT's corporate services functions including reception, registry, travel management, and meeting coordination. The role is an entry-level professional position providing an excellent foundation for a career in PNG public administration.

## Key Responsibilities
- Operate the NISIT reception desk, greet visitors, and direct enquiries to the appropriate officers
- Manage incoming and outgoing mail, courier deliveries, and the general registry
- Coordinate meeting rooms, equipment, and catering for internal and external meetings and events
- Process travel requests, prepare travel itineraries, and reconcile staff travel claims in line with the Public Service Travel Policy
- Maintain office supplies inventory and raise requisitions when stock levels fall below minimum
- Provide general administrative assistance to division managers as directed

## Required Qualifications
- Diploma or Bachelor's degree in Business Administration, Office Management, or related discipline
- Minimum 1 year of administrative or clerical experience in a professional office environment
- Proficiency in Microsoft Office Suite (Word, Excel, Outlook)
- Strong interpersonal skills, professional presentation, and a customer-service orientation
- Ability to work effectively in a team and adapt to changing priorities

## Desirable Attributes
- Experience in a Papua New Guinea public-sector or statutory body office environment
- Knowledge of government administrative procedures and filing systems
- Basic bookkeeping or financial administration experience`,
      departmentId: adm,
      agencyId,
      status: "open",
      closingDate: addDays(62),
    },
  ];
}

async function seedJobVacancies(): Promise<void> {
  const [agency] = await db
    .select()
    .from(agenciesTable)
    .where(eq(agenciesTable.name, NISIT_AGENCY_NAME));

  if (!agency) {
    logger.warn("seedJobVacancies: NISIT agency not found, skipping");
    return;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(jobsTable)
    .where(eq(jobsTable.agencyId, agency.id));

  if (Number(total) > 0) {
    logger.info({ total: Number(total) }, "seedJobVacancies: jobs already exist, skipping");
    return;
  }

  const depts = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.agencyId, agency.id));

  const deptMap: Record<string, number> = {};
  for (const d of depts) {
    deptMap[d.name] = d.id;
  }

  const PNG_PROVINCES_CYCLE = [
    "National Capital District", "Western Highlands", "Morobe",
    "National Capital District", "East New Britain", "Madang",
    "National Capital District", "Eastern Highlands",
  ];

  function inferEmploymentType(title: string): string {
    const t = title.toLowerCase();
    if (t.includes("consultant") || t.includes("advisor")) return "contract";
    if (t.includes("assistant") || t.includes("support") || t.includes("officer"))
      return "full_time";
    return "full_time";
  }

  function inferSalary(title: string): { salaryMin: number; salaryMax: number } {
    const t = title.toLowerCase();
    if (t.includes("senior") || t.includes("manager") || t.includes("director"))
      return { salaryMin: 95000, salaryMax: 130000 };
    if (t.includes("engineer") || t.includes("developer") || t.includes("analyst"))
      return { salaryMin: 80000, salaryMax: 110000 };
    if (t.includes("officer") || t.includes("coordinator"))
      return { salaryMin: 65000, salaryMax: 90000 };
    return { salaryMin: 55000, salaryMax: 75000 };
  }

  const rawJobs = vacancies(deptMap, agency.id);
  const jobs = rawJobs.map((j, i) => {
    const { salaryMin, salaryMax } = inferSalary(j.title);
    return {
      ...j,
      province: PNG_PROVINCES_CYCLE[i % PNG_PROVINCES_CYCLE.length],
      employmentType: inferEmploymentType(j.title),
      workArrangement: "on_site" as const,
      salaryMin,
      salaryMax,
      salaryCurrency: "PGK",
      salaryVisibility: "public" as const,
    };
  });

  let inserted = 0;
  for (const job of jobs) {
    await db.insert(jobsTable).values(job);
    inserted++;
  }

  logger.info({ inserted }, "seedJobVacancies: inserted job vacancies");
}

export async function seedInitialData(): Promise<void> {
  try {
    for (const role of DEFAULT_ROLES) {
      const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, role.name));
      if (existing.length === 0) {
        await db.insert(rolesTable).values({ name: role.name, permissions: role.permissions });
        logger.info({ role: role.name }, "Seeded role");
      }
    }

    // Seed normalised grants alongside the legacy JSON role permissions. The
    // JSON column remains readable during migration, while enforcement moves to
    // resource/action/scope grants.
    for (const grant of DEFAULT_PERMISSION_GRANTS) {
      const [role] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, grant.role));
      if (!role) continue;
      const [permission] = await db.insert(permissionsTable)
        .values({ resource: grant.resource, action: grant.action, description: `${grant.resource}.${grant.action}` })
        .onConflictDoNothing()
        .returning({ id: permissionsTable.id });
      const permissionId = permission?.id ?? (await db.select({ id: permissionsTable.id }).from(permissionsTable)
        .where(and(eq(permissionsTable.resource, grant.resource), eq(permissionsTable.action, grant.action))))[0]?.id;
      if (!permissionId) continue;
      await db.insert(rolePermissionsTable)
        .values({ roleId: role.id, permissionId, scope: grant.scope })
        .onConflictDoNothing();
    }

    const agencies = await db.select().from(agenciesTable);
    if (agencies.length === 0) {
      const [agency] = await db.insert(agenciesTable).values({
        name: NISIT_AGENCY_NAME,
        type: "government",
      }).returning();

      const depts = [
        "Human Resources",
        "Finance",
        "Information Technology",
        "Operations",
        "Standards and Metrology",
        "Industrial Development",
        "Research and Development",
        "Administration",
      ];

      for (const name of depts) {
        await db.insert(departmentsTable).values({ name, agencyId: agency.id });
      }

      logger.info({ agency: agency.name }, "Seeded default agency and departments");
    }

    await ensureAdminUserExists();
    await seedWikiArticles();
    await seedJobVacancies();
    await seedCompleteData();
    await seedPrdReferenceData();
  } catch (err) {
    logger.error(err, "Seed failed (non-fatal)");
  }
}

/**
 * One-time back-fill for jobs created before employmentType / province were
 * required fields. Sets sensible defaults so the public job board and admin
 * list stop showing "missing field" warnings on legacy rows.
 *
 * Defaults:
 *   - employmentType: "full_time" (most NISIT roles are permanent)
 *   - province:       "National Capital District" (NISIT head office)
 *
 * Idempotent: only updates rows where the column is NULL.
 */
export async function backfillMissingJobFields(): Promise<void> {
  try {
    const missing = await db
      .select({ id: jobsTable.id, employmentType: jobsTable.employmentType, province: jobsTable.province })
      .from(jobsTable)
      .where(or(isNull(jobsTable.employmentType), isNull(jobsTable.province)));

    if (missing.length === 0) {
      logger.info("backfillMissingJobFields: no jobs require back-fill");
      return;
    }

    let employmentTypeFilled = 0;
    let provinceFilled = 0;

    for (const row of missing) {
      const updates: { employmentType?: string; province?: string } = {};
      if (row.employmentType == null) {
        updates.employmentType = "full_time";
        employmentTypeFilled++;
      }
      if (row.province == null) {
        updates.province = "National Capital District";
        provinceFilled++;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(jobsTable).set(updates).where(eq(jobsTable.id, row.id));
      }
    }

    logger.info(
      { jobsUpdated: missing.length, employmentTypeFilled, provinceFilled },
      "backfillMissingJobFields: legacy jobs back-filled with defaults",
    );
  } catch (err) {
    logger.error(err, "backfillMissingJobFields: failed (non-fatal)");
  }
}

/**
 * One-time back-fill that links pre-existing candidate records to user accounts
 * by matching on email. Candidates created before account-linking (Task #71)
 * have a NULL `user_id`, which forces the `/applications/my` endpoint to fall
 * back to a slower email-based lookup. Setting `user_id` lets that endpoint
 * use the indexed primary path instead.
 *
 * Only updates rows where `user_id` IS NULL, so the operation is idempotent
 * and safe to run on every boot. Uses a single bulk UPDATE for efficiency.
 *
 * Returns the number of candidate rows that were linked.
 */
export async function backfillCandidateUserIds(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE ${candidatesTable}
    SET user_id = u.id, updated_at = NOW()
    FROM ${usersTable} u
    WHERE ${candidatesTable.userId} IS NULL
      AND ${candidatesTable.email} = u.email
    RETURNING ${candidatesTable.id}
  `);
  const linked = result.rowCount ?? 0;
  if (linked > 0) {
    logger.info({ linked }, "backfillCandidateUserIds: linked legacy candidates to user accounts");
  } else {
    logger.info("backfillCandidateUserIds: no legacy candidate records require linking");
  }
  return linked;
}

export async function ensureUserSecurityColumnsExist(): Promise<void> {
  const statements = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMPTZ;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_saved_job_closing BOOLEAN NOT NULL DEFAULT TRUE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS closing_soon_days INTEGER NOT NULL DEFAULT 7;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_stale_applications BOOLEAN NOT NULL DEFAULT TRUE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();",
  ];

  for (const statement of statements) {
    try {
      await db.execute(sql.raw(statement));
    } catch (error) {
      logger.warn({ err: error, statement }, "ensureUserSecurityColumnsExist: column check warning");
    }
  }
  logger.info("ensureUserSecurityColumnsExist: verified user security and preference columns exist");
}

export async function ensureAdminUserExists(): Promise<void> {
  try {
    // 0. Ensure user security columns exist before executing any user table queries
    await ensureUserSecurityColumnsExist();
    // 1. Ensure basic roles exist (admin, hr_officer, executive, employee, applicant, hiring_manager)
    for (const role of DEFAULT_ROLES) {
      const existingRole = await db.select().from(rolesTable).where(eq(rolesTable.name, role.name)).limit(1);
      if (existingRole.length === 0) {
        await db.insert(rolesTable).values({ name: role.name, permissions: role.permissions });
        logger.info({ role: role.name }, "ensureAdminUserExists: seeded missing role");
      }
    }

    const [adminRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "admin")).limit(1);
    if (!adminRole) {
      logger.error("ensureAdminUserExists: admin role could not be resolved");
      return;
    }

    // 2. Resolve primary agency without rigid name requirement
    let [agency] = await db.select().from(agenciesTable).limit(1);
    if (!agency) {
      const [newAgency] = await db.insert(agenciesTable).values({
        name: NISIT_AGENCY_NAME,
        type: "government",
      }).returning();
      agency = newAgency;
      logger.info({ agencyId: agency.id }, "ensureAdminUserExists: created default agency");
    }

    // 3. Upsert admin@nisit.gov.pg with known credentials, active status, and reset lockouts
    const ADMIN_EMAIL = "admin@nisit.gov.pg";
    const adminPasswordHash = await bcrypt.hash("Admin123!", 10);

    const existingAdmins = await db
      .select()
      .from(usersTable)
      .where(sql`LOWER(TRIM(${usersTable.email})) = ${ADMIN_EMAIL}`);

    if (existingAdmins.length === 0) {
      await db.insert(usersTable).values({
        name: "NISIT Administrator",
        email: ADMIN_EMAIL,
        passwordHash: adminPasswordHash,
        agencyId: agency.id,
        roleId: adminRole.id,
        status: "active",
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      logger.info({ email: ADMIN_EMAIL }, "ensureAdminUserExists: created default admin user");
    } else {
      const adminUser = existingAdmins[0];
      await db
        .update(usersTable)
        .set({
          email: ADMIN_EMAIL,
          passwordHash: adminPasswordHash,
          agencyId: agency.id,
          roleId: adminRole.id,
          status: "active",
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, adminUser.id));
      logger.info({ adminId: adminUser.id, email: ADMIN_EMAIL }, "ensureAdminUserExists: synchronized and unlocked admin user");

      // Ensure admin user is linked to an employee profile
      let [adminEmp] = await db.select().from(employeesTable).where(eq(employeesTable.email, ADMIN_EMAIL)).limit(1);
      if (!adminEmp) {
        const [newEmp] = await db
          .insert(employeesTable)
          .values({
            agencyId: agency.id,
            name: "NISIT Administrator",
            email: ADMIN_EMAIL,
            division: "Executive Management",
            liveAttendanceStatus: "out_of_office",
          })
          .returning();
        adminEmp = newEmp;
      }
      if (adminEmp) {
        await db
          .update(usersTable)
          .set({ employeeId: adminEmp.id })
          .where(eq(usersTable.id, adminUser.id));
        logger.info({ adminId: adminUser.id, employeeId: adminEmp.id }, "ensureAdminUserExists: linked admin to employee profile");
      }
    }

    // 4. Ensure secondary default accounts from DEPLOYMENT_SOP exist and are active
    const [hrRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "hr_officer")).limit(1);
    const [execRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "executive")).limit(1);

    const secondaryAccounts = [
      { name: "Margaret Tolo (HR Officer)", email: "m.tolo@nisit.gov.pg", roleId: hrRole?.id || adminRole.id },
      { name: "Director General (Executive)", email: "director@nisit.gov.pg", roleId: execRole?.id || adminRole.id },
    ];

    for (const acc of secondaryAccounts) {
      const existing = await db
        .select()
        .from(usersTable)
        .where(sql`LOWER(TRIM(${usersTable.email})) = ${acc.email.toLowerCase()}`);
      if (existing.length === 0) {
        await db.insert(usersTable).values({
          name: acc.name,
          email: acc.email,
          passwordHash: adminPasswordHash,
          agencyId: agency.id,
          roleId: acc.roleId,
          status: "active",
          failedLoginAttempts: 0,
          lockedUntil: null,
        });
      } else {
        await db
          .update(usersTable)
          .set({
            status: "active",
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordHash: adminPasswordHash,
          })
          .where(eq(usersTable.id, existing[0].id));
      }
    }
  } catch (err) {
    logger.error(err, "ensureAdminUserExists: failed (non-fatal)");
  }
}

export async function ensureChatTablesExist(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id SERIAL PRIMARY KEY,
        agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'direct',
        title TEXT,
        avatar TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        last_message_preview TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        last_read_at TIMESTAMPTZ DEFAULT NOW(),
        muted BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_type TEXT NOT NULL DEFAULT 'text',
        content TEXT NOT NULL DEFAULT '',
        attachment_url TEXT,
        attachment_name TEXT,
        attachment_size INTEGER,
        reply_to_id INTEGER,
        deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("ensureChatTablesExist: verified chat database tables exist");
  } catch (error) {
    logger.error({ err: error }, "ensureChatTablesExist failed to verify chat tables");
  }
}

export async function ensureContractColumnsExist(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS salary TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS duties TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS special_conditions TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS probation_period TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notice_period TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS working_hours TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS custom_clauses TEXT;
    `);
    logger.info("ensureContractColumnsExist: verified contract content columns exist");
  } catch (error) {
    logger.error({ err: error }, "ensureContractColumnsExist failed to verify contract content columns");
  }
}

export async function ensureLeaveTablesAndColumnsExist(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS handover_employee_id INTEGER REFERENCES employees(id);
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_period_type TEXT NOT NULL DEFAULT 'full_day';
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS medical_certificate_number TEXT;

      CREATE TABLE IF NOT EXISTS public_holidays (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        date DATE NOT NULL,
        year INTEGER NOT NULL DEFAULT 2026,
        is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
        agency_id INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
        year INTEGER NOT NULL DEFAULT 2026,
        adjustment_days NUMERIC(5, 1) NOT NULL,
        adjustment_type TEXT NOT NULL DEFAULT 'accrual',
        reason TEXT NOT NULL,
        authorized_by_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed default PNG 2026 statutory public holidays if none exist
    const holidayCountRes = await db.execute(sql`SELECT COUNT(*)::int as count FROM public_holidays WHERE year = 2026`);
    const count = Number((holidayCountRes.rows[0] as any)?.count || 0);
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO public_holidays (name, date, year, is_recurring, notes) VALUES
        ('New Year''s Day', '2026-01-01', 2026, true, 'PNG National Statutory Holiday'),
        ('Good Friday', '2026-04-03', 2026, false, 'Christian Easter Holiday'),
        ('Easter Saturday', '2026-04-04', 2026, false, 'Christian Easter Holiday'),
        ('Easter Monday', '2026-04-06', 2026, false, 'Christian Easter Holiday'),
        ('King''s Official Birthday', '2026-06-08', 2026, true, 'Commonwealth & Head of State Observance'),
        ('National Remembrance Day', '2026-07-23', 2026, true, 'Honoring Fallen Servicemen & Peacekeepers'),
        ('National Repentance Day', '2026-08-26', 2026, true, 'National Prayer and Thanksgiving Day'),
        ('Independence Day', '2026-09-16', 2026, true, '51st Anniversary of PNG Independence'),
        ('Christmas Day', '2026-12-25', 2026, true, 'Christian Holiday'),
        ('Boxing Day', '2026-12-26', 2026, true, 'Public Holiday');
      `);
    }

    logger.info("ensureLeaveTablesAndColumnsExist: verified leave tables and public holidays exist");
  } catch (error) {
    logger.error({ err: error }, "ensureLeaveTablesAndColumnsExist failed");
  }
}

export async function ensureClockingTablesExist(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS clocking_devices (
        id SERIAL PRIMARY KEY,
        agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        device_model TEXT DEFAULT 'Generic REST Biometric',
        serial_number TEXT,
        ip_address TEXT,
        location TEXT NOT NULL DEFAULT 'NISIT HQ Port Moresby',
        api_key TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_heartbeat_at TIMESTAMPTZ,
        total_punches_recorded INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clocking_raw_punches (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES clocking_devices(id) ON DELETE SET NULL,
        device_identifier TEXT,
        employee_identifier TEXT NOT NULL,
        matched_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        punch_time TIMESTAMPTZ NOT NULL,
        punch_type TEXT NOT NULL DEFAULT 'auto',
        verification_mode TEXT NOT NULL DEFAULT 'biometric',
        location TEXT,
        raw_payload TEXT,
        status TEXT NOT NULL DEFAULT 'processed',
        processed_attendance_record_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES clocking_devices(id) ON DELETE SET NULL;
      ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS raw_punch_in_id INTEGER REFERENCES clocking_raw_punches(id) ON DELETE SET NULL;
      ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS raw_punch_out_id INTEGER REFERENCES clocking_raw_punches(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_clocking_raw_punches_employee_id ON clocking_raw_punches (matched_employee_id);
      CREATE INDEX IF NOT EXISTS idx_clocking_raw_punches_punch_time ON clocking_raw_punches (punch_time);
      CREATE INDEX IF NOT EXISTS idx_clocking_devices_api_key ON clocking_devices (api_key);
    `);

    // Seed default NISIT clocking terminals if none exist
    const [agency] = await db.select().from(agenciesTable).limit(1);
    if (agency) {
      const existing = await db.execute(sql`SELECT COUNT(*)::int as count FROM clocking_devices WHERE agency_id = ${agency.id}`);
      const count = Number((existing.rows[0] as any)?.count || 0);
      if (count === 0) {
        await db.execute(sql`
          INSERT INTO clocking_devices (agency_id, name, device_model, serial_number, ip_address, location, api_key, status, notes) VALUES
          (${agency.id}, 'NISIT HQ Main Entrance Turnstile', 'ZKTeco SpeedFace-V5L', 'ZK-HQ-001', '192.168.10.201', 'NISIT HQ Ground Floor - Main Lobby', 'clk_live_zkteco_hq_main_entrance_secret_key_2026', 'active', 'Primary biometric face & fingerprint terminal for staff entrance'),
          (${agency.id}, 'Metrology & Standards Wing Scanner', 'Hikvision DS-K1T671MF', 'HIK-MET-002', '192.168.10.202', 'Standards & Industrial Testing Lab', 'clk_live_hikvision_metrology_wing_secret_key_2026', 'active', 'Lab access control and attendance reader');
        `);
      }
    }

    logger.info("ensureClockingTablesExist: verified clocking interoperability tables exist");
  } catch (error) {
    logger.error({ err: error }, "ensureClockingTablesExist failed");
  }
}

export async function ensureGeofenceAndSmartAttendanceTablesExist(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS geofence_zones (
        id SERIAL PRIMARY KEY,
        agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        latitude TEXT NOT NULL,
        longitude TEXT NOT NULL,
        radius_meters INTEGER NOT NULL DEFAULT 150,
        address TEXT,
        province TEXT NOT NULL DEFAULT 'National Capital District',
        is_active TEXT NOT NULL DEFAULT 'true',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS live_attendance_status TEXT NOT NULL DEFAULT 'out_of_office';`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_clock_in_at TIMESTAMPTZ;`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_clock_out_at TIMESTAMPTZ;`);
    await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS punctuality_score TEXT DEFAULT '100.0';`);

    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS geofence_zone_id INTEGER REFERENCES geofence_zones(id) ON DELETE SET NULL;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_latitude TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_longitude TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_in_accuracy TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_latitude TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_longitude TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS punch_out_accuracy TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'web';`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS self_photo_url TEXT;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS overtime_status TEXT DEFAULT 'none';`);

    const [agency] = await db.select().from(agenciesTable).limit(1);
    if (agency) {
      const existing = await db.execute(sql`SELECT COUNT(*)::int as count FROM geofence_zones WHERE agency_id = ${agency.id}`);
      const count = Number((existing.rows[0] as any)?.count || 0);
      if (count === 0) {
        await db.execute(sql`
          INSERT INTO geofence_zones (agency_id, name, code, latitude, longitude, radius_meters, address, province, is_active) VALUES
          (${agency.id}, 'NISIT HQ Port Moresby', 'GEO-HQ-POM', '-9.431284', '147.185293', 200, 'Corner of Spring Garden Rd & Godwit Rd, Gordon, Port Moresby', 'National Capital District', 'true'),
          (${agency.id}, 'Lae Standards & Metrology Testing Wing', 'GEO-LAE-002', '-6.726514', '146.997218', 250, 'Industrial Estate, Section 12, Lot 4, Lae', 'Morobe', 'true'),
          (${agency.id}, 'Jacksons Airport Standards Cargo Wing', 'GEO-JAX-003', '-9.444211', '147.214532', 300, 'Jacksons International Airport Freight Terminal', 'National Capital District', 'true');
        `);
      }
    }

    logger.info("ensureGeofenceAndSmartAttendanceTablesExist: verified geofence zones and smart attendance columns");
  } catch (error) {
    logger.error({ err: error }, "ensureGeofenceAndSmartAttendanceTablesExist failed");
  }
}

export async function ensurePayrollTablesExist(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
        period_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        cycle_type TEXT NOT NULL DEFAULT 'fortnightly',
        year INTEGER NOT NULL DEFAULT 2026,
        period_number INTEGER NOT NULL DEFAULT 1,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        pay_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        total_gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_taxable NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_irc_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_super_employee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_super_employer NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_net NUMERIC(14, 2) NOT NULL DEFAULT 0,
        employee_count INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'PGK',
        approved_by_user_id INTEGER REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        disbursed_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employee_salary_profiles (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
        grade_level TEXT NOT NULL DEFAULT 'Grade 10',
        annual_base_salary NUMERIC(12, 2) NOT NULL DEFAULT 45000.00,
        fortnightly_base_salary NUMERIC(12, 2) NOT NULL DEFAULT 1730.77,
        hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 21.63,
        pay_cycle TEXT NOT NULL DEFAULT 'fortnightly',
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        bank_name TEXT NOT NULL DEFAULT 'BSP Financial Group',
        bank_branch TEXT DEFAULT 'Port Moresby Commercial Branch',
        bank_account_number TEXT DEFAULT '1002938471',
        bank_account_name TEXT,
        tin TEXT DEFAULT '500123987',
        tax_code TEXT NOT NULL DEFAULT 'primary',
        super_fund TEXT NOT NULL DEFAULT 'Nasfund',
        super_member_number TEXT DEFAULT 'NF-98214',
        super_voluntary_rate NUMERIC(5, 2) DEFAULT 0.00,
        housing_allowance NUMERIC(10, 2) DEFAULT 350.00,
        utility_allowance NUMERIC(10, 2) DEFAULT 120.00,
        transport_allowance NUMERIC(10, 2) DEFAULT 150.00,
        representation_allowance NUMERIC(10, 2) DEFAULT 0.00,
        other_allowances NUMERIC(10, 2) DEFAULT 0.00,
        union_dues NUMERIC(10, 2) DEFAULT 15.00,
        insurance_deduction NUMERIC(10, 2) DEFAULT 25.00,
        is_active BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payroll_items (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        payslip_number TEXT NOT NULL UNIQUE,
        base_salary NUMERIC(12, 2) NOT NULL,
        regular_hours_worked NUMERIC(6, 2) NOT NULL DEFAULT 80.00,
        overtime_hours_15 NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
        overtime_hours_20 NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
        overtime_pay NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        allowances_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
        total_allowances NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        gross_pay NUMERIC(12, 2) NOT NULL,
        taxable_income NUMERIC(12, 2) NOT NULL,
        irc_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        superannuation_employee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        superannuation_employer NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        deductions_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
        total_deductions NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        net_pay NUMERIC(12, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'PGK',
        payment_status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        bank_name TEXT,
        bank_account_number TEXT,
        attendance_days_present INTEGER DEFAULT 10,
        leave_days_taken NUMERIC(4, 1) DEFAULT 0.0,
        unpaid_leave_days NUMERIC(4, 1) DEFAULT 0.0,
        unpaid_leave_deduction NUMERIC(10, 2) DEFAULT 0.00,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payroll_adjustments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        period_id INTEGER REFERENCES payroll_periods(id) ON DELETE SET NULL,
        type TEXT NOT NULL DEFAULT 'allowance',
        category TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        taxable BOOLEAN NOT NULL DEFAULT true,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved',
        requested_by_user_id INTEGER REFERENCES users(id),
        approved_by_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payroll_audit_logs (
        id SERIAL PRIMARY KEY,
        period_id INTEGER REFERENCES payroll_periods(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        performed_by_user_id INTEGER REFERENCES users(id),
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payroll_items_period_id ON payroll_items(period_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON payroll_items(employee_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_periods_agency_id ON payroll_periods(agency_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period_id ON payroll_adjustments(period_id);
      CREATE INDEX IF NOT EXISTS idx_employee_salary_profiles_employee_id ON employee_salary_profiles(employee_id);

      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS private_email TEXT;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS payslip_password_pin TEXT;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS payslip_password_type TEXT NOT NULL DEFAULT 'dob_or_pin';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS superannuation_type TEXT NOT NULL DEFAULT 'percentage';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS superannuation_fixed_amount NUMERIC(10, 2) DEFAULT 0.00;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS housing_allowance_type TEXT NOT NULL DEFAULT 'fixed';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS housing_allowance_rate NUMERIC(6, 2) DEFAULT 0.00;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS utility_allowance_type TEXT NOT NULL DEFAULT 'fixed';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS utility_allowance_rate NUMERIC(6, 2) DEFAULT 0.00;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS transport_allowance_type TEXT NOT NULL DEFAULT 'fixed';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS transport_allowance_rate NUMERIC(6, 2) DEFAULT 0.00;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS representation_allowance_type TEXT NOT NULL DEFAULT 'fixed';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS representation_allowance_rate NUMERIC(6, 2) DEFAULT 0.00;
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS other_allowances_type TEXT NOT NULL DEFAULT 'fixed';
      ALTER TABLE employee_salary_profiles ADD COLUMN IF NOT EXISTS other_allowances_rate NUMERIC(6, 2) DEFAULT 0.00;

      ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS email_delivery_status TEXT NOT NULL DEFAULT 'not_sent';
      ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS email_sent_to TEXT;
      ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
      ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS email_delivery_error TEXT;
    `);

    // Ensure staff have realistic registered private personal emails for payslip delivery
    await db.execute(sql`
      UPDATE employee_salary_profiles prof
      SET private_email = LOWER(REPLACE(TRIM(e.name), ' ', '.')) || '@gmail.com'
      FROM employees e
      WHERE e.id = prof.employee_id AND (prof.private_email IS NULL OR prof.private_email = '');
    `);

    // Ensure all existing employees have a salary profile
    const existingEmployees = await db.select().from(employeesTable);
    if (existingEmployees.length > 0) {
      const existingProfiles = await db.execute(sql`SELECT employee_id FROM employee_salary_profiles`);
      const existingIds = new Set((existingProfiles.rows as any[]).map((r) => r.employee_id));

      const banks = ["BSP Financial Group", "Kina Bank", "Westpac PNG", "ANZ PNG"];
      const superFunds = ["Nasfund", "Nambawan Super"];

      for (let i = 0; i < existingEmployees.length; i++) {
        const emp = existingEmployees[i];
        if (existingIds.has(emp.id)) continue;

        let annual = 48000;
        let grade = emp.gradeLevel || "Grade 11";
        if (grade.includes("18") || grade.includes("Director") || grade.includes("Executive")) {
          annual = 110000;
          grade = "Grade 18";
        } else if (grade.includes("16") || grade.includes("Manager")) {
          annual = 85000;
          grade = "Grade 16";
        } else if (grade.includes("14") || grade.includes("Senior") || grade.includes("Lead")) {
          annual = 68000;
          grade = "Grade 14";
        } else if (grade.includes("12")) {
          annual = 54000;
          grade = "Grade 12";
        } else {
          annual = 42000;
          grade = "Grade 10";
        }

        const fortnightly = Math.round((annual / 26) * 100) / 100;
        const hourly = Math.round((fortnightly / 80) * 100) / 100;
        const bankName = banks[i % banks.length];
        const superFund = superFunds[i % superFunds.length];
        const accNum = `100${String(1200000 + (emp.id * 8371)).slice(0, 7)}`;
        const tinNum = `500${String(819200 + (emp.id * 1423)).slice(0, 6)}`;
        const superNum = `${superFund === "Nasfund" ? "NF" : "NS"}-${29100 + emp.id}`;

        const housing = grade.includes("18") ? 750 : grade.includes("16") ? 550 : 350;
        const utility = grade.includes("18") ? 200 : 120;
        const transport = grade.includes("18") ? 300 : 150;
        const rep = grade.includes("18") ? 400 : 0;

        await db.execute(sql`
          INSERT INTO employee_salary_profiles (
            employee_id, grade_level, annual_base_salary, fortnightly_base_salary, hourly_rate,
            pay_cycle, payment_method, bank_name, bank_branch, bank_account_number, bank_account_name,
            tin, tax_code, super_fund, super_member_number, super_voluntary_rate,
            superannuation_type, superannuation_fixed_amount,
            housing_allowance, housing_allowance_type, housing_allowance_rate,
            utility_allowance, utility_allowance_type, utility_allowance_rate,
            transport_allowance, transport_allowance_type, transport_allowance_rate,
            representation_allowance, representation_allowance_type, representation_allowance_rate,
            union_dues, insurance_deduction, is_active
          ) VALUES (
            ${emp.id}, ${grade}, ${annual}, ${fortnightly}, ${hourly},
            'fortnightly', 'bank_transfer', ${bankName}, 'Port Moresby Commercial Branch', ${accNum}, ${emp.name},
            ${tinNum}, 'primary', ${superFund}, ${superNum}, 0.00,
            'percentage', 0.00,
            ${housing}, 'fixed', ${fortnightly > 0 ? Math.round((housing / fortnightly) * 10000) / 100 : 0},
            ${utility}, 'fixed', ${fortnightly > 0 ? Math.round((utility / fortnightly) * 10000) / 100 : 0},
            ${transport}, 'fixed', ${fortnightly > 0 ? Math.round((transport / fortnightly) * 10000) / 100 : 0},
            ${rep}, 'fixed', ${fortnightly > 0 ? Math.round((rep / fortnightly) * 10000) / 100 : 0},
            15.00, 25.00, true
          ) ON CONFLICT (employee_id) DO NOTHING;
        `);
      }
    }

    // Ensure default 2026 Pay Periods exist
    const [agency] = await db.select().from(agenciesTable).limit(1);
    if (agency) {
      const periodsCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM payroll_periods WHERE agency_id = ${agency.id}`);
      const periodsCount = Number((periodsCountResult.rows[0] as any)?.count || 0);

      if (periodsCount === 0) {
        const [fn13Result] = (await db.execute(sql`
          INSERT INTO payroll_periods (
            agency_id, period_code, name, cycle_type, year, period_number,
            start_date, end_date, pay_date, status, currency, notes
          ) VALUES (
            ${agency.id}, '2026-FN13', 'Fortnight 13 (June 2026)', 'fortnightly', 2026, 13,
            '2026-06-15', '2026-06-28', '2026-07-02', 'disbursed', 'PGK', 'Statutory remuneration run for Fortnight 13/2026 — Completed and disbursed via BSP & Kina Bank EFT'
          ) RETURNING id;
        `)).rows as any[];

        const [fn14Result] = (await db.execute(sql`
          INSERT INTO payroll_periods (
            agency_id, period_code, name, cycle_type, year, period_number,
            start_date, end_date, pay_date, status, currency, notes
          ) VALUES (
            ${agency.id}, '2026-FN14', 'Fortnight 14 (July 2026)', 'fortnightly', 2026, 14,
            '2026-06-29', '2026-07-12', '2026-07-16', 'approved', 'PGK', 'Current active statutory remuneration run for Fortnight 14/2026 — Ready for executive disbursement'
          ) RETURNING id;
        `)).rows as any[];

        await db.execute(sql`
          INSERT INTO payroll_periods (
            agency_id, period_code, name, cycle_type, year, period_number,
            start_date, end_date, pay_date, status, currency, notes
          ) VALUES (
            ${agency.id}, '2026-FN15', 'Fortnight 15 (July 2026)', 'fortnightly', 2026, 15,
            '2026-07-13', '2026-07-26', '2026-07-30', 'draft', 'PGK', 'Upcoming pay fortnight — In preparation'
          );
        `);

        const fn13Id = fn13Result?.id;
        const fn14Id = fn14Result?.id;

        const profiles = (await db.execute(sql`
          SELECT p.*, e.name as employee_name, e.employee_number 
          FROM employee_salary_profiles p 
          JOIN employees e ON e.id = p.employee_id
        `)).rows as any[];

        const calculateItem = (prof: any, periodId: number, periodCode: string, isFn14: boolean) => {
          const annual = Number(prof.annual_base_salary) || 45000;
          const fortnightly = Number(prof.fortnightly_base_salary) || (annual / 26);
          const hourly = Number(prof.hourly_rate) || (fortnightly / 80);
          const housing = Number(prof.housing_allowance) || 0;
          const utility = Number(prof.utility_allowance) || 0;
          const transport = Number(prof.transport_allowance) || 0;
          const rep = Number(prof.representation_allowance) || 0;

          const otHours15 = isFn14 && (prof.grade_level.includes("10") || prof.grade_level.includes("12")) ? 6 : 0;
          const otPay = otHours15 * hourly * 1.5;

          const totalAllowances = housing + utility + transport + rep;
          const gross = fortnightly + otPay + totalAllowances;
          const taxable = gross;

          const annualTaxable = taxable * 26;
          let annualTax = 0;
          if (annualTaxable <= 20000) annualTax = 0;
          else if (annualTaxable <= 33000) annualTax = (annualTaxable - 20000) * 0.22;
          else if (annualTaxable <= 70000) annualTax = 2860 + (annualTaxable - 33000) * 0.30;
          else if (annualTaxable <= 250000) annualTax = 2860 + 11100 + (annualTaxable - 70000) * 0.35;
          else annualTax = 2860 + 11100 + 63000 + (annualTaxable - 250000) * 0.40;

          const ircTax = Math.round((annualTax / 26) * 100) / 100;
          const superEmployee = Math.round((fortnightly * 0.06) * 100) / 100;
          const superEmployer = Math.round((fortnightly * 0.084) * 100) / 100;
          const unionDues = Number(prof.union_dues) || 15;
          const insurance = Number(prof.insurance_deduction) || 25;

          const totalDeductions = Math.round((ircTax + superEmployee + unionDues + insurance) * 100) / 100;
          const net = Math.round((gross - totalDeductions) * 100) / 100;
          const psNumber = `NISIT-PS-${periodCode}-${String(100 + prof.employee_id)}`;

          return {
            periodId,
            employeeId: prof.employee_id,
            payslipNumber: psNumber,
            baseSalary: fortnightly,
            otHours15,
            otPay,
            allowancesBreakdown: JSON.stringify({ housing, utility, transport, representation: rep }),
            totalAllowances,
            gross,
            taxable,
            ircTax,
            superEmployee,
            superEmployer,
            deductionsBreakdown: JSON.stringify({ ircTax, superannuation: superEmployee, unionDues, insurance }),
            totalDeductions,
            net,
            bankName: prof.bank_name,
            bankAccountNumber: prof.bank_account_number,
          };
        };

        let fn13Gross = 0, fn13Tax = 0, fn13SupEmp = 0, fn13SupOrg = 0, fn13All = 0, fn13Ded = 0, fn13Net = 0;
        let fn14Gross = 0, fn14Tax = 0, fn14SupEmp = 0, fn14SupOrg = 0, fn14All = 0, fn14Ded = 0, fn14Net = 0;

        for (const prof of profiles) {
          if (fn13Id) {
            const item13 = calculateItem(prof, fn13Id, "2026-FN13", false);
            fn13Gross += item13.gross;
            fn13Tax += item13.ircTax;
            fn13SupEmp += item13.superEmployee;
            fn13SupOrg += item13.superEmployer;
            fn13All += item13.totalAllowances;
            fn13Ded += item13.totalDeductions;
            fn13Net += item13.net;

            await db.execute(sql`
              INSERT INTO payroll_items (
                period_id, employee_id, payslip_number, base_salary, regular_hours_worked,
                overtime_hours_15, overtime_hours_20, overtime_pay, allowances_breakdown,
                total_allowances, gross_pay, taxable_income, irc_tax, superannuation_employee,
                superannuation_employer, deductions_breakdown, total_deductions, net_pay,
                currency, payment_status, payment_method, bank_name, bank_account_number
              ) VALUES (
                ${item13.periodId}, ${item13.employeeId}, ${item13.payslipNumber}, ${item13.baseSalary}, 80.00,
                ${item13.otHours15}, 0.00, ${item13.otPay}, ${item13.allowancesBreakdown}::jsonb,
                ${item13.totalAllowances}, ${item13.gross}, ${item13.taxable}, ${item13.ircTax}, ${item13.superEmployee},
                ${item13.superEmployer}, ${item13.deductionsBreakdown}::jsonb, ${item13.totalDeductions}, ${item13.net},
                'PGK', 'cleared', 'bank_transfer', ${item13.bankName}, ${item13.bankAccountNumber}
              );
            `);
          }

          if (fn14Id) {
            const item14 = calculateItem(prof, fn14Id, "2026-FN14", true);
            fn14Gross += item14.gross;
            fn14Tax += item14.ircTax;
            fn14SupEmp += item14.superEmployee;
            fn14SupOrg += item14.superEmployer;
            fn14All += item14.totalAllowances;
            fn14Ded += item14.totalDeductions;
            fn14Net += item14.net;

            await db.execute(sql`
              INSERT INTO payroll_items (
                period_id, employee_id, payslip_number, base_salary, regular_hours_worked,
                overtime_hours_15, overtime_hours_20, overtime_pay, allowances_breakdown,
                total_allowances, gross_pay, taxable_income, irc_tax, superannuation_employee,
                superannuation_employer, deductions_breakdown, total_deductions, net_pay,
                currency, payment_status, payment_method, bank_name, bank_account_number
              ) VALUES (
                ${item14.periodId}, ${item14.employeeId}, ${item14.payslipNumber}, ${item14.baseSalary}, 80.00,
                ${item14.otHours15}, 0.00, ${item14.otPay}, ${item14.allowancesBreakdown}::jsonb,
                ${item14.totalAllowances}, ${item14.gross}, ${item14.taxable}, ${item14.ircTax}, ${item14.superEmployee},
                ${item14.superEmployer}, ${item14.deductionsBreakdown}::jsonb, ${item14.totalDeductions}, ${item14.net},
                'PGK', 'pending', 'bank_transfer', ${item14.bankName}, ${item14.bankAccountNumber}
              );
            `);
          }
        }

        if (fn13Id) {
          await db.execute(sql`
            UPDATE payroll_periods SET
              total_gross = ${fn13Gross},
              total_taxable = ${fn13Gross},
              total_irc_tax = ${fn13Tax},
              total_super_employee = ${fn13SupEmp},
              total_super_employer = ${fn13SupOrg},
              total_allowances = ${fn13All},
              total_deductions = ${fn13Ded},
              total_net = ${fn13Net},
              employee_count = ${profiles.length},
              disbursed_at = '2026-07-02 10:30:00+10'
            WHERE id = ${fn13Id};
          `);
        }

        if (fn14Id) {
          await db.execute(sql`
            UPDATE payroll_periods SET
              total_gross = ${fn14Gross},
              total_taxable = ${fn14Gross},
              total_irc_tax = ${fn14Tax},
              total_super_employee = ${fn14SupEmp},
              total_super_employer = ${fn14SupOrg},
              total_allowances = ${fn14All},
              total_deductions = ${fn14Ded},
              total_net = ${fn14Net},
              employee_count = ${profiles.length},
              approved_at = '2026-07-13 14:00:00+10'
            WHERE id = ${fn14Id};
          `);
        }
      }
    }

    logger.info("ensurePayrollTablesExist: verified enterprise payroll tables and statutory baseline data exist");
  } catch (error) {
    logger.error({ err: error }, "ensurePayrollTablesExist failed");
  }
}

export async function ensureTemporalLedgerTablesExist(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS temporal_transaction_snapshots (
        id SERIAL PRIMARY KEY,
        transaction_number TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        entity_reference TEXT,
        entity_name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_title TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        valid_from TIMESTAMPTZ NOT NULL,
        valid_to TIMESTAMPTZ,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        actor_name TEXT NOT NULL DEFAULT 'System Authority',
        actor_role TEXT DEFAULT 'hr_officer',
        agency_id INTEGER REFERENCES agencies(id) ON DELETE SET NULL,
        previous_state JSONB,
        snapshot_state JSONB NOT NULL,
        diff JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        checksum TEXT,
        is_locked BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_temporal_entity ON temporal_transaction_snapshots(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_temporal_valid_range ON temporal_transaction_snapshots(valid_from, valid_to);
      CREATE INDEX IF NOT EXISTS idx_temporal_recorded_at ON temporal_transaction_snapshots(recorded_at);
      CREATE INDEX IF NOT EXISTS idx_temporal_event_type ON temporal_transaction_snapshots(event_type);
    `);

    const countRes = await db.execute(sql`SELECT count(*)::int as count FROM temporal_transaction_snapshots;`);
    const count = (countRes.rows[0] as any)?.count || 0;

    if (count === 0) {
      // Fetch seeded employees to generate rich multi-epoch history spanning from hire date to present
      const emps = (await db.execute(sql`
        SELECT 
          e.id, e.employee_number, e.name, e.email, e.start_date, e.grade_level,
          d.name as department_name, p.title as position_title,
          c.type as contract_type, c.salary as contract_salary, c.start_date as contract_start,
          prof.annual_base_salary, prof.housing_allowance, prof.utility_allowance, prof.transport_allowance,
          prof.housing_allowance_type, prof.housing_allowance_rate, prof.super_fund, prof.tin
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN positions p ON p.id = e.position_id
        LEFT JOIN contracts c ON c.employee_id = e.id
        LEFT JOIN employee_salary_profiles prof ON prof.employee_id = e.id
        ORDER BY e.id ASC;
      `)).rows as any[];

      for (const emp of emps) {
        const empCode = emp.employee_number || `EMP${String(emp.id).padStart(4, "0")}`;
        const startDate = emp.start_date ? new Date(emp.start_date) : new Date("2020-01-01");
        
        // 1. Initial Appointment Transaction (Inception / Time Immemorial)
        const initialDate = startDate.toISOString();
        const initialGrade = "Grade 10";
        const initialSalary = 36000;
        const initialDept = emp.department_name || "Corporate Services";
        const initialTitle = `Assistant ${emp.position_title || "Officer"}`;
        
        const initialSnapshot = {
          name: emp.name,
          employeeNumber: empCode,
          email: emp.email,
          positionTitle: initialTitle,
          departmentName: initialDept,
          gradeLevel: initialGrade,
          annualBaseSalary: initialSalary,
          fortnightlyBase: Math.round((initialSalary / 26) * 100) / 100,
          status: "active",
          employmentType: "probationary",
          housingAllowance: 250,
          housingAllowanceType: "fixed",
          utilityAllowance: 80,
          utilityAllowanceType: "fixed",
          transportAllowance: 100,
          transportAllowanceType: "fixed",
          superFund: "Nasfund",
          tin: emp.tin || "500123987",
        };

        const txn1 = `TXN-${startDate.getFullYear()}-EMP-${emp.id}-001`;
        const checksum1 = crypto.createHash("sha256").update(`${txn1}|employee|${emp.id}|${initialDate}`).digest("hex");

        // Intermediate Promotion / Contract Extension Date (2.5 years after start)
        const intermediateDateObj = new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 365 * 2.5);
        if (intermediateDateObj.getFullYear() > 2024) {
          intermediateDateObj.setFullYear(2024);
        }
        const intermediateDate = intermediateDateObj.toISOString();

        // Insert initial hire epoch
        await db.execute(sql`
          INSERT INTO temporal_transaction_snapshots (
            transaction_number, entity_type, entity_id, entity_reference, entity_name,
            event_type, event_title, change_summary, valid_from, valid_to,
            recorded_at, actor_name, actor_role, snapshot_state, diff, metadata, checksum, is_locked
          ) VALUES (
            ${txn1}, 'employee', ${emp.id}, ${empCode}, ${emp.name},
            'initial_hire', ${'Gazetted Public Service Appointment & Induction'},
            ${`Initial statutory appointment as ${initialTitle} in ${initialDept} on ${startDate.toLocaleDateString('en-PG')}`},
            ${initialDate}::timestamptz, ${intermediateDate}::timestamptz,
            ${initialDate}::timestamptz, 'National Public Service Commission', 'commissioner',
            ${JSON.stringify(initialSnapshot)}::jsonb,
            ${JSON.stringify({ event: 'Initial gazetted appointment under Public Services Management Act' })}::jsonb,
            ${JSON.stringify({ gazetteNotice: `PNG-GZ-${startDate.getFullYear()}-${emp.id * 107}`, salaryScale: initialGrade })}::jsonb,
            ${checksum1}, TRUE
          );
        `);

        // 2. Promotion & Reclassification Transaction
        const intermediateSalary = Math.round(initialSalary * 1.35);
        const intermediateSnapshot = {
          ...initialSnapshot,
          positionTitle: emp.position_title || "Technical Officer",
          gradeLevel: emp.grade_level || "Grade 12",
          annualBaseSalary: intermediateSalary,
          fortnightlyBase: Math.round((intermediateSalary / 26) * 100) / 100,
          employmentType: emp.contract_type || "permanent",
          housingAllowance: 400,
          housingAllowanceType: "fixed",
          utilityAllowance: 120,
          utilityAllowanceType: "fixed",
          transportAllowance: 150,
          transportAllowanceType: "fixed",
        };

        const txn2 = `TXN-${intermediateDateObj.getFullYear()}-EMP-${emp.id}-002`;
        const checksum2 = crypto.createHash("sha256").update(`${txn2}|employee|${emp.id}|${intermediateDate}`).digest("hex");
        
        // 3. Current Active Epoch (Effective 2026-01-01)
        const currentEffectiveDate = '2026-01-01T00:00:00Z';

        await db.execute(sql`
          INSERT INTO temporal_transaction_snapshots (
            transaction_number, entity_type, entity_id, entity_reference, entity_name,
            event_type, event_title, change_summary, valid_from, valid_to,
            recorded_at, actor_name, actor_role, previous_state, snapshot_state, diff, metadata, checksum, is_locked
          ) VALUES (
            ${txn2}, 'employee', ${emp.id}, ${empCode}, ${emp.name},
            'promotion', ${'Merit Promotion & Classification Progression'},
            ${`Promoted to ${emp.position_title || 'Officer'} (Grade Level ${emp.grade_level || 'Grade 12'}) following staff appraisal review`},
            ${intermediateDate}::timestamptz, ${currentEffectiveDate}::timestamptz,
            ${intermediateDate}::timestamptz, 'NISIT Staff Appointment & Promotion Committee', 'executive',
            ${JSON.stringify(initialSnapshot)}::jsonb,
            ${JSON.stringify(intermediateSnapshot)}::jsonb,
            ${JSON.stringify({
              annualBaseSalary: { from: initialSalary, to: intermediateSalary },
              gradeLevel: { from: initialGrade, to: emp.grade_level || "Grade 12" },
              positionTitle: { from: initialTitle, to: emp.position_title }
            })}::jsonb,
            ${JSON.stringify({ appraisalScore: "94.5%", promotionCommitteeRef: `SAPC-${intermediateDateObj.getFullYear()}-${emp.id}` })}::jsonb,
            ${checksum2}, TRUE
          );
        `);

        // 4. Current State (Valid from 2026-01-01 into Present / Time Immemorial forward)
        const currentSalary = Number(emp.annual_base_salary) > 0 ? Number(emp.annual_base_salary) : (emp.contract_salary ? Number(emp.contract_salary) : 54000);
        const currentSnapshot = {
          name: emp.name,
          employeeNumber: empCode,
          email: emp.email,
          positionTitle: emp.position_title,
          departmentName: emp.department_name,
          gradeLevel: emp.grade_level || "Grade 12",
          annualBaseSalary: currentSalary,
          fortnightlyBase: Math.round((currentSalary / 26) * 100) / 100,
          status: "active",
          employmentType: emp.contract_type || "permanent",
          housingAllowance: Number(emp.housing_allowance) || 400,
          housingAllowanceType: emp.housing_allowance_type || "fixed",
          housingAllowanceRate: emp.housing_allowance_rate || "15",
          utilityAllowance: Number(emp.utility_allowance) || 120,
          utilityAllowanceType: "fixed",
          transportAllowance: Number(emp.transport_allowance) || 150,
          transportAllowanceType: "fixed",
          superFund: emp.super_fund || "Nasfund",
          tin: emp.tin || "500123987",
        };

        const txn3 = `TXN-2026-EMP-${emp.id}-003`;
        const checksum3 = crypto.createHash("sha256").update(`${txn3}|employee|${emp.id}|${currentEffectiveDate}`).digest("hex");

        await db.execute(sql`
          INSERT INTO temporal_transaction_snapshots (
            transaction_number, entity_type, entity_id, entity_reference, entity_name,
            event_type, event_title, change_summary, valid_from, valid_to,
            recorded_at, actor_name, actor_role, previous_state, snapshot_state, diff, metadata, checksum, is_locked
          ) VALUES (
            ${txn3}, 'employee', ${emp.id}, ${empCode}, ${emp.name},
            'allowance_configured', ${'Public Service General Orders Remuneration Alignment & Allowance Modernization'},
            ${`Modernized remuneration package with configurable allowance model (${currentSnapshot.housingAllowanceType === 'percentage' ? `${currentSnapshot.housingAllowanceRate}%` : `K${currentSnapshot.housingAllowance}`} housing) and base salary K${currentSalary.toLocaleString()}`},
            ${currentEffectiveDate}::timestamptz, NULL,
            '2026-01-01 08:00:00+10'::timestamptz, 'Director General NISIT', 'executive',
            ${JSON.stringify(intermediateSnapshot)}::jsonb,
            ${JSON.stringify(currentSnapshot)}::jsonb,
            ${JSON.stringify({
              annualBaseSalary: { from: intermediateSalary, to: currentSalary },
              housingAllowance: { from: 400, to: currentSnapshot.housingAllowance },
              allowanceModel: { from: "fixed", to: currentSnapshot.housingAllowanceType }
            })}::jsonb,
            ${JSON.stringify({ determinationOrder: "NISIT-DOR-2026-01", statutoryGazette: "PNG-GZ-2026-N44" })}::jsonb,
            ${checksum3}, TRUE
          );
        `);
      }
    }

    logger.info("ensureTemporalLedgerTablesExist: verified temporal transaction ledger and multi-epoch history");
  } catch (error) {
    logger.error({ err: error }, "ensureTemporalLedgerTablesExist failed");
  }
}

export async function alignOrganizationalPositionsAndHierarchy(): Promise<void> {
  try {
    const [agency] = await db.select().from(agenciesTable).limit(1);
    const agencyId = agency?.id || 1;

    // 1. Ensure all 7 official 2024 statutory divisions exist
    const deptDefs = [
      { id: 1, name: "Office of the Director General", code: "DIV-ODG" },
      { id: 2, name: "Corporate Service Division", code: "DIV-CSD" },
      { id: 3, name: "Accreditation Division", code: "DIV-ACD" },
      { id: 4, name: "Certification Division", code: "DIV-CRD" },
      { id: 5, name: "Standards Development Division", code: "DIV-SDD" },
      { id: 6, name: "Metrology Division", code: "DIV-MD" },
      { id: 7, name: "Radiation Safety & Control Division", code: "DIV-RSD" },
    ];

    for (const d of deptDefs) {
      const [existing] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, d.id));
      if (existing) {
        await db.update(departmentsTable).set({ name: d.name, code: d.code, agencyId }).where(eq(departmentsTable.id, d.id));
      } else {
        await db.insert(departmentsTable).values({ id: d.id, name: d.name, code: d.code, agencyId });
      }
    }

    // 2. Upsert all 131 establishment position specifications according to 2024 Organizational Structure
    const establishmentPositions: Array<{ positionCode: string; title: string; departmentId: number; gradeLevel: string; totalCount: number; reportsToTitle: string }> = [
      { positionCode: "NISIT-POS-ODG-001", title: "Director General, NISIT", departmentId: 1, gradeLevel: "Grade 20", totalCount: 1, reportsToTitle: "NISIT Council" },
      { positionCode: "NISIT-POS-ODG-002", title: "Executive Officer", departmentId: 1, gradeLevel: "Grade 15", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ODG-003", title: "Legal Officer", departmentId: 1, gradeLevel: "Grade 15", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ODG-004", title: "Internal Auditor", departmentId: 1, gradeLevel: "Grade 15", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ODG-005", title: "Media and Public Relations Officer", departmentId: 1, gradeLevel: "Grade 13", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ODG-006", title: "Executive Secretary", departmentId: 1, gradeLevel: "Grade 13", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ODG-007", title: "Driver", departmentId: 1, gradeLevel: "Grade 10", totalCount: 1, reportsToTitle: "Executive Secretary" },
      { positionCode: "NISIT-POS-ODG-008", title: "Manager Compliance and Enforcement", departmentId: 1, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ODG-009", title: "Compliance Officer", departmentId: 1, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Manager Compliance and Enforcement" },
      { positionCode: "NISIT-POS-ODG-010", title: "Enforcement Officer", departmentId: 1, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Manager Compliance and Enforcement" },
      { positionCode: "NISIT-POS-CSD-001", title: "Executive Manager, Corporate Service Division", departmentId: 2, gradeLevel: "Grade 18", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-CSD-002", title: "Executive Assistant", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Executive Manager, Corporate Service Division" },
      { positionCode: "NISIT-POS-CSD-003", title: "Manager, Human Resource and Administration", departmentId: 2, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Corporate Service Division" },
      { positionCode: "NISIT-POS-CSD-004", title: "Senior HR Officer", departmentId: 2, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Human Resource and Administration" },
      { positionCode: "NISIT-POS-CSD-005", title: "HR Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior HR Officer" },
      { positionCode: "NISIT-POS-CSD-006", title: "Assistant HR Officer", departmentId: 2, gradeLevel: "Grade 11", totalCount: 1, reportsToTitle: "HR Officer" },
      { positionCode: "NISIT-POS-CSD-007", title: "Staff Training and Development Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior HR Officer" },
      { positionCode: "NISIT-POS-CSD-008", title: "HR Payroll Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior HR Officer" },
      { positionCode: "NISIT-POS-CSD-009", title: "Senior Administration Officer", departmentId: 2, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Human Resource and Administration" },
      { positionCode: "NISIT-POS-CSD-010", title: "Administration Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Administration Officer" },
      { positionCode: "NISIT-POS-CSD-011", title: "Janitor, Male", departmentId: 2, gradeLevel: "Grade 10", totalCount: 1, reportsToTitle: "Administration Officer" },
      { positionCode: "NISIT-POS-CSD-012", title: "Janitor, Female", departmentId: 2, gradeLevel: "Grade 10", totalCount: 1, reportsToTitle: "Administration Officer" },
      { positionCode: "NISIT-POS-CSD-013", title: "Receptionist", departmentId: 2, gradeLevel: "Grade 11", totalCount: 1, reportsToTitle: "Senior Administration Officer" },
      { positionCode: "NISIT-POS-CSD-014", title: "Driver", departmentId: 2, gradeLevel: "Grade 10", totalCount: 1, reportsToTitle: "Senior Administration Officer" },
      { positionCode: "NISIT-POS-CSD-015", title: "Senior Business Development Officer", departmentId: 2, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Human Resource and Administration" },
      { positionCode: "NISIT-POS-CSD-016", title: "Marketing Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Business Development Officer" },
      { positionCode: "NISIT-POS-CSD-017", title: "Manager, Finance", departmentId: 2, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Corporate Service Division" },
      { positionCode: "NISIT-POS-CSD-018", title: "Senior Accountant", departmentId: 2, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Finance" },
      { positionCode: "NISIT-POS-CSD-019", title: "Accounts Payable", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Accountant" },
      { positionCode: "NISIT-POS-CSD-020", title: "Accounts Receivable", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Accountant" },
      { positionCode: "NISIT-POS-CSD-021", title: "Asset Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Accountant" },
      { positionCode: "NISIT-POS-CSD-022", title: "Senior Information Technology Officer", departmentId: 2, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Finance" },
      { positionCode: "NISIT-POS-CSD-023", title: "Information Technology Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Information Technology Officer" },
      { positionCode: "NISIT-POS-CSD-024", title: "Senior Information Officer", departmentId: 2, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Finance" },
      { positionCode: "NISIT-POS-CSD-025", title: "Publication and Sales Officer", departmentId: 2, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Information Officer" },
      { positionCode: "NISIT-POS-ACD-001", title: "Executive Manager, Accreditation Division", departmentId: 3, gradeLevel: "Grade 18", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-ACD-002", title: "Executive Assistant", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Executive Manager, Accreditation Division" },
      { positionCode: "NISIT-POS-ACD-003", title: "Manager, Laboratory Accreditation", departmentId: 3, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Accreditation Division" },
      { positionCode: "NISIT-POS-ACD-004", title: "Senior Laboratory Accreditation Officer (Testing / Calibration)", departmentId: 3, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Laboratory Accreditation" },
      { positionCode: "NISIT-POS-ACD-005", title: "Laboratory Accreditation Officer, Mechanical", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer (Testing / Calibration)" },
      { positionCode: "NISIT-POS-ACD-006", title: "Assistant Laboratory Accreditation Officer, Mechanical", departmentId: 3, gradeLevel: "Grade 11", totalCount: 1, reportsToTitle: "Laboratory Accreditation Officer, Mechanical" },
      { positionCode: "NISIT-POS-ACD-007", title: "Laboratory Accreditation Officer, CMT", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer (Testing / Calibration)" },
      { positionCode: "NISIT-POS-ACD-008", title: "Assistant Laboratory Accreditation Officer, CMT", departmentId: 3, gradeLevel: "Grade 11", totalCount: 1, reportsToTitle: "Laboratory Accreditation Officer, CMT" },
      { positionCode: "NISIT-POS-ACD-009", title: "Senior Laboratory Accreditation Officer (Medical / Biological)", departmentId: 3, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Laboratory Accreditation" },
      { positionCode: "NISIT-POS-ACD-010", title: "Laboratory Accreditation Officer, Chemical", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer (Medical / Biological)" },
      { positionCode: "NISIT-POS-ACD-011", title: "Assistant Laboratory Accreditation Officer, Chemical", departmentId: 3, gradeLevel: "Grade 11", totalCount: 1, reportsToTitle: "Laboratory Accreditation Officer, Chemical" },
      { positionCode: "NISIT-POS-ACD-012", title: "Laboratory Accreditation Officer, Biological", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer (Medical / Biological)" },
      { positionCode: "NISIT-POS-ACD-013", title: "Assistant Laboratory Accreditation Officer, Biological", departmentId: 3, gradeLevel: "Grade 11", totalCount: 1, reportsToTitle: "Laboratory Accreditation Officer, Biological" },
      { positionCode: "NISIT-POS-ACD-014", title: "Manager, Quality Assurance", departmentId: 3, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Accreditation Division" },
      { positionCode: "NISIT-POS-ACD-015", title: "Senior Quality Assurance Officer", departmentId: 3, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Quality Assurance" },
      { positionCode: "NISIT-POS-ACD-016", title: "Quality Assurance Officer", departmentId: 3, gradeLevel: "Grade 12", totalCount: 2, reportsToTitle: "Senior Quality Assurance Officer" },
      { positionCode: "NISIT-POS-ACD-017", title: "Manager, Accreditation of Conformity Assessment Bodies", departmentId: 3, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Accreditation Division" },
      { positionCode: "NISIT-POS-ACD-018", title: "Senior Laboratory Accreditation Officer, CAB (Inspection)", departmentId: 3, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Accreditation of Conformity Assessment Bodies" },
      { positionCode: "NISIT-POS-ACD-019", title: "Accreditation Officer, Inspection Bodies", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer, CAB (Inspection)" },
      { positionCode: "NISIT-POS-ACD-020", title: "Accreditation Officer, GHG Validation Verification Body", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer, CAB (Inspection)" },
      { positionCode: "NISIT-POS-ACD-021", title: "Senior Laboratory Accreditation Officer, CAB (Certification)", departmentId: 3, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Accreditation of Conformity Assessment Bodies" },
      { positionCode: "NISIT-POS-ACD-022", title: "Accreditation Officer, Personnel Certification Body", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer, CAB (Certification)" },
      { positionCode: "NISIT-POS-ACD-023", title: "Accreditation Officer, Management Certification Body", departmentId: 3, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Laboratory Accreditation Officer, CAB (Certification)" },
      { positionCode: "NISIT-POS-CRD-001", title: "Executive Manager, Certification Division", departmentId: 4, gradeLevel: "Grade 18", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-CRD-002", title: "Executive Assistant", departmentId: 4, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Executive Manager, Certification Division" },
      { positionCode: "NISIT-POS-CRD-003", title: "Manager, Management Systems Certification", departmentId: 4, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Certification Division" },
      { positionCode: "NISIT-POS-CRD-004", title: "Senior Auditor, QMS and FSMS", departmentId: 4, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Management Systems Certification" },
      { positionCode: "NISIT-POS-CRD-005", title: "Auditor, QMS and FSMS", departmentId: 4, gradeLevel: "Grade 12", totalCount: 2, reportsToTitle: "Senior Auditor, QMS and FSMS" },
      { positionCode: "NISIT-POS-CRD-006", title: "Senior Auditor, FSMS", departmentId: 4, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Management Systems Certification" },
      { positionCode: "NISIT-POS-CRD-007", title: "Auditor, FSMS", departmentId: 4, gradeLevel: "Grade 12", totalCount: 2, reportsToTitle: "Senior Auditor, FSMS" },
      { positionCode: "NISIT-POS-CRD-008", title: "Senior Auditor, Environment/Energy MS", departmentId: 4, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Management Systems Certification" },
      { positionCode: "NISIT-POS-CRD-009", title: "Auditor, EMS", departmentId: 4, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Auditor, Environment/Energy MS" },
      { positionCode: "NISIT-POS-CRD-010", title: "Auditor, EEMS", departmentId: 4, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Auditor, Environment/Energy MS" },
      { positionCode: "NISIT-POS-CRD-011", title: "Manager, Product Certification", departmentId: 4, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Certification Division" },
      { positionCode: "NISIT-POS-CRD-012", title: "Senior Product Certification Research Officer", departmentId: 4, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Product Certification" },
      { positionCode: "NISIT-POS-CRD-013", title: "Product Certification Officer", departmentId: 4, gradeLevel: "Grade 12", totalCount: 2, reportsToTitle: "Senior Product Certification Research Officer" },
      { positionCode: "NISIT-POS-CRD-014", title: "Manager, Certification Standards and Training", departmentId: 4, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Certification Division" },
      { positionCode: "NISIT-POS-CRD-015", title: "Senior Training Coordinator", departmentId: 4, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Certification Standards and Training" },
      { positionCode: "NISIT-POS-CRD-016", title: "Training Coordinator", departmentId: 4, gradeLevel: "Grade 12", totalCount: 2, reportsToTitle: "Senior Training Coordinator" },
      { positionCode: "NISIT-POS-SDD-001", title: "Executive Manager, Standards Development Division", departmentId: 5, gradeLevel: "Grade 18", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-SDD-002", title: "Executive Assistant", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Executive Manager, Standards Development Division" },
      { positionCode: "NISIT-POS-SDD-003", title: "Manager, Infrastructure and Service Standards", departmentId: 5, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Standards Development Division" },
      { positionCode: "NISIT-POS-SDD-004", title: "Senior Projects Coordinator, Building Standards", departmentId: 5, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Infrastructure and Service Standards" },
      { positionCode: "NISIT-POS-SDD-005", title: "Project Coordinator, Service Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Building Standards" },
      { positionCode: "NISIT-POS-SDD-006", title: "Project Coordinator, Construction Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Building Standards" },
      { positionCode: "NISIT-POS-SDD-007", title: "Manager, Chemical and Biological Standards", departmentId: 5, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Standards Development Division" },
      { positionCode: "NISIT-POS-SDD-008", title: "Senior Projects Coordinator, Food Standards", departmentId: 5, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Chemical and Biological Standards" },
      { positionCode: "NISIT-POS-SDD-009", title: "Project Coordinator, Industrial Chemistry Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Food Standards" },
      { positionCode: "NISIT-POS-SDD-010", title: "Project Coordinator, Organic Chemistry Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Food Standards" },
      { positionCode: "NISIT-POS-SDD-011", title: "Project Coordinator, Biology Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Food Standards" },
      { positionCode: "NISIT-POS-SDD-012", title: "Manager, Electrical and Mechanical Standards", departmentId: 5, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Standards Development Division" },
      { positionCode: "NISIT-POS-SDD-013", title: "Senior Projects Coordinator, Electrical Appliance Standards", departmentId: 5, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Electrical and Mechanical Standards" },
      { positionCode: "NISIT-POS-SDD-014", title: "Project Coordinator, Electronic and Renewable Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Electrical Appliance Standards" },
      { positionCode: "NISIT-POS-SDD-015", title: "Project Coordinator, Mechanical Standards", departmentId: 5, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Projects Coordinator, Electrical Appliance Standards" },
      { positionCode: "NISIT-POS-MD-001", title: "Executive Manager, Metrology Division", departmentId: 6, gradeLevel: "Grade 18", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-MD-002", title: "Executive Assistant", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Executive Manager, Metrology Division" },
      { positionCode: "NISIT-POS-MD-003", title: "Manager, Scientific & Industrial Metrology", departmentId: 6, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Metrology Division" },
      { positionCode: "NISIT-POS-MD-004", title: "Senior SI Metrologist 1 (Physical / Mechanical)", departmentId: 6, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Scientific & Industrial Metrology" },
      { positionCode: "NISIT-POS-MD-005", title: "Mass Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 1 (Physical / Mechanical)" },
      { positionCode: "NISIT-POS-MD-006", title: "Pressure Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 1 (Physical / Mechanical)" },
      { positionCode: "NISIT-POS-MD-007", title: "Force Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 1 (Physical / Mechanical)" },
      { positionCode: "NISIT-POS-MD-008", title: "Torque Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 1 (Physical / Mechanical)" },
      { positionCode: "NISIT-POS-MD-009", title: "Senior SI Metrologist 2 (Electrical / Thermal)", departmentId: 6, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Scientific & Industrial Metrology" },
      { positionCode: "NISIT-POS-MD-010", title: "Electrical Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 2 (Electrical / Thermal)" },
      { positionCode: "NISIT-POS-MD-011", title: "Temperature Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 2 (Electrical / Thermal)" },
      { positionCode: "NISIT-POS-MD-012", title: "Length Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 2 (Electrical / Thermal)" },
      { positionCode: "NISIT-POS-MD-013", title: "Volume/Flow Metrologist (SI)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior SI Metrologist 2 (Electrical / Thermal)" },
      { positionCode: "NISIT-POS-MD-014", title: "Manager, Legal Metrology", departmentId: 6, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Metrology Division" },
      { positionCode: "NISIT-POS-MD-015", title: "Senior Legal Metrologist 1 (Trade Measures)", departmentId: 6, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Legal Metrology" },
      { positionCode: "NISIT-POS-MD-016", title: "Mass Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 1 (Trade Measures)" },
      { positionCode: "NISIT-POS-MD-017", title: "Pressure Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 1 (Trade Measures)" },
      { positionCode: "NISIT-POS-MD-018", title: "Force Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 1 (Trade Measures)" },
      { positionCode: "NISIT-POS-MD-019", title: "Torque Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 1 (Trade Measures)" },
      { positionCode: "NISIT-POS-MD-020", title: "Senior Legal Metrologist 2 (Verification)", departmentId: 6, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager, Legal Metrology" },
      { positionCode: "NISIT-POS-MD-021", title: "Electrical Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 2 (Verification)" },
      { positionCode: "NISIT-POS-MD-022", title: "Temperature Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 2 (Verification)" },
      { positionCode: "NISIT-POS-MD-023", title: "Length Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 2 (Verification)" },
      { positionCode: "NISIT-POS-MD-024", title: "Volume/Flow Metrologist (Legal)", departmentId: 6, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Legal Metrologist 2 (Verification)" },
      { positionCode: "NISIT-POS-RSD-001", title: "Executive Manager, Radiation Safety & Control Division", departmentId: 7, gradeLevel: "Grade 18", totalCount: 1, reportsToTitle: "Director General, NISIT" },
      { positionCode: "NISIT-POS-RSD-002", title: "Executive Assistant", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Executive Manager, Radiation Safety & Control Division" },
      { positionCode: "NISIT-POS-RSD-003", title: "Manager - Notification & Authorisation", departmentId: 7, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Radiation Safety & Control Division" },
      { positionCode: "NISIT-POS-RSD-004", title: "Senior Officer - Notification", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - Notification & Authorisation" },
      { positionCode: "NISIT-POS-RSD-005", title: "Notification Officer", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - Notification" },
      { positionCode: "NISIT-POS-RSD-006", title: "Senior Officer - Authorisation", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - Notification & Authorisation" },
      { positionCode: "NISIT-POS-RSD-007", title: "Authorisation Officer - Registration", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - Authorisation" },
      { positionCode: "NISIT-POS-RSD-008", title: "Authorisation Officer - Licensing", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - Authorisation" },
      { positionCode: "NISIT-POS-RSD-009", title: "Manager - Inspection, Enforcement & Safeguards", departmentId: 7, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Radiation Safety & Control Division" },
      { positionCode: "NISIT-POS-RSD-010", title: "Senior Officer - Inspection (Safety + Security)", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - Inspection, Enforcement & Safeguards" },
      { positionCode: "NISIT-POS-RSD-011", title: "Inspection Officer", departmentId: 7, gradeLevel: "Grade 12", totalCount: 2, reportsToTitle: "Senior Officer - Inspection (Safety + Security)" },
      { positionCode: "NISIT-POS-RSD-012", title: "Senior Officer - Enforcement", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - Inspection, Enforcement & Safeguards" },
      { positionCode: "NISIT-POS-RSD-013", title: "Enforcement Officer", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - Enforcement" },
      { positionCode: "NISIT-POS-RSD-014", title: "Senior Officer - Safeguards & Security", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - Inspection, Enforcement & Safeguards" },
      { positionCode: "NISIT-POS-RSD-015", title: "Safeguards & Security Officer", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - Safeguards & Security" },
      { positionCode: "NISIT-POS-RSD-016", title: "Manager - R&D & Waste Management", departmentId: 7, gradeLevel: "Grade 16", totalCount: 1, reportsToTitle: "Executive Manager, Radiation Safety & Control Division" },
      { positionCode: "NISIT-POS-RSD-017", title: "Senior Officer - R&D", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - R&D & Waste Management" },
      { positionCode: "NISIT-POS-RSD-018", title: "R&D Officer", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - R&D" },
      { positionCode: "NISIT-POS-RSD-019", title: "Senior Officer - Waste Management & Emergency Prep.", departmentId: 7, gradeLevel: "Grade 14", totalCount: 1, reportsToTitle: "Manager - R&D & Waste Management" },
      { positionCode: "NISIT-POS-RSD-020", title: "Waste & Emergency Preparedness Officer", departmentId: 7, gradeLevel: "Grade 12", totalCount: 1, reportsToTitle: "Senior Officer - Waste Management & Emergency Prep." },
    ];

    for (const p of establishmentPositions) {
      const [existing] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, p.positionCode));
      if (existing) {
        await db.update(positionsTable).set({
          title: p.title,
          departmentId: p.departmentId,
          gradeLevel: p.gradeLevel,
          totalCount: p.totalCount,
          reportsToTitle: p.reportsToTitle,
          status: 'active',
          updatedAt: new Date(),
        }).where(eq(positionsTable.id, existing.id));
      } else {
        await db.insert(positionsTable).values({
          positionCode: p.positionCode,
          title: p.title,
          departmentId: p.departmentId,
          gradeLevel: p.gradeLevel,
          totalCount: p.totalCount,
          reportsToTitle: p.reportsToTitle,
          status: 'active',
        });
      }
    }

    // 3. Map active incumbents to their corresponding substantive positions
    const [dgPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-ODG-001'));
    const [finMgrPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-CSD-017'));
    const [hrOffPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-CSD-004'));
    const [hraMgrPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-CSD-003'));
    const [snrItPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-CSD-022'));
    const [itOffPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-CSD-023'));
    const [cabMgrPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-ACD-017'));
    const [stdCoordPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-SDD-004'));
    const [metroPos] = await db.select().from(positionsTable).where(eq(positionsTable.positionCode, 'NISIT-POS-MD-004'));

    if (dgPos) await db.update(employeesTable).set({ positionId: dgPos.id, departmentId: 1, gradeLevel: dgPos.gradeLevel }).where(eq(employeesTable.id, 1));
    if (finMgrPos) await db.update(employeesTable).set({ positionId: finMgrPos.id, departmentId: 2, gradeLevel: finMgrPos.gradeLevel }).where(eq(employeesTable.id, 2));
    if (hrOffPos) await db.update(employeesTable).set({ positionId: hrOffPos.id, departmentId: 2, gradeLevel: hrOffPos.gradeLevel }).where(eq(employeesTable.id, 7));
    if (hraMgrPos) await db.update(employeesTable).set({ positionId: hraMgrPos.id, departmentId: 2, gradeLevel: hraMgrPos.gradeLevel }).where(eq(employeesTable.id, 4));
    if (snrItPos) await db.update(employeesTable).set({ positionId: snrItPos.id, departmentId: 2, gradeLevel: snrItPos.gradeLevel }).where(eq(employeesTable.id, 3));
    if (itOffPos) {
      await db.update(employeesTable).set({ positionId: itOffPos.id, departmentId: 2, gradeLevel: itOffPos.gradeLevel }).where(eq(employeesTable.id, 10));
      await db.update(employeesTable).set({ positionId: itOffPos.id, departmentId: 2, gradeLevel: itOffPos.gradeLevel }).where(eq(employeesTable.id, 8));
    }
    if (cabMgrPos) await db.update(employeesTable).set({ positionId: cabMgrPos.id, departmentId: 3, gradeLevel: cabMgrPos.gradeLevel }).where(eq(employeesTable.id, 9));
    if (stdCoordPos) await db.update(employeesTable).set({ positionId: stdCoordPos.id, departmentId: 5, gradeLevel: stdCoordPos.gradeLevel }).where(eq(employeesTable.id, 5));
    if (metroPos) await db.update(employeesTable).set({ positionId: metroPos.id, departmentId: 6, gradeLevel: metroPos.gradeLevel }).where(eq(employeesTable.id, 6));

    // 4. Update Director General Apex Executive Configuration
    if (agency) {
      const currentConfig = (agency.configuration as Record<string, any> | null) || {};
      await db.update(agenciesTable).set({
        configuration: {
          ...currentConfig,
          directorGeneral: {
            name: 'Margaret Mala Tolo',
            title: 'Director General, NISIT',
            email: 'm.tolo@nisit.gov.pg',
            gradeLevel: 'Grade 20',
            employeeId: 1,
          },
        },
        updatedAt: new Date(),
      }).where(eq(agenciesTable.id, agency.id));
    }

    // 5. Recalculate filledCount on all positions and archive legacy unassigned boilerplate positions
    const validCodes = establishmentPositions.map(p => p.positionCode);
    const allEmps = await db.select().from(employeesTable).where(eq(employeesTable.status, 'active'));
    const allPositions = await db.select().from(positionsTable);
    for (const pos of allPositions) {
      const filled = allEmps.filter(e => e.positionId === pos.id).length;
      const isEstablishment = pos.positionCode && validCodes.includes(pos.positionCode);
      const newStatus = isEstablishment ? 'active' : (filled > 0 ? 'active' : 'archived');
      await db.update(positionsTable).set({ filledCount: filled, status: newStatus }).where(eq(positionsTable.id, pos.id));
    }

    // 6. Explicitly resolve and link parentPositionId on every establishment position
    const activePositions = await db.select().from(positionsTable).where(eq(positionsTable.status, 'active'));
    const titleToPosMap = new Map<string, typeof positionsTable.$inferSelect>();
    for (const p of activePositions) {
      titleToPosMap.set(p.title.toLowerCase().trim(), p);
    }

    for (const pos of activePositions) {
      let parentId: number | null = null;
      if (pos.reportsToTitle && pos.reportsToTitle.trim().toLowerCase() !== "nisit council") {
        const parentPos = titleToPosMap.get(pos.reportsToTitle.trim().toLowerCase());
        if (parentPos) {
          parentId = parentPos.id;
        } else {
          for (const [key, p] of titleToPosMap.entries()) {
            if (key.includes(pos.reportsToTitle.trim().toLowerCase()) || pos.reportsToTitle.trim().toLowerCase().includes(key)) {
              parentId = p.id;
              break;
            }
          }
        }
      }
      await db.update(positionsTable).set({ parentPositionId: parentId }).where(eq(positionsTable.id, pos.id));
    }

    // 7. Align supervisory reporting lines for all active personnel in employeesTable
    const allActiveEmps = await db.select().from(employeesTable).where(eq(employeesTable.status, 'active'));
    const linkedPositions = await db.select().from(positionsTable);
    for (const emp of allActiveEmps) {
      if (!emp.positionId) continue;
      const empPos = linkedPositions.find(p => p.id === emp.positionId);
      if (empPos?.parentPositionId) {
        const supervisorEmp = allActiveEmps.find(e => e.positionId === empPos.parentPositionId);
        if (supervisorEmp) {
          await db.update(employeesTable).set({ supervisorId: supervisorEmp.id }).where(eq(employeesTable.id, emp.id));
        } else if (emp.id !== 1) {
          // If direct supervisor position is vacant, fallback to Director General (id 1)
          await db.update(employeesTable).set({ supervisorId: 1 }).where(eq(employeesTable.id, emp.id));
        }
      } else if (empPos?.reportsToTitle === "NISIT Council" || emp.id === 1) {
        await db.update(employeesTable).set({ supervisorId: null }).where(eq(employeesTable.id, emp.id));
      }
    }

    logger.info('alignOrganizationalPositionsAndHierarchy: successfully aligned NISIT 2024 establishment positions, reporting lines, and organizational hierarchy');
  } catch (error) {
    logger.error({ err: error }, 'alignOrganizationalPositionsAndHierarchy failed');
  }
}

export async function ensureEmployeeNumbersExist(): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE employees 
      SET employee_number = 'NISIT-EMP-' || (10000 + id)::text 
      WHERE employee_number IS NULL OR employee_number = '';
    `);
    logger.info('ensureEmployeeNumbersExist: verified all personnel have statutory employee numbers');
  } catch (error) {
    logger.error({ err: error }, 'ensureEmployeeNumbersExist failed');
  }
}

