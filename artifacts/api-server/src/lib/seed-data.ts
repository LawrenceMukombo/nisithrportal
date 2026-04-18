/**
 * seed-data.ts
 * Comprehensive seed function for candidates, applications, employees,
 * contracts, positions, and screening questions.
 * Called once at startup if the candidates table is empty.
 */
import { and, count as countFn, eq, inArray } from "drizzle-orm";
import {
  db,
  agenciesTable,
  departmentsTable,
  positionsTable,
  candidatesTable,
  candidateEducationTable,
  candidateExperienceTable,
  candidateSkillsTable,
  candidateLanguagesTable,
  candidateDiversityTable,
  jobsTable,
  jobScreeningQuestionsTable,
  applicationsTable,
  applicationStatusHistoryTable,
  applicationDocumentsTable,
  applicationScreeningAnswersTable,
  candidateRefereesTable,
  employeesTable,
  contractsTable,
} from "@workspace/db";
import { logger } from "./logger";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NISIT_AGENCY_NAME = "PNG National Institute of Standards and Industrial Technology";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function dateStr(daysBack: number): string {
  return daysAgo(daysBack).toISOString().slice(0, 10);
}

// ─── Positions ────────────────────────────────────────────────────────────────

const POSITION_DEFS = [
  { title: "HR Officer", dept: "Human Resources", filled: 2, total: 3 },
  { title: "Learning & Development Coordinator", dept: "Human Resources", filled: 1, total: 1 },
  { title: "Senior Finance Analyst", dept: "Finance", filled: 1, total: 2 },
  { title: "Procurement Officer", dept: "Finance", filled: 1, total: 1 },
  { title: "Software Developer", dept: "Information Technology", filled: 2, total: 3 },
  { title: "Network Engineer", dept: "Information Technology", filled: 1, total: 2 },
  { title: "ICT Support Officer", dept: "Information Technology", filled: 1, total: 1 },
  { title: "Operations Manager", dept: "Operations", filled: 1, total: 1 },
  { title: "Logistics Officer", dept: "Operations", filled: 1, total: 2 },
  { title: "Standards Technical Officer", dept: "Standards and Metrology", filled: 2, total: 3 },
  { title: "Metrologist", dept: "Standards and Metrology", filled: 1, total: 2 },
  { title: "Industrial Development Officer", dept: "Industrial Development", filled: 1, total: 2 },
];

// ─── Candidates ───────────────────────────────────────────────────────────────

