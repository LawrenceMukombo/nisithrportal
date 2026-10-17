/**
 * PNG NISIT Enterprise Payroll Engine
 * 
 * Statutory Remuneration Rules:
 * - PNG Internal Revenue Commission (IRC) Salary & Wages Tax (SWT) progressive brackets
 * - Superannuation Act (PNG):
 *     * Mandatory Employee Contribution: 6.0% (Nasfund / Nambawan Super)
 *     * Mandatory Employer Contribution: 8.4%
 * - Standard Fortnightly Pay Cycle (26 Pay Fortnights per annum, 80 regular hours / 10 working days)
 * - Public Service General Orders (Overtime: 1.5x normal excess, 2.0x Sundays/Public Holidays)
 */

export interface TaxCalculationResult {
  annualEquivalentGross: number;
  annualTax: number;
  fortnightlyTax: number;
  effectiveTaxRate: number;
  marginalBracket: string;
}

export interface PayrollCalculationInput {
  annualBaseSalary: number;
  fortnightlyBaseSalary?: number;
  regularHoursWorked?: number; // default 80
  overtimeHours15?: number; // 1.5x multiplier
  overtimeHours20?: number; // 2.0x multiplier
  housingAllowance?: number;
  housingAllowanceType?: "fixed" | "percentage";
  housingAllowanceRate?: number;
  utilityAllowance?: number;
  utilityAllowanceType?: "fixed" | "percentage";
  utilityAllowanceRate?: number;
  transportAllowance?: number;
  transportAllowanceType?: "fixed" | "percentage";
  transportAllowanceRate?: number;
  representationAllowance?: number;
  representationAllowanceType?: "fixed" | "percentage";
  representationAllowanceRate?: number;
  otherAllowances?: number;
  otherAllowancesType?: "fixed" | "percentage";
  otherAllowancesRate?: number;
  adHocAllowances?: number;
  adHocDeductions?: number;
  unionDues?: number;
  insuranceDeduction?: number;
  superannuationType?: "percentage" | "fixed";
  superannuationFixedAmount?: number;
  voluntarySuperRate?: number; // e.g. 2.0 for 2%
  unpaidLeaveDays?: number; // default 0
}

export interface PayrollCalculationResult {
  baseSalary: number;
  hourlyRate: number;
  regularHoursWorked: number;
  overtimeHours15: number;
  overtimeHours20: number;
  overtimePay: number;
  allowancesBreakdown: {
    housing: number;
    utility: number;
    transport: number;
    representation: number;
    other: number;
    adHoc: number;
  };
  totalAllowances: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  grossPay: number;
  taxableIncome: number;
  ircTax: number;
  superannuationEmployee: number; // 6% + voluntary OR fixed amount
  superannuationEmployer: number; // 8.4%
  deductionsBreakdown: {
    ircTax: number;
    superEmployee: number;
    unionDues: number;
    insurance: number;
    unpaidLeave: number;
    adHoc: number;
  };
  totalDeductions: number;
  netPay: number;
  taxDetails: TaxCalculationResult;
}

/**
 * Calculates PNG Internal Revenue Commission (IRC) Salary & Wages Tax (SWT)
 * Annualized bracket structure:
 *  0 – 20,000 PGK: 0%
 *  20,001 – 33,000 PGK: 22%
 *  33,001 – 70,000 PGK: 30%
 *  70,001 – 250,000 PGK: 35%
 *  Above 250,000 PGK: 40%
 */
