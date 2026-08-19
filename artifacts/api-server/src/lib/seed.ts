import { and, eq, count, isNull, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, rolesTable, agenciesTable, departmentsTable, jobsTable, usersTable, candidatesTable, permissionsTable, rolePermissionsTable, wikiArticlesTable } from "@workspace/db";
import { logger } from "./logger";
import { seedCompleteData, seedPrdReferenceData } from "./seed-data";

const DEFAULT_ROLES = [
  { name: "admin", permissions: { all: true } },
  { name: "hr_officer", permissions: { jobs: true, applications: true, candidates: true, employees: true, contracts: true } },
  { name: "hiring_manager", permissions: { applications: ["read", "review"], candidates: ["read"] } },
  { name: "executive", permissions: { dashboard: true, employees: ["read"], contracts: ["read"] } },
  { name: "applicant", permissions: { jobs: ["read"], applications: ["create", "read"] } },
];

const DEFAULT_PERMISSION_GRANTS = [
  { role: "admin", resource: "documents", action: "read", scope: "organisation" },
  { role: "admin", resource: "documents", action: "create", scope: "organisation" },
  { role: "admin", resource: "documents", action: "delete", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "read", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "create", scope: "organisation" },
  { role: "hr_officer", resource: "documents", action: "delete", scope: "organisation" },
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

    await seedAdminUser();
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

async function seedAdminUser(): Promise<void> {
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.name, NISIT_AGENCY_NAME));
  if (!agency) {
    logger.warn("seedAdminUser: NISIT agency not found, skipping");
    return;
  }

  const ADMIN_EMAIL = "admin@nisit.gov.pg";
  const existing = await db.select({ id: usersTable.id, agencyId: usersTable.agencyId })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing.length > 0) {
    const adminUser = existing[0];
    if (adminUser.agencyId !== agency.id) {
      await db.update(usersTable).set({ agencyId: agency.id }).where(eq(usersTable.id, adminUser.id));
      logger.info({ adminId: adminUser.id, agencyId: agency.id }, "seedAdminUser: corrected admin agencyId to NISIT agency");
    } else {
      logger.info("seedAdminUser: admin user already exists with correct agencyId, skipping");
    }
    return;
  }

  const adminRoles = await db.select().from(rolesTable).where(eq(rolesTable.name, "admin"));
  if (adminRoles.length === 0) {
    logger.warn("seedAdminUser: admin role not found, skipping");
    return;
  }

  const passwordHash = await bcrypt.hash("Admin123!", 10);
  await db.insert(usersTable).values({
    name: "NISIT Administrator",
    email: ADMIN_EMAIL,
    passwordHash,
    agencyId: agency.id,
    roleId: adminRoles[0].id,
    status: "active",
  });
  logger.info({ email: ADMIN_EMAIL }, "seedAdminUser: seeded default NISIT admin user");
}
