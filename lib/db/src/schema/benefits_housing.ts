import { pgTable, serial, integer, text, timestamp, date, boolean, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const benefitsTable = pgTable("benefits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // health_insurance, superannuation, housing_allowance, transport_allowance, life_insurance
  description: text("description"),
  provider: text("provider"), // Nasfund, Capital Insurance, Pacific MMI, NISIT Internal
  defaultCoverage: text("default_coverage"),
  taxable: boolean("taxable").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const benefitEnrollmentsTable = pgTable("benefit_enrollments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  benefitId: integer("benefit_id").references(() => benefitsTable.id).notNull(),
  status: text("status").notNull().default("active"), // active, pending, terminated
  coverageDetails: text("coverage_details"),
  beneficiaryName: text("beneficiary_name"),
  beneficiaryRelationship: text("beneficiary_relationship"),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  employeeContribution: numeric("employee_contribution", { precision: 10, scale: 2 }).default("0"),
  employerContribution: numeric("employer_contribution", { precision: 10, scale: 2 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const housingSchemesTable = pgTable("housing_schemes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  schemeType: text("scheme_type").notNull().default("institutional_rental"), // institutional_rental, home_ownership_advance, rental_subsidy
  eligibilityCriteria: text("eligibility_criteria").notNull(),
  maxMonthlyAllowance: numeric("max_monthly_allowance", { precision: 10, scale: 2 }),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const housingApplicationsTable = pgTable("housing_applications", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  schemeId: integer("scheme_id").references(() => housingSchemesTable.id).notNull(),
  propertyAddress: text("property_address").notNull(),
  landlordName: text("landlord_name"),
  monthlyRentRequested: numeric("monthly_rent_requested", { precision: 10, scale: 2 }).notNull(),
  leasePeriodMonths: integer("lease_period_months").default(12),
  status: text("status").notNull().default("submitted"), // submitted, under_hr_review, under_board_review, approved, rejected
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id),
  reviewComments: text("review_comments"),
  approvedAmount: numeric("approved_amount", { precision: 10, scale: 2 }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