export function calculatePSTRate(annualTaxable: number): TaxCalculationResult {
  const taxable = Math.max(0, annualTaxable);
  let tax = 0;
  let marginalBracket = "0% (Tax-Free Threshold)";

  if (taxable <= 20000) {
    tax = 0;
    marginalBracket = "0% (Tax-Free)";
  } else if (taxable <= 33000) {
    tax = (taxable - 20000) * 0.22;
    marginalBracket = "22% Bracket";
  } else if (taxable <= 70000) {
    tax = (13000 * 0.22) + ((taxable - 33000) * 0.30);
    marginalBracket = "30% Bracket";
  } else if (taxable <= 250000) {
    tax = (13000 * 0.22) + (37000 * 0.30) + ((taxable - 70000) * 0.35);
    marginalBracket = "35% Bracket";
  } else {
    tax = (13000 * 0.22) + (37000 * 0.30) + (180000 * 0.35) + ((taxable - 250000) * 0.40);
    marginalBracket = "40% Top Statutory Bracket";
  }

  const fortnightlyTax = Math.round((tax / 26) * 100) / 100;
  const effectiveTaxRate = taxable > 0 ? Math.round((tax / taxable) * 10000) / 100 : 0;

  return {
    annualEquivalentGross: taxable,
    annualTax: Math.round(tax * 100) / 100,
    fortnightlyTax,
    effectiveTaxRate,
    marginalBracket,
  };
}

/**
 * Executes full statutory computation for an employee's pay fortnight
 */
export function calculateEmployeePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const annualBaseSalary = input.annualBaseSalary || 45000;
  const fortnightlyBaseSalary = input.fortnightlyBaseSalary || Math.round((annualBaseSalary / 26) * 100) / 100;
  const hourlyRate = Math.round((fortnightlyBaseSalary / 80) * 100) / 100;

  const regularHoursWorked = input.regularHoursWorked ?? 80;
  const overtimeHours15 = input.overtimeHours15 ?? 0;
  const overtimeHours20 = input.overtimeHours20 ?? 0;

  const overtimePay15 = Math.round((overtimeHours15 * hourlyRate * 1.5) * 100) / 100;
  const overtimePay20 = Math.round((overtimeHours20 * hourlyRate * 2.0) * 100) / 100;
  const totalOvertimePay = overtimePay15 + overtimePay20;

  // Unpaid leave deduction (standard 10 working days per fortnight)
  const unpaidLeaveDays = input.unpaidLeaveDays ?? 0;
  const dailyRate = Math.round((fortnightlyBaseSalary / 10) * 100) / 100;
  const unpaidLeaveDeduction = Math.round((unpaidLeaveDays * dailyRate) * 100) / 100;

  // Helper to resolve an allowance: either fixed PGK amount or percentage of fortnightly base salary
  const resolveAllowance = (
    type?: "fixed" | "percentage",
    fixedAmount?: number,
    rate?: number
  ): number => {
    if (type === "percentage") {
      const pct = Number(rate) || 0;
      return Math.round((fortnightlyBaseSalary * (pct / 100)) * 100) / 100;
    }
    return Math.max(0, Number(fixedAmount) || 0);
  };

  // Allowances (resolved based on type: 'percentage' or 'fixed')
  const housing = resolveAllowance(input.housingAllowanceType, input.housingAllowance, input.housingAllowanceRate);
  const utility = resolveAllowance(input.utilityAllowanceType, input.utilityAllowance, input.utilityAllowanceRate);
  const transport = resolveAllowance(input.transportAllowanceType, input.transportAllowance, input.transportAllowanceRate);
  const representation = resolveAllowance(input.representationAllowanceType, input.representationAllowance, input.representationAllowanceRate);
  const other = resolveAllowance(input.otherAllowancesType, input.otherAllowances, input.otherAllowancesRate);
  const adHocAllowances = Number(input.adHocAllowances) || 0;

  const totalAllowances = Math.round((housing + utility + transport + representation + other + adHocAllowances) * 100) / 100;

  // Gross Pay
  const grossPay = Math.round((fortnightlyBaseSalary + totalOvertimePay + totalAllowances) * 100) / 100;

  // Taxable Income (in PNG public service, standard cash allowances are taxable, minus approved exemptions)
  const taxableIncome = Math.max(0, Math.round((grossPay - unpaidLeaveDeduction) * 100) / 100);

  // Annualized tax calculation
  const annualizedTaxable = taxableIncome * 26;
  const taxDetails = calculatePSTRate(annualizedTaxable);
  const ircTax = taxDetails.fortnightlyTax;

  // Superannuation (based on employee configuration)
  let superannuationEmployee = 0;
  if (input.superannuationType === "fixed" && (Number(input.superannuationFixedAmount) || 0) > 0) {
    superannuationEmployee = Math.round(Number(input.superannuationFixedAmount) * 100) / 100;
  } else {
    // Statutory Percentage: Mandatory Employee 6.0% + voluntary additional rate
    const voluntaryRate = Number(input.voluntarySuperRate) || 0;
    const totalEmployeeSuperRate = 0.06 + (voluntaryRate / 100);
    superannuationEmployee = Math.round((fortnightlyBaseSalary * totalEmployeeSuperRate) * 100) / 100;
  }

  // Mandatory Employer: 8.4% of base salary
  const superannuationEmployer = Math.round((fortnightlyBaseSalary * 0.084) * 100) / 100;

  // Deductions
  const unionDues = input.unionDues ?? 0;
  const insurance = input.insuranceDeduction ?? 0;
  const adHocDeductions = input.adHocDeductions ?? 0;

  const totalDeductions = Math.round((ircTax + superannuationEmployee + unionDues + insurance + unpaidLeaveDeduction + adHocDeductions) * 100) / 100;
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

  return {
    baseSalary: fortnightlyBaseSalary,
    hourlyRate,
    regularHoursWorked,
    overtimeHours15,
    overtimeHours20,
    overtimePay: totalOvertimePay,
    allowancesBreakdown: {
      housing,
      utility,
      transport,
      representation,
      other,
      adHoc: adHocAllowances,
    },
    totalAllowances,
    unpaidLeaveDays,
    unpaidLeaveDeduction,
    grossPay,
    taxableIncome,
    ircTax,
    superannuationEmployee,
    superannuationEmployer,
    deductionsBreakdown: {
      ircTax,
      superEmployee: superannuationEmployee,
      unionDues,
      insurance,
      unpaidLeave: unpaidLeaveDeduction,
      adHoc: adHocDeductions,
    },
    totalDeductions,
    netPay,
    taxDetails,
  };
}

