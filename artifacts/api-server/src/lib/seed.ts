import { eq, count } from "drizzle-orm";
import { db, rolesTable, agenciesTable, departmentsTable, jobsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_ROLES = [
  { name: "admin", permissions: { all: true } },
  { name: "hr_officer", permissions: { jobs: true, applications: true, candidates: true, employees: true, contracts: true } },
  { name: "hiring_manager", permissions: { applications: ["read", "review"], candidates: ["read"] } },
  { name: "executive", permissions: { dashboard: true, employees: ["read"], contracts: ["read"] } },
  { name: "applicant", permissions: { jobs: ["read"], applications: ["create", "read"] } },
];

const NISIT_AGENCY_NAME = "PNG National Institute of Standards and Industrial Technology";

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

  const jobs = vacancies(deptMap, agency.id);
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

    await seedJobVacancies();
  } catch (err) {
    logger.error(err, "Seed failed (non-fatal)");
  }
}