const CANDIDATES = [
  {
    name: "James Kila Morea",
    otherNames: "Kila",
    email: "james.morea@gmail.com",
    phone: "70123456",
    alternativePhone: "7510001",
    gender: "male",
    dateOfBirth: "1990-03-15",
    nationality: "Papua New Guinean",
    nationalId: "PNG-90-031501",
    maritalStatus: "married",
    physicalAddress: "Section 12, Lot 4, Gordons",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-East",
    postalAddress: "PO Box 12345, Port Moresby",
    education: [
      { institution: "University of Papua New Guinea", level: "bachelor", qualification: "Bachelor of Arts (HRM)", fieldOfStudy: "Human Resource Management", startDate: "2009-02-01", endDate: "2012-11-30" },
      { institution: "Port Moresby Technical College", level: "certificate", qualification: "Diploma in Business Administration", fieldOfStudy: "Business", startDate: "2008-01-01", endDate: "2008-12-31" },
    ],
    experience: [
      { employer: "PNG Power Ltd", jobTitle: "HR Assistant", responsibilities: "Assisted in recruitment, maintained personnel files, coordinated staff training events.", startDate: "2013-01-15", endDate: "2016-06-30", reasonForLeaving: "Career advancement", keyAchievements: "Reduced time-to-hire by 20% through streamlined shortlisting process." },
      { employer: "Department of Finance", jobTitle: "HR Officer", responsibilities: "Managed end-to-end recruitment cycles, advised on Public Service General Orders compliance.", startDate: "2016-08-01", endDate: null, current: true, keyAchievements: "Overhauled onboarding program reducing new-hire attrition by 15%." },
    ],
    skills: [
      { skill: "Recruitment & Selection", skillType: "technical" },
      { skill: "HRIS Administration", skillType: "technical" },
      { skill: "Stakeholder Engagement", skillType: "soft" },
      { skill: "Communication", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "native" },
      { language: "Motu", proficiency: "basic" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Motuan" },
  },
  {
    name: "Mary Tau Geno",
    otherNames: "Tau",
    email: "mary.geno@nisit.gov.pg",
    phone: "70234567",
    alternativePhone: "7520002",
    gender: "female",
    dateOfBirth: "1988-07-22",
    nationality: "Papua New Guinean",
    nationalId: "PNG-88-072201",
    maritalStatus: "single",
    physicalAddress: "Unit 7, Ela Beach Flats",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby South",
    postalAddress: "PO Box 7777, Port Moresby",
    education: [
      { institution: "Divine Word University", level: "bachelor", qualification: "Bachelor of Accounting", fieldOfStudy: "Accounting", startDate: "2007-02-01", endDate: "2010-11-30" },
      { institution: "CPA PNG", level: "professional", qualification: "CPA Membership", fieldOfStudy: "Accounting", startDate: "2012-01-01", endDate: "2013-12-31" },
    ],
    experience: [
      { employer: "Bank of Papua New Guinea", jobTitle: "Finance Analyst", responsibilities: "Prepared monthly financial reports, managed variance analysis, and supported budget consolidation.", startDate: "2011-03-01", endDate: "2015-09-30", reasonForLeaving: "Sought government sector experience" },
      { employer: "Department of Treasury", jobTitle: "Senior Finance Analyst", responsibilities: "Led annual budget process, coordinated with PNGIPA on financial compliance matters.", startDate: "2015-10-15", endDate: null, current: true, keyAchievements: "Implemented new chart of accounts reducing year-end reporting errors by 30%." },
    ],
    skills: [
      { skill: "Financial Reporting (IPSAS)", skillType: "technical" },
      { skill: "Budget Formulation", skillType: "technical" },
      { skill: "Microsoft Excel (Advanced)", skillType: "technical" },
      { skill: "Analytical Thinking", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "conversational" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Tolai" },
  },
  {
    name: "Peter Waim Siune",
    otherNames: "Waim",
    email: "peter.siune@gmail.com",
    phone: "70345678",
    alternativePhone: "7530003",
    gender: "male",
    dateOfBirth: "1995-11-03",
    nationality: "Papua New Guinean",
    nationalId: "PNG-95-110301",
    maritalStatus: "single",
    physicalAddress: "Waigani Drive, UPNG Campus Dormitory",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-West",
    postalAddress: "PO Box 3456, Waigani",
    education: [
      { institution: "University of Papua New Guinea", level: "bachelor", qualification: "Bachelor of Computer Science", fieldOfStudy: "Computer Science", startDate: "2014-02-01", endDate: "2018-11-30" },
    ],
    experience: [
      { employer: "Datec PNG Ltd", jobTitle: "Junior Software Developer", responsibilities: "Developed internal web applications using React and Node.js, participated in agile sprints.", startDate: "2019-01-07", endDate: "2021-12-31", reasonForLeaving: "Seeking senior role with broader scope" },
      { employer: "BSP Financial Group", jobTitle: "Software Developer", responsibilities: "Built and maintained banking APIs, integrated with third-party payment gateways.", startDate: "2022-02-01", endDate: null, current: true, keyAchievements: "Led mobile banking API refactor that improved response times by 40%." },
    ],
    skills: [
      { skill: "TypeScript / Node.js", skillType: "technical" },
      { skill: "React", skillType: "technical" },
      { skill: "PostgreSQL", skillType: "technical" },
      { skill: "REST API Design", skillType: "technical" },
      { skill: "Problem Solving", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "native" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Sepik" },
  },
  {
    name: "Elizabeth Kore Haro",
    otherNames: "Liz",
    email: "e.haro@hotmail.com",
    phone: "70456789",
    alternativePhone: "7540004",
    gender: "female",
    dateOfBirth: "1992-05-18",
    nationality: "Papua New Guinean",
    nationalId: "PNG-92-051801",
    maritalStatus: "married",
    physicalAddress: "Lot 22, Section 7, Badili",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby South",
    postalAddress: "PO Box 4422, Boroko",
    education: [
      { institution: "Pacific Adventist University", level: "bachelor", qualification: "Bachelor of Arts (Communications)", fieldOfStudy: "Communications", startDate: "2011-02-01", endDate: "2014-11-30" },
      { institution: "IBIS Institute of PNG", level: "diploma", qualification: "Diploma in Project Management", fieldOfStudy: "Project Management", startDate: "2015-03-01", endDate: "2015-11-30" },
    ],
    experience: [
      { employer: "Digicel PNG", jobTitle: "Communications Officer", responsibilities: "Managed internal and external communications, developed corporate social responsibility content.", startDate: "2015-01-12", endDate: "2018-03-31", reasonForLeaving: "Relocated to public sector" },
      { employer: "Office of the Prime Minister", jobTitle: "Senior Communications & Policy Officer", responsibilities: "Drafted ministerial briefings, managed stakeholder correspondence, organised official functions.", startDate: "2018-06-01", endDate: null, current: true, keyAchievements: "Coordinated APEC 2018 PNG communications strategy across 12 government agencies." },
    ],
    skills: [
      { skill: "Policy Writing", skillType: "technical" },
      { skill: "Stakeholder Management", skillType: "soft" },
      { skill: "Event Management", skillType: "technical" },
      { skill: "Leadership", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
      { language: "Hiri Motu", proficiency: "basic" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Orokolo" },
  },
  {
    name: "David Nali Kambu",
    otherNames: "Nali",
    email: "dnali.kambu@outlook.com",
    phone: "70567890",
    alternativePhone: "7550005",
    gender: "male",
    dateOfBirth: "1985-09-09",
    nationality: "Papua New Guinean",
    nationalId: "PNG-85-090901",
    maritalStatus: "married",
    physicalAddress: "Section 14 Lot 3, Boroko",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-East",
    postalAddress: "PO Box 9988, Boroko",
    education: [
      { institution: "University of Technology Lae", level: "bachelor", qualification: "Bachelor of Engineering (Electrical)", fieldOfStudy: "Electrical Engineering", startDate: "2004-02-01", endDate: "2008-11-30" },
      { institution: "Engineers PNG", level: "professional", qualification: "Registered Engineer", fieldOfStudy: "Electrical Engineering", startDate: "2011-01-01", endDate: "2011-06-30" },
    ],
    experience: [
      { employer: "PNG Power Ltd", jobTitle: "Electrical Engineer", responsibilities: "Maintained HV/LV distribution infrastructure, led capital projects for grid extension.", startDate: "2009-01-15", endDate: "2014-05-31", reasonForLeaving: "Opportunity in standards body" },
      { employer: "NISIT", jobTitle: "Standards Technical Officer", responsibilities: "Developed PNG National Standards for electrical appliances, conducted market surveillance.", startDate: "2014-07-01", endDate: null, current: true, keyAchievements: "Published 8 PNG National Standards aligned to IEC standards within 3 years." },
    ],
    skills: [
      { skill: "ISO/IEC Standards Development", skillType: "technical" },
      { skill: "Electrical Engineering", skillType: "technical" },
      { skill: "Market Surveillance", skillType: "technical" },
      { skill: "Technical Writing", skillType: "soft" },
      { skill: "Stakeholder Engagement", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Milne Bay" },
  },
  {
    name: "Rose Kekeya Tago",
    otherNames: "Rosie",
    email: "rose.tago@gmail.com",
    phone: "70678901",
    alternativePhone: "7563006",
    gender: "female",
    dateOfBirth: "1993-12-30",
    nationality: "Papua New Guinean",
    nationalId: "PNG-93-123001",
    maritalStatus: "single",
    physicalAddress: "Tokarara Drive, Section 77",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-East",
    postalAddress: "PO Box 1630, Tokarara",
    education: [
      { institution: "Divine Word University", level: "bachelor", qualification: "Bachelor of Science (Nursing)", fieldOfStudy: "Nursing", startDate: "2012-02-01", endDate: "2015-11-30" },
      { institution: "PNG School of Medicine and Health Sciences", level: "postgraduate", qualification: "Postgraduate Diploma in Public Health", fieldOfStudy: "Public Health", startDate: "2017-02-01", endDate: "2018-11-30" },
    ],
    experience: [
      { employer: "Port Moresby General Hospital", jobTitle: "Registered Nurse", responsibilities: "Provided clinical care across medical and surgical wards, supervised student nurses.", startDate: "2016-01-04", endDate: "2020-06-30", reasonForLeaving: "Transitioned to public health policy" },
      { employer: "National Department of Health", jobTitle: "Public Health Officer", responsibilities: "Coordinated health promotion campaigns, compiled provincial disease surveillance reports.", startDate: "2020-08-03", endDate: null, current: true },
    ],
    skills: [
      { skill: "Public Health Policy", skillType: "technical" },
      { skill: "Data Analysis", skillType: "technical" },
      { skill: "Community Engagement", skillType: "soft" },
      { skill: "Report Writing", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "native" },
      { language: "Kuanua", proficiency: "conversational" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Tolai" },
  },
  {
    name: "Michael Gari Supa",
    otherNames: "Gari",
    email: "m.gari.supa@gmail.com",
    phone: "70789012",
    alternativePhone: "7570007",
    gender: "male",
    dateOfBirth: "1987-04-14",
    nationality: "Papua New Guinean",
    nationalId: "PNG-87-041401",
    maritalStatus: "married",
    physicalAddress: "Section 2 Lot 6, Gordons",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-West",
    postalAddress: "PO Box 3210, Gordons",
    education: [
      { institution: "University of Technology Lae", level: "bachelor", qualification: "Bachelor of Business Management", fieldOfStudy: "Operations Management", startDate: "2006-02-01", endDate: "2009-11-30" },
      { institution: "PNGIPA", level: "postgraduate", qualification: "Graduate Diploma in Public Sector Management", fieldOfStudy: "Public Administration", startDate: "2014-01-01", endDate: "2014-11-30" },
    ],
    experience: [
      { employer: "Steamships Trading Company", jobTitle: "Operations Coordinator", responsibilities: "Supervised warehouse operations, managed fleet of 15 vehicles, coordinated logistics across NCD.", startDate: "2010-03-01", endDate: "2015-07-31", reasonForLeaving: "Transition to public sector" },
      { employer: "Department of Works", jobTitle: "Operations Manager", responsibilities: "Managed facilities and fleet across 3 regional offices, developed WHS compliance frameworks.", startDate: "2015-09-01", endDate: null, current: true, keyAchievements: "Reduced fleet operating costs by 25% through route optimisation." },
    ],
    skills: [
      { skill: "Operations Management", skillType: "technical" },
      { skill: "Fleet Management", skillType: "technical" },
      { skill: "Budget Management", skillType: "technical" },
      { skill: "Leadership", skillType: "soft" },
      { skill: "Problem Solving", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Chimbu" },
  },
  {
    name: "Anna Meke Tolo",
    otherNames: "Annie",
    email: "anna.tolo@outlook.com",
    phone: "70890123",
    alternativePhone: "7580008",
    gender: "female",
    dateOfBirth: "1994-08-08",
    nationality: "Papua New Guinean",
    nationalId: "PNG-94-080801",
    maritalStatus: "single",
    physicalAddress: "Lot 5, Section 44, Hohola",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-West",
    postalAddress: "PO Box 5544, Hohola",
    education: [
      { institution: "University of Papua New Guinea", level: "bachelor", qualification: "Bachelor of Laws (LLB)", fieldOfStudy: "Law", startDate: "2012-02-01", endDate: "2016-11-30" },
      { institution: "Papua New Guinea Law Society", level: "professional", qualification: "Certificate of Legal Practice", fieldOfStudy: "Law", startDate: "2017-01-01", endDate: "2017-06-30" },
    ],
    experience: [
      { employer: "Allens (PNG Office)", jobTitle: "Associate Solicitor", responsibilities: "Advised on commercial contracts, employment law matters, and regulatory compliance.", startDate: "2017-07-01", endDate: "2020-06-30", reasonForLeaving: "Sought in-house legal role" },
      { employer: "Motor Vehicles Insurance Ltd", jobTitle: "Legal Officer", responsibilities: "Managed claims litigation, drafted commercial agreements, provided legal advisory services.", startDate: "2020-08-01", endDate: null, current: true },
    ],
    skills: [
      { skill: "Contract Law", skillType: "technical" },
      { skill: "Employment Law", skillType: "technical" },
      { skill: "Legal Drafting", skillType: "technical" },
      { skill: "Negotiation", skillType: "soft" },
      { skill: "Attention to Detail", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "conversational" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Melpa" },
  },
  {
    name: "Thomas Buna Laive",
    otherNames: "Buna",
    email: "thomas.buna@gmail.com",
    phone: "70901234",
    alternativePhone: "7600011",
    gender: "male",
    dateOfBirth: "1991-01-25",
    nationality: "Papua New Guinean",
    nationalId: "PNG-91-012501",
    maritalStatus: "married",
    physicalAddress: "Section 3, Lot 9, Konedobu",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby South",
    postalAddress: "PO Box 111, Konedobu",
    education: [
      { institution: "University of Technology Lae", level: "bachelor", qualification: "Bachelor of Applied Physics", fieldOfStudy: "Physics / Metrology", startDate: "2010-02-01", endDate: "2013-11-30" },
      { institution: "BIPM Training", level: "certificate", qualification: "Legal Metrology Training Certificate", fieldOfStudy: "Metrology", startDate: "2015-05-01", endDate: "2015-05-31" },
    ],
    experience: [
      { employer: "NISIT", jobTitle: "Metrologist Trainee", responsibilities: "Assisted in verification of trade measuring instruments, maintained calibration records.", startDate: "2014-02-03", endDate: "2016-12-31", reasonForLeaving: "Promotion" },
      { employer: "NISIT", jobTitle: "Metrologist", responsibilities: "Conducted legal metrology verification campaigns across NCD, WHP, and Southern Highlands.", startDate: "2017-01-01", endDate: null, current: true, keyAchievements: "Completed 1,200+ instrument verifications annually, pioneering regional outreach programme." },
    ],
    skills: [
      { skill: "Legal Metrology & Verification", skillType: "technical" },
      { skill: "Calibration Equipment Operation", skillType: "technical" },
      { skill: "ISO/IEC 17025", skillType: "technical" },
      { skill: "Report Writing", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
      { language: "Huli", proficiency: "conversational" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Huli" },
  },
  {
    name: "Cecilia Ware Pari",
    otherNames: "Ceci",
    email: "ceci.pari@gmail.com",
    phone: "71012345",
    alternativePhone: "7601010",
    gender: "female",
    dateOfBirth: "1989-06-11",
    nationality: "Papua New Guinean",
    nationalId: "PNG-89-061101",
    maritalStatus: "divorced",
    physicalAddress: "Section 99, Lot 2, Gerehu Stage 6",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-West",
    postalAddress: "PO Box 9902, Gerehu",
    education: [
      { institution: "Pacific Adventist University", level: "bachelor", qualification: "Bachelor of Business Administration (Finance)", fieldOfStudy: "Finance", startDate: "2008-02-01", endDate: "2011-11-30" },
    ],
    experience: [
      { employer: "PwC PNG", jobTitle: "Audit Assistant", responsibilities: "Assisted on public sector audit engagements, prepared working papers and confirmed balances.", startDate: "2012-02-01", endDate: "2014-12-31", reasonForLeaving: "Better opportunity" },
      { employer: "Department of Finance", jobTitle: "Finance Officer", responsibilities: "Managed accounts payable processing, reconciled ledger accounts, prepared quarterly MYOB reports.", startDate: "2015-02-01", endDate: "2018-08-31", reasonForLeaving: "Maternity leave then career pivot" },
      { employer: "National Procurement Commission", jobTitle: "Procurement Analyst", responsibilities: "Evaluated tender submissions, maintained the procurement register, advised departments on compliance.", startDate: "2019-03-01", endDate: null, current: true },
    ],
    skills: [
      { skill: "Procurement Analysis", skillType: "technical" },
      { skill: "Tender Evaluation", skillType: "technical" },
      { skill: "Financial Accounting", skillType: "technical" },
      { skill: "Attention to Detail", skillType: "soft" },
      { skill: "Integrity", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "native" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Sepik" },
  },
  {
    name: "Benjamin Ova Kanau",
    otherNames: "Ben",
    email: "ben.kanau@gmail.com",
    phone: "71123456",
    alternativePhone: "7610012",
    gender: "male",
    dateOfBirth: "1996-02-14",
    nationality: "Papua New Guinean",
    nationalId: "PNG-96-021401",
    maritalStatus: "single",
    physicalAddress: "Student Dorm, Divine Word University",
    city: "Madang",
    province: "Madang Province",
    district: "Madang",
    postalAddress: "PO Box 500, Madang",
    education: [
      { institution: "Divine Word University", level: "bachelor", qualification: "Bachelor of Science (Industrial Technology)", fieldOfStudy: "Industrial Technology", startDate: "2015-02-01", endDate: "2019-11-30" },
    ],
    experience: [
      { employer: "Ramu Agri-Industries Ltd", jobTitle: "Industrial Trainee", responsibilities: "Participated in production line quality checks, assisted maintenance team with equipment calibration.", startDate: "2020-01-06", endDate: "2021-12-31", reasonForLeaving: "End of contract" },
      { employer: "PNG Forest Authority", jobTitle: "Industrial Development Officer (Trainee)", responsibilities: "Supported SME advisory visits, compiled feasibility assessment reports for agroforestry SMEs.", startDate: "2022-03-01", endDate: null, current: true },
    ],
    skills: [
      { skill: "Industrial Quality Control", skillType: "technical" },
      { skill: "Feasibility Analysis", skillType: "technical" },
      { skill: "Microsoft Office", skillType: "technical" },
      { skill: "Teamwork", skillType: "soft" },
      { skill: "Initiative", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
      { language: "Austronesian (Madang)", proficiency: "native" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Madang" },
  },
  {
    name: "Grace Sihu Ova",
    otherNames: "Gracie",
    email: "grace.sihu@gmail.com",
    phone: "71234567",
    alternativePhone: "7621212",
    gender: "female",
    dateOfBirth: "1997-10-05",
    nationality: "Papua New Guinean",
    nationalId: "PNG-97-100501",
    maritalStatus: "single",
    physicalAddress: "Waigani Drive, Section 15 Lot 7",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-West",
    postalAddress: "PO Box 1507, Waigani",
    education: [
      { institution: "University of Papua New Guinea", level: "bachelor", qualification: "Bachelor of Arts (Library & Information Science)", fieldOfStudy: "Information Science", startDate: "2016-02-01", endDate: "2020-11-30" },
    ],
    experience: [
      { employer: "PNG National Library Service", jobTitle: "Records Officer", responsibilities: "Managed the central registry, maintained filing classification system, digitised archival documents.", startDate: "2021-02-01", endDate: null, current: true, keyAchievements: "Digitised over 5,000 archival records within 18 months." },
    ],
    skills: [
      { skill: "Records Management", skillType: "technical" },
      { skill: "EDMS (SharePoint)", skillType: "technical" },
      { skill: "Digitisation", skillType: "technical" },
      { skill: "Organisation", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Bougainvillean" },
  },
  {
    name: "Philip Sere Kave",
    otherNames: "Phil",
    email: "philip.kave@outlook.com",
    phone: "71345678",
    alternativePhone: "7631313",
    gender: "male",
    dateOfBirth: "1983-03-28",
    nationality: "Papua New Guinean",
    nationalId: "PNG-83-032801",
    maritalStatus: "married",
    physicalAddress: "Section 10, Lot 12, Korobosea",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby South",
    postalAddress: "PO Box 8812, Korobosea",
    education: [
      { institution: "University of Technology Lae", level: "bachelor", qualification: "Bachelor of Engineering (Civil)", fieldOfStudy: "Civil Engineering", startDate: "2002-02-01", endDate: "2006-11-30" },
      { institution: "PNGIPA", level: "postgraduate", qualification: "Master of Business Administration", fieldOfStudy: "Business Administration", startDate: "2016-02-01", endDate: "2018-11-30" },
    ],
    experience: [
      { employer: "Curtain Brothers PNG", jobTitle: "Site Engineer", responsibilities: "Supervised construction sites, coordinated subcontractors, prepared progress reports for clients.", startDate: "2007-01-08", endDate: "2012-04-30", reasonForLeaving: "Management opportunity" },
      { employer: "Department of Works and Implementation", jobTitle: "Project Manager", responsibilities: "Managed a portfolio of national infrastructure projects totalling K250m, liaised with World Bank.", startDate: "2012-06-01", endDate: "2020-12-31", reasonForLeaving: "Government restructure" },
      { employer: "PNG Sustainable Development Program", jobTitle: "Operations Manager", responsibilities: "Led operations across 4 provincial offices, managed budgets, fleet, and community programs.", startDate: "2021-02-01", endDate: null, current: true },
    ],
    skills: [
      { skill: "Project Management (PMP)", skillType: "technical" },
      { skill: "Civil Engineering", skillType: "technical" },
      { skill: "Budget Management", skillType: "technical" },
      { skill: "Leadership", skillType: "soft" },
      { skill: "Stakeholder Engagement", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
      { language: "Kewa", proficiency: "native" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Enga" },
  },
  {
    name: "Naomi Tari Boko",
    otherNames: "Nao",
    email: "naomi.boko@gmail.com",
    phone: "71456789",
    alternativePhone: "7641414",
    gender: "female",
    dateOfBirth: "1990-07-01",
    nationality: "Papua New Guinean",
    nationalId: "PNG-90-070101",
    maritalStatus: "married",
    physicalAddress: "Section 45, Lot 8, 8-Mile",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-East",
    postalAddress: "PO Box 4508, Hohola",
    education: [
      { institution: "Divine Word University", level: "bachelor", qualification: "Bachelor of Science (Computer Science)", fieldOfStudy: "Computer Science", startDate: "2009-02-01", endDate: "2012-11-30" },
      { institution: "CISCO Networking Academy", level: "certificate", qualification: "CCNA Certification", fieldOfStudy: "Networking", startDate: "2014-01-01", endDate: "2014-04-30" },
    ],
    experience: [
      { employer: "Telikom PNG", jobTitle: "Network Technician", responsibilities: "Maintained LAN/WAN infrastructure, troubleshot network faults for enterprise clients.", startDate: "2013-03-01", endDate: "2017-09-30", reasonForLeaving: "Sought broader IT infrastructure role" },
      { employer: "PNG Government Computing Centre (PICT)", jobTitle: "Network Engineer", responsibilities: "Administered GovNet infrastructure, managed Active Directory, implemented network security controls.", startDate: "2017-11-01", endDate: null, current: true, keyAchievements: "Deployed SD-WAN across 8 government agency sites reducing connectivity costs by 35%." },
    ],
    skills: [
      { skill: "Cisco Networking (CCNA)", skillType: "technical" },
      { skill: "Network Security", skillType: "technical" },
      { skill: "Windows Server / Active Directory", skillType: "technical" },
      { skill: "Problem Solving", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "native" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "female", ethnicity: "Simbu" },
  },
  {
    name: "Samuel Kunu Masi",
    otherNames: null,
    email: "sam.kunu.masi@gmail.com",
    phone: "71567890",
    alternativePhone: "7651515",
    gender: "male",
    dateOfBirth: "1986-11-17",
    nationality: "Papua New Guinean",
    nationalId: "PNG-86-111701",
    maritalStatus: "married",
    physicalAddress: "Section 7, Lot 1, Erima",
    city: "Port Moresby",
    province: "National Capital District",
    district: "Moresby North-East",
    postalAddress: "PO Box 7001, Erima",
    education: [
      { institution: "University of Papua New Guinea", level: "bachelor", qualification: "Bachelor of Education (Secondary)", fieldOfStudy: "Education / HRM", startDate: "2005-02-01", endDate: "2009-11-30" },
      { institution: "Charles Darwin University (PNG Partner)", level: "postgraduate", qualification: "Graduate Certificate in HR Management", fieldOfStudy: "Human Resource Management", startDate: "2013-01-01", endDate: "2013-12-31" },
    ],
    experience: [
      { employer: "Bomana Secondary School", jobTitle: "Teacher (Secondary)", responsibilities: "Taught Business Studies and Economics, served as Year 12 coordinator.", startDate: "2010-01-18", endDate: "2013-12-31", reasonForLeaving: "Career change to HRM" },
      { employer: "PNG LNG Project (ExxonMobil)", jobTitle: "Training Coordinator", responsibilities: "Coordinated national content training programs for 1,200+ Papua New Guinean employees.", startDate: "2014-02-01", endDate: "2019-08-31", reasonForLeaving: "Project wind-down" },
      { employer: "NISIT", jobTitle: "Learning & Development Coordinator", responsibilities: "Managed annual training needs analysis, coordinated external L&D vendors, delivered e-learning programs.", startDate: "2019-10-01", endDate: null, current: true, keyAchievements: "Implemented an LMS platform reaching 300 staff, increasing training completion rates by 50%." },
    ],
    skills: [
      { skill: "Training Needs Analysis", skillType: "technical" },
      { skill: "LMS Administration", skillType: "technical" },
      { skill: "Curriculum Design", skillType: "technical" },
      { skill: "Facilitation", skillType: "soft" },
      { skill: "Communication", skillType: "soft" },
    ],
    languages: [
      { language: "English", proficiency: "fluent" },
      { language: "Tok Pisin", proficiency: "fluent" },
    ],
    diversity: { disabilityStatus: "none", genderIdentity: "male", ethnicity: "Chimbu" },
  },
];

// ─── Screening Questions ──────────────────────────────────────────────────────

// These will be attached to the first 4 open jobs we find
const SCREENING_QUESTIONS_BY_SLOT = [
  // Slot 0 — HR Officer job
  [
    { question: "Do you hold a valid PNG driver's licence?", questionType: "yes_no", options: null, required: true, displayOrder: 0 },
    { question: "How many years of recruitment experience do you have in the PNG public sector?", questionType: "multiple_choice", options: ["Less than 1 year", "1–3 years", "3–5 years", "More than 5 years"], required: true, displayOrder: 1 },
    { question: "Briefly describe your approach to ensuring merit-based, EEO-compliant recruitment.", questionType: "short_answer", options: null, required: true, displayOrder: 2 },
  ],
  // Slot 1 — Finance job
  [
    { question: "Are you a current member of CPA PNG or equivalent professional accounting body?", questionType: "yes_no", options: null, required: true, displayOrder: 0 },
    { question: "Which government financial management system have you used?", questionType: "multiple_choice", options: ["FinPlus", "TechOne", "MYOB Government", "Other", "None"], required: true, displayOrder: 1 },
    { question: "Describe a time when you identified a significant financial risk and the steps you took to mitigate it.", questionType: "short_answer", options: null, required: false, displayOrder: 2 },
  ],
  // Slot 2 — IT/Software job
  [
    { question: "Do you have experience with TypeScript and/or Node.js?", questionType: "yes_no", options: null, required: true, displayOrder: 0 },
    { question: "Which cloud platform(s) have you worked with?", questionType: "multiple_choice", options: ["AWS", "Google Cloud", "Microsoft Azure", "None"], required: false, displayOrder: 1 },
    { question: "Describe the most complex system integration you have designed or implemented.", questionType: "short_answer", options: null, required: true, displayOrder: 2 },
  ],
  // Slot 3 — Standards job
  [
    { question: "Have you participated in ISO or IEC technical committee activities?", questionType: "yes_no", options: null, required: true, displayOrder: 0 },
    { question: "What is your highest relevant engineering or science qualification?", questionType: "multiple_choice", options: ["Certificate/Diploma", "Bachelor's degree", "Postgraduate diploma", "Master's degree or above"], required: true, displayOrder: 1 },
    { question: "Describe your experience developing or reviewing national or international technical standards.", questionType: "short_answer", options: null, required: false, displayOrder: 2 },
  ],
];

// ─── Application Status Progression ──────────────────────────────────────────

type StatusTrail = { status: string; daysBack: number; note?: string }[];

const TRAILS: StatusTrail[] = [
  // Trail A: still at applied
  [{ status: "applied", daysBack: 45 }],
  // Trail B: shortlisted
  [
    { status: "applied", daysBack: 55 },
    { status: "shortlisted", daysBack: 45, note: "Strong profile, selected for panel interview." },
  ],
  // Trail C: interview scheduled
  [
    { status: "applied", daysBack: 60 },
    { status: "shortlisted", daysBack: 50 },
    { status: "interview_scheduled", daysBack: 42, note: "Panel interview scheduled for week 6." },
  ],
  // Trail D: interview completed
  [
    { status: "applied", daysBack: 70 },
    { status: "shortlisted", daysBack: 60 },
    { status: "interview_scheduled", daysBack: 52 },
    { status: "interview_completed", daysBack: 45, note: "Interview panel score: 78/100." },
  ],
  // Trail E: offered
  [
    { status: "applied", daysBack: 85 },
    { status: "shortlisted", daysBack: 75 },
    { status: "interview_scheduled", daysBack: 66 },
    { status: "interview_completed", daysBack: 60, note: "Highest-scoring candidate." },
    { status: "offered", daysBack: 50, note: "Formal offer letter issued on this date." },
  ],
  // Trail F: rejected
  [
    { status: "applied", daysBack: 80 },
    { status: "shortlisted", daysBack: 70 },
    { status: "interview_scheduled", daysBack: 62 },
    { status: "interview_completed", daysBack: 55 },
    { status: "rejected", daysBack: 48, note: "Unsuccessful — offer made to alternate candidate." },
  ],
];

// 21 trail indices: ~1/3 applied, ~1/3 interview stage, ~1/3 offered/rejected
const TRAIL_ASSIGNMENTS = [0,0,0,0,0,0,0, 1,1, 2,2, 3,3,3, 4,4,4,4, 5,5,5];

// ─── Employees & Contracts ────────────────────────────────────────────────────

const EMPLOYEES_DEF = [
  { name: "Margaret Mala Tolo", email: "m.tolo@nisit.gov.pg", phone: "70001100", posTitle: "HR Officer", dept: "Human Resources", startDate: "2018-04-01", contractType: "permanent" as const },
  { name: "Francis Kopa Ere", email: "f.ere@nisit.gov.pg", phone: "70001200", posTitle: "Senior Finance Analyst", dept: "Finance", startDate: "2017-08-14", contractType: "permanent" as const },
  { name: "Veronica Sopa Lau", email: "v.lau@nisit.gov.pg", phone: "70001300", posTitle: "Software Developer", dept: "Information Technology", startDate: "2020-01-13", contractType: "fixed_term" as const, endDate: "2025-01-12" },
  { name: "Kevin Noru Bani", email: "k.bani@nisit.gov.pg", phone: "70001400", posTitle: "Operations Manager", dept: "Operations", startDate: "2019-06-01", contractType: "permanent" as const },
  { name: "Agnes Ule Vagi", email: "a.vagi@nisit.gov.pg", phone: "70001500", posTitle: "Standards Technical Officer", dept: "Standards and Metrology", startDate: "2021-03-01", contractType: "fixed_term" as const, endDate: "2024-02-28" },
  { name: "Rex Siru Opa", email: "r.opa@nisit.gov.pg", phone: "70001600", posTitle: "Metrologist", dept: "Standards and Metrology", startDate: "2016-11-07", contractType: "permanent" as const },
  { name: "Helen Kalo Tipa", email: "h.tipa@nisit.gov.pg", phone: "70001700", posTitle: "Procurement Officer", dept: "Finance", startDate: "2022-02-14", contractType: "fixed_term" as const, endDate: "2025-02-13" },
  { name: "Joseph Nako Guna", email: "j.guna@nisit.gov.pg", phone: "70001800", posTitle: "Network Engineer", dept: "Information Technology", startDate: "2020-09-01", contractType: "permanent" as const },
  { name: "Dorothy Kona Sio", email: "d.sio@nisit.gov.pg", phone: "70001900", posTitle: "Industrial Development Officer", dept: "Industrial Development", startDate: "2023-01-09", contractType: "fixed_term" as const, endDate: "2026-01-08" },
  { name: "Albert Manu Loka", email: "a.loka@nisit.gov.pg", phone: "70002000", posTitle: "ICT Support Officer", dept: "Information Technology", startDate: "2019-05-13", contractType: "permanent" as const },
];

// ─── Main Seed Function ───────────────────────────────────────────────────────

export async function seedCompleteData(): Promise<void> {
  // Gate: only seed into an empty environment (candidates table must be empty).
  // This prevents seeding over existing production or test data.
  const [{ totalCandidates }] = await db
    .select({ totalCandidates: countFn() })
    .from(candidatesTable);
  if (Number(totalCandidates) > 0) {
    logger.info(
      { totalCandidates: Number(totalCandidates) },
      "seedCompleteData: candidates table already has data, skipping complete seed"
    );
    return;
  }

  // Look up agency
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.name, NISIT_AGENCY_NAME));
  if (!agency) {
    logger.warn("seedCompleteData: NISIT agency not found, skipping complete data seed");
    return;
  }

  // Load departments
  const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.agencyId, agency.id));
  const deptMap: Record<string, number> = {};
  for (const d of depts) deptMap[d.name] = d.id;

  logger.info("seedCompleteData: starting…");

  // ── Step 1: Positions (per-table guard) ──────────────────────────────────
  const deptIds = Object.values(deptMap);
  const [posCountRow] = await db.select({ c: countFn() }).from(positionsTable).where(inArray(positionsTable.departmentId, deptIds));
  const positionsAlreadySeeded = Number(posCountRow?.c ?? 0) >= POSITION_DEFS.length;

  const posIdMap: Record<string, number> = {};
  if (positionsAlreadySeeded) {
    // Reload existing positions into the map
    const existingPos = await db.select().from(positionsTable).where(inArray(positionsTable.departmentId, deptIds));
    for (const p of existingPos) posIdMap[p.title] = p.id;
    logger.info("seedCompleteData: positions already seeded, skipping");
  } else {
    for (const pd of POSITION_DEFS) {
      const deptId = deptMap[pd.dept];
      if (!deptId) continue;
      const [pos] = await db
        .insert(positionsTable)
        .values({ title: pd.title, departmentId: deptId, filledCount: pd.filled, totalCount: pd.total })
        .returning();
      posIdMap[pd.title] = pos.id;
    }
    logger.info({ count: Object.keys(posIdMap).length }, "seedCompleteData: positions inserted");
  }

  // ── Step 2: Candidates ────────────────────────────────────────────────────
  const candidateIds: number[] = [];
  for (const c of CANDIDATES) {
    const [cand] = await db
      .insert(candidatesTable)
      .values({
        name: c.name,
        otherNames: c.otherNames,
        email: c.email,
        phone: c.phone,
        alternativePhone: c.alternativePhone,
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        nationality: c.nationality,
        nationalId: c.nationalId,
        maritalStatus: c.maritalStatus,
        physicalAddress: c.physicalAddress,
        city: c.city,
        province: c.province,
        district: c.district,
        postalAddress: c.postalAddress,
        cvUrl: "https://storage.nisit.gov.pg/cv-placeholder.pdf",
      })
      .returning();

    candidateIds.push(cand.id);

    // Education
    for (const edu of c.education) {
      await db.insert(candidateEducationTable).values({ candidateId: cand.id, ...edu });
    }
    // Experience
    for (const exp of c.experience) {
      await db.insert(candidateExperienceTable).values({ candidateId: cand.id, ...exp });
    }
    // Skills
    for (const sk of c.skills) {
      await db.insert(candidateSkillsTable).values({ candidateId: cand.id, ...sk });
    }
    // Languages
    for (const lang of c.languages) {
      await db.insert(candidateLanguagesTable).values({ candidateId: cand.id, ...lang });
    }
    // Diversity
    if (c.diversity) {
      await db.insert(candidateDiversityTable).values({ candidateId: cand.id, ...c.diversity });
    }
  }
  logger.info({ count: candidateIds.length }, "seedCompleteData: candidates inserted");

  // ── Step 3: Find open jobs — only open jobs for the NISIT agency ─────────
  const openJobs = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.agencyId, agency.id), eq(jobsTable.status, "open")));

  if (openJobs.length === 0) {
    logger.warn("seedCompleteData: no open jobs found for NISIT agency — skipping screening question and application seeding");
    // Step 4/5 skipped; continue to employees below
  } else {
  if (openJobs.length < 4) {
    logger.warn("seedCompleteData: fewer than 4 open jobs found — screening questions will be partial");
  }

  // ── Step 4: Screening Questions ───────────────────────────────────────────
  const screenedJobIds: number[] = [];
  for (let slot = 0; slot < Math.min(SCREENING_QUESTIONS_BY_SLOT.length, openJobs.length); slot++) {
    const job = openJobs[slot];
    for (const sq of SCREENING_QUESTIONS_BY_SLOT[slot]) {
      await db.insert(jobScreeningQuestionsTable).values({
        jobId: job.id,
        question: sq.question,
        questionType: sq.questionType,
        options: sq.options,
        required: sq.required,
        displayOrder: sq.displayOrder,
      });
    }
    screenedJobIds.push(job.id);
  }
  logger.info({ count: screenedJobIds.length }, "seedCompleteData: screening questions seeded for jobs");

  // Load screening questions for later answer seeding
  const sqRows = screenedJobIds.length > 0
    ? await db.select().from(jobScreeningQuestionsTable).where(inArray(jobScreeningQuestionsTable.jobId, screenedJobIds))
    : [];
  const sqByJob: Record<number, typeof sqRows> = {};
  for (const sq of sqRows) {
    if (!sqByJob[sq.jobId]) sqByJob[sq.jobId] = [];
    sqByJob[sq.jobId].push(sq);
  }

  // ── Step 5: Applications ─────────────────────────────────────────────────
  // Distribute 21 applications across the first 6 open jobs, cycling candidates
  const targetJobs = openJobs.slice(0, Math.min(6, openJobs.length));
  const appJobCycle = targetJobs.map(j => j.id);
  const applicationIds: number[] = [];

  const COVER_LETTERS = [
    "I am writing to apply for this position at PNG NISIT. With my extensive experience in the public sector and strong track record of delivering results, I am confident I can make a meaningful contribution to NISIT's strategic objectives. I am passionate about PNG's development and committed to excellence in government service.",
    "Please accept my application for the above position. Throughout my career I have demonstrated the ability to work collaboratively across organisational boundaries, manage competing priorities, and deliver high-quality outcomes. I believe my qualifications and experience are an excellent match for the requirements of this role.",
    "I am excited to apply for this opportunity at NISIT. My background in the Papua New Guinea public sector has given me a solid understanding of government processes, compliance requirements, and the importance of merit-based service delivery. I am eager to bring my skills to this role.",
    "Having reviewed the selection criteria carefully, I am confident that my professional experience and qualifications align strongly with the requirements for this position. I have a deep commitment to public service and to the continuing development of Papua New Guinea's institutional capacity.",
    "I am keen to join the NISIT team and contribute to its important mandate in standards, metrology, and industrial development. My experience working across multiple PNG government agencies has given me the resilience, adaptability, and technical knowledge needed to excel in this challenging and rewarding role.",
  ];

  const PERSONAL_STATEMENTS = [
    "Throughout my career I have been guided by a commitment to excellence, integrity, and continuous improvement. I thrive in dynamic environments where I can apply analytical rigour to complex problems and deliver measurable outcomes for the organisation and the people it serves.",
    "I am a results-driven professional with a proven record of delivering in the Papua New Guinea public sector. I believe in transparent governance, merit-based decision-making, and collaborative leadership that empowers teams to achieve their full potential.",
    "My passion for PNG's development underpins everything I do professionally. I have consistently sought opportunities to build my capacity, contribute to institutional strengthening, and mentor emerging talent in my field.",
    "I am a dedicated public servant who takes pride in delivering quality work within tight deadlines. My ability to build strong relationships with stakeholders at all levels has been key to my success in previous roles.",
    "Innovation and adaptability are at the core of my professional approach. I embrace change as an opportunity, and I am skilled at translating strategic priorities into practical, achievable action plans.",
  ];

  for (let i = 0; i < 21; i++) {
    const jobId = appJobCycle[i % appJobCycle.length];
    const candidateId = candidateIds[i % candidateIds.length];
    const trail = TRAILS[TRAIL_ASSIGNMENTS[i]];
    const lastStatus = trail[trail.length - 1].status;
    const clIdx = i % COVER_LETTERS.length;
    const psIdx = i % PERSONAL_STATEMENTS.length;

    const [app] = await db
      .insert(applicationsTable)
      .values({
        jobId,
        candidateId,
        status: lastStatus,
        coverLetter: COVER_LETTERS[clIdx],
        personalStatement: PERSONAL_STATEMENTS[psIdx],
        preferredLocation: ["Port Moresby", "Lae", "Any Location"][i % 3],
        availability: ["Immediately", "2 weeks", "1 month", "3 months"][i % 4],
        relocate: i % 3 !== 2,
        workType: ["full_time", "full_time", "part_time", "contract"][i % 4],
        expectedSalary: ["K45,000–K55,000 per annum", "K60,000–K75,000 per annum", "K80,000–K95,000 per annum", "K35,000–K45,000 per annum"][i % 4],
        currentSalary: ["K38,000 per annum", "K52,000 per annum", "K70,000 per annum", "K28,000 per annum"][i % 4],
        noticePeriod: ["2 weeks", "1 month", "3 months"][i % 3],
        technicalSkills: CANDIDATES[i % CANDIDATES.length].skills.filter(s => s.skillType === "technical").map(s => s.skill),
        softSkills: CANDIDATES[i % CANDIDATES.length].skills.filter(s => s.skillType === "soft").map(s => s.skill),
        computerLiteracy: ["Advanced", "Intermediate", "Advanced", "Intermediate"][i % 4],
        certificationsLicenses: i % 3 === 0 ? "Valid PNG Driver's Licence; First Aid Certificate" : i % 3 === 1 ? "CCNA Certification; ISO 9001 Lead Auditor" : null,
        declarationAgreed: true,
        backgroundCheckConsent: true,
        conflictOfInterest: true,
        criminalRecord: true,
        dataPrivacyConsent: true,
        score: trail.length >= 4 ? String(60 + (i % 4) * 8) : null,
      })
      .returning();

    applicationIds.push(app.id);

    // Status history trail
    let prevStatus: string | null = null;
    for (const step of trail) {
      await db.insert(applicationStatusHistoryTable).values({
        applicationId: app.id,
        fromStatus: prevStatus,
        status: step.status,
        changedAt: daysAgo(step.daysBack),
        note: step.note ?? null,
      });
      prevStatus = step.status;
    }

    // Referees (2 per application)
    const REFEREE_SETS = [
      [
        { name: "Dr John Kila", relationship: "Former Supervisor", organisation: "Department of Finance PNG", email: "j.kila@finance.gov.pg", phone: "70110011" },
        { name: "Ms Alicia Tare", relationship: "Professional Reference", organisation: "CPA PNG", email: "a.tare@cpapng.com.pg", phone: "70220022" },
      ],
      [
        { name: "Mr Peter Gavu", relationship: "Direct Manager", organisation: "BSP Financial Group", email: "p.gavu@bsp.com.pg", phone: "70330033" },
        { name: "Prof Ruth Kami", relationship: "Academic Referee", organisation: "University of Papua New Guinea", email: "r.kami@upng.ac.pg", phone: "70440044" },
      ],
      [
        { name: "Ms Hilda Nare", relationship: "Senior Colleague", organisation: "National Procurement Commission", email: "h.nare@npc.gov.pg", phone: "70550055" },
        { name: "Mr George Mola", relationship: "Former Director", organisation: "Department of Works", email: "g.mola@works.gov.pg", phone: "70660066" },
      ],
    ];

    const refSet = REFEREE_SETS[i % REFEREE_SETS.length];
    for (const ref of refSet) {
      await db.insert(candidateRefereesTable).values({ applicationId: app.id, ...ref });
    }

    // CV document placeholder
    await db.insert(applicationDocumentsTable).values({
      applicationId: app.id,
      documentType: "cv",
      url: "https://storage.nisit.gov.pg/cv-placeholder.pdf",
      fileName: `cv_${CANDIDATES[i % CANDIDATES.length].name.split(" ").join("_").toLowerCase()}.pdf`,
    });

    // Screening answers (if this job has screening questions)
    const qs = sqByJob[jobId];
    if (qs && qs.length > 0) {
      const SAMPLE_ANSWERS_BY_TYPE: Record<string, string[]> = {
        yes_no: ["Yes", "No", "Yes"],
        multiple_choice: ["1–3 years", "FinPlus", "AWS", "Bachelor's degree"],
        short_answer: [
          "My approach involves structured competency-based screening aligned to the job's selection criteria, ensuring each shortlisted candidate is evaluated on merit against documented evidence.",
          "I identified a K2.3m budget variance during quarterly review, escalated immediately to the Director Finance, and implemented corrective journal entries restoring compliance within 48 hours.",
          "I designed a microservices integration linking PNGIPA payroll data to departmental HR systems, using REST APIs with OAuth2 authentication and comprehensive error logging.",
          "I led the PNG team's participation in IEC TC 64 (Electrical installations), reviewing draft standards and submitting two formal comments that were incorporated into the final IEC 60364 revision.",
        ],
      };
      for (let qi = 0; qi < qs.length; qi++) {
        const q = qs[qi];
        const answers = SAMPLE_ANSWERS_BY_TYPE[q.questionType] ?? ["N/A"];
        await db.insert(applicationScreeningAnswersTable).values({
          applicationId: app.id,
          questionId: q.id,
          answer: answers[qi % answers.length],
        });
      }
    }
  }

  logger.info({ count: applicationIds.length }, "seedCompleteData: applications inserted");
  } // end else (openJobs.length > 0)

  // ── Step 6: Employees & Contracts (per-table guard) ───────────────────────
  const [empCountRow] = await db.select({ c: countFn() }).from(employeesTable).where(eq(employeesTable.agencyId, agency.id));
  const employeesAlreadySeeded = Number(empCountRow?.c ?? 0) >= EMPLOYEES_DEF.length;

  if (employeesAlreadySeeded) {
    logger.info("seedCompleteData: employees already seeded, skipping");
  } else {
  for (const ed of EMPLOYEES_DEF) {
    const deptId = deptMap[ed.dept];
    const posId = posIdMap[ed.posTitle];

    const [emp] = await db
      .insert(employeesTable)
      .values({
        name: ed.name,
        email: ed.email,
        phone: ed.phone,
        positionId: posId ?? null,
        departmentId: deptId ?? null,
        agencyId: agency.id,
        startDate: ed.startDate,
        status: "active",
      })
      .returning();

    const contractStart = ed.startDate;
    const contractEnd = ed.contractType === "fixed_term" && "endDate" in ed ? ed.endDate : null;

    await db.insert(contractsTable).values({
      employeeId: emp.id,
      startDate: contractStart,
      endDate: contractEnd ?? null,
      type: ed.contractType,
      status: "active",
      documentUrl: "https://storage.nisit.gov.pg/contract-placeholder.pdf",
    });
  }
  logger.info({ count: EMPLOYEES_DEF.length }, "seedCompleteData: employees and contracts inserted");
  } // end else (employees not already seeded)

  logger.info("seedCompleteData: complete data seed finished successfully");
}