/**
 * Generates official Australian/PNG Banking Direct Credit (ABA) batch file format
 * Supported by Bank South Pacific (BSP), Kina Bank, Westpac PNG, ANZ PNG.
 */
export function generateBankingABAText(params: {
  periodCode: string;
  payDate: string;
  items: Array<{
    bankName: string;
    bankAccountNumber: string;
    employeeName: string;
    netPay: number;
    payslipNumber: string;
  }>;
}): string {
  const dateFormatted = params.payDate.replace(/-/g, "").slice(2); // YYMMDD
  const totalNet = params.items.reduce((acc, it) => acc + it.netPay, 0);
  const totalCents = Math.round(totalNet * 100);
  const recordCount = params.items.length;

  let lines: string[] = [];

  // Record Type 0: Descriptive Header Record
  // 01-01: '0'
  // 02-18: blanks
  // 19-20: reel sequence number '01'
  // 21-23: name of user's financial institution 'BSP'
  // 24-30: blanks
  // 31-56: user preferred specification name 'PNG NISIT PAYROLL'
  // 57-62: user identification number '102938'
  // 63-74: description of entries 'PAYROLL SALARY'
  // 75-80: date to be processed (YYMMDD)
  // 81-120: blanks
  lines.push(`0                 01BSP       PNG NISIT PAYROLL         102938PAYROLL SALARY${dateFormatted}                                        `);

  // Record Type 1: Detail Records
  params.items.forEach((item) => {
    const cleanAccount = (item.bankAccountNumber || "1000000000").replace(/[^0-9]/g, "").padEnd(9, "0").slice(0, 9);
    const bsb = "088-301"; // Standard BSP POM Commercial Branch Code
    const indicator = " ";
    const transactionCode = "53"; // Standard payroll credit
    const amountStr = String(Math.round(item.netPay * 100)).padStart(10, "0");
    const title = item.employeeName.toUpperCase().padEnd(32, " ").slice(0, 32);
    const lodgementRef = item.payslipNumber.padEnd(18, " ").slice(0, 18);
    const traceBsb = "088-301";
    const traceAccount = "100293847".padEnd(9, "0");
    const remitter = "PNG NISIT SALARY".padEnd(16, " ");

    lines.push(`1${bsb}${cleanAccount}${indicator}${transactionCode}${amountStr}${title}${lodgementRef}${traceBsb}${traceAccount}${remitter}00000000`);
  });

  // Record Type 7: File Total Record
  // 01-01: '7'
  // 02-08: '999-999'
  // 09-20: blanks
  // 21-30: Net Total Amount in cents
  // 31-40: Gross Credit Total Amount in cents
  // 41-50: Gross Debit Total Amount (0)
  // 51-74: blanks
  // 75-80: Total count of records type 1
  // 81-120: blanks
  const amountTotalStr = String(totalCents).padStart(10, "0");
  const countStr = String(recordCount).padStart(6, "0");
  lines.push(`7999-999            ${amountTotalStr}${amountTotalStr}0000000000                        ${countStr}                                        `);

  return lines.join("\r\n");
}

/**
 * Papua New Guinea National Public Service & Statutory Authorities
 * Standard Salary Grade Structure (Grades 10 through 20)
 * Directly ties Public Service Grades to Annual Base Salary, Fortnightly Base, Hourly Rates,
 * Salary Step Ranges, and Standard Statutory Allowances.
 */
export interface PayGradeScale {
  grade: string;
  level: number;
  title: string;
  annualBaseSalary: number;
  fortnightlyBase: number;
  hourlyRate: number;
  minSalary: number;
  maxSalary: number;
  defaultHousing: number;
  defaultUtility: number;
  defaultTransport: number;
  defaultRepresentation: number;
}

export const PNG_PAY_GRADE_SCALES: Record<string, PayGradeScale> = {
  "Grade 10": {
    grade: "Grade 10",
    level: 10,
    title: "Junior Technical / Administrative Officer",
    annualBaseSalary: 42000,
    fortnightlyBase: 1615.38,
    hourlyRate: 20.19,
    minSalary: 38000,
    maxSalary: 46000,
    defaultHousing: 350,
    defaultUtility: 100,
    defaultTransport: 120,
    defaultRepresentation: 0,
  },
  "Grade 11": {
    grade: "Grade 11",
    level: 11,
    title: "Technical Officer / Standards Analyst",
    annualBaseSalary: 48000,
    fortnightlyBase: 1846.15,
    hourlyRate: 23.08,
    minSalary: 44000,
    maxSalary: 52000,
    defaultHousing: 350,
    defaultUtility: 120,
    defaultTransport: 150,
    defaultRepresentation: 0,
  },
  "Grade 12": {
    grade: "Grade 12",
    level: 12,
    title: "Senior Inspector / Standards Officer",
    annualBaseSalary: 54000,
    fortnightlyBase: 2076.92,
    hourlyRate: 25.96,
    minSalary: 50000,
    maxSalary: 58000,
    defaultHousing: 400,
    defaultUtility: 120,
    defaultTransport: 150,
    defaultRepresentation: 0,
  },
  "Grade 13": {
    grade: "Grade 13",
    level: 13,
    title: "Senior Technical Officer / Metrologist",
    annualBaseSalary: 60000,
    fortnightlyBase: 2307.69,
    hourlyRate: 28.85,
    minSalary: 56000,
    maxSalary: 64000,
    defaultHousing: 450,
    defaultUtility: 140,
    defaultTransport: 180,
    defaultRepresentation: 0,
  },
  "Grade 14": {
    grade: "Grade 14",
    level: 14,
    title: "Standards Lead / Principal Officer",
    annualBaseSalary: 68000,
    fortnightlyBase: 2615.38,
    hourlyRate: 32.69,
    minSalary: 63000,
    maxSalary: 73000,
    defaultHousing: 500,
    defaultUtility: 150,
    defaultTransport: 200,
    defaultRepresentation: 0,
  },
  "Grade 15": {
    grade: "Grade 15",
    level: 15,
    title: "Chief Technical Specialist / QA Lead",
    annualBaseSalary: 76000,
    fortnightlyBase: 2923.08,
    hourlyRate: 36.54,
    minSalary: 70000,
    maxSalary: 82000,
    defaultHousing: 550,
    defaultUtility: 160,
    defaultTransport: 220,
    defaultRepresentation: 0,
  },
  "Grade 16": {
    grade: "Grade 16",
    level: 16,
    title: "Division Manager / Assistant Director",
    annualBaseSalary: 85000,
    fortnightlyBase: 3269.23,
    hourlyRate: 40.87,
    minSalary: 78000,
    maxSalary: 92000,
    defaultHousing: 600,
    defaultUtility: 180,
    defaultTransport: 250,
    defaultRepresentation: 0,
  },
  "Grade 17": {
    grade: "Grade 17",
    level: 17,
    title: "Deputy Director / Senior Manager",
    annualBaseSalary: 98000,
    fortnightlyBase: 3769.23,
    hourlyRate: 47.12,
    minSalary: 90000,
    maxSalary: 105000,
    defaultHousing: 700,
    defaultUtility: 200,
    defaultTransport: 280,
    defaultRepresentation: 200,
  },
  "Grade 18": {
    grade: "Grade 18",
    level: 18,
    title: "Director / Executive General Manager",
    annualBaseSalary: 110000,
    fortnightlyBase: 4230.77,
    hourlyRate: 52.88,
    minSalary: 102000,
    maxSalary: 120000,
    defaultHousing: 750,
    defaultUtility: 200,
    defaultTransport: 300,
    defaultRepresentation: 400,
  },
  "Grade 19": {
    grade: "Grade 19",
    level: 19,
    title: "Deputy Managing Director / Registrar",
    annualBaseSalary: 125000,
    fortnightlyBase: 4807.69,
    hourlyRate: 60.10,
    minSalary: 115000,
    maxSalary: 138000,
    defaultHousing: 850,
    defaultUtility: 250,
    defaultTransport: 350,
    defaultRepresentation: 500,
  },
  "Grade 20": {
    grade: "Grade 20",
    level: 20,
    title: "Managing Director / Director General",
    annualBaseSalary: 145000,
    fortnightlyBase: 5576.92,
    hourlyRate: 69.71,
    minSalary: 130000,
    maxSalary: 160000,
    defaultHousing: 1000,
    defaultUtility: 300,
    defaultTransport: 400,
    defaultRepresentation: 600,
  },
};

export function getPayGradeScale(grade?: string | null): PayGradeScale {
  if (!grade) return PNG_PAY_GRADE_SCALES["Grade 10"];
  const cleanGrade = grade.trim();
  if (PNG_PAY_GRADE_SCALES[cleanGrade]) {
    return PNG_PAY_GRADE_SCALES[cleanGrade];
  }
  const numMatch = cleanGrade.match(/\d+/);
  if (numMatch) {
    const key = `Grade ${numMatch[0]}`;
    if (PNG_PAY_GRADE_SCALES[key]) return PNG_PAY_GRADE_SCALES[key];
  }
  if (cleanGrade.toLowerCase().includes("director") || cleanGrade.toLowerCase().includes("executive")) {
    return PNG_PAY_GRADE_SCALES["Grade 18"];
  }
  if (cleanGrade.toLowerCase().includes("manager")) {
    return PNG_PAY_GRADE_SCALES["Grade 16"];
  }
  if (cleanGrade.toLowerCase().includes("senior") || cleanGrade.toLowerCase().includes("lead")) {
    return PNG_PAY_GRADE_SCALES["Grade 14"];
  }
  return PNG_PAY_GRADE_SCALES["Grade 10"];
}

