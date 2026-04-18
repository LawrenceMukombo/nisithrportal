import { useState, useEffect, useCallback, useRef } from "react";
import { DRAFT_KEY_PREFIX, DRAFT_KEY } from "@/lib/draftKeys";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getToken, decodeToken } from "@/lib/api-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, Send, Save, Plus, Trash2, Upload,
  User, Phone, MapPin, BookOpen, Briefcase, Wrench, FileText, HelpCircle, Users, CheckSquare, Heart,
  Loader2, Check, Sparkles, X
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScreeningQuestion = {
  id: number;
  question: string;
  questionType: string;
  options?: string[] | null;
  required: boolean;
  isMandatoryFilter?: boolean | null;
  autoReject?: boolean | null;
  autoRejectValue?: string | null;
};

type EducationEntry = {
  institution: string;
  level: string;
  qualification: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  current: boolean;
  certifications: string;
};

type ExperienceEntry = {
  employer: string;
  jobTitle: string;
  employmentType: string;
  responsibilities: string;
  startDate: string;
  endDate: string;
  current: boolean;
  reasonForLeaving: string;
  keyAchievements: string;
};

type LanguageEntry = { language: string; proficiency: string };
type RefereeEntry = { name: string; relationship: string; organisation: string; email: string; phone: string };
type DocumentEntry = { documentType: string; url: string; fileName: string };
type ScreeningAnswerEntry = { questionId: number; answer: string };

// ─── Wizard schema ────────────────────────────────────────────────────────────

const wizardSchema = z.object({
  // Step 1 - Personal Info
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  otherNames: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  maritalStatus: z.string().optional(),
  // Step 2 - Contact
  candidateEmail: z.string().email("Valid email required"),
  candidatePhone: z.string().optional(),
  alternativePhone: z.string().optional(),
  physicalAddress: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  postalAddress: z.string().optional(),
  // Step 3 - Position & Availability
  preferredLocation: z.string().optional(),
  availability: z.string().optional(),
  relocate: z.boolean().optional(),
  workType: z.string().optional(),
  // Step 4 - Education & Experience
  education: z.array(z.object({
    institution: z.string().min(1, "Institution required"),
    level: z.string().optional().default(""),
    qualification: z.string().optional().default(""),
    fieldOfStudy: z.string().optional().default(""),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    current: z.boolean().optional().default(false),
    certifications: z.string().optional().default(""),
  })).default([]),
  experience: z.array(z.object({
    employer: z.string().min(1, "Employer required"),
    jobTitle: z.string().optional().default(""),
    employmentType: z.string().optional().default(""),
    responsibilities: z.string().optional().default(""),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    current: z.boolean().optional().default(false),
    reasonForLeaving: z.string().optional().default(""),
    keyAchievements: z.string().optional().default(""),
  })).default([]),
  // Step 5 - Skills & Cover Letter
  technicalSkillsRaw: z.string().optional(),
  softSkillsRaw: z.string().optional(),
  languages: z.array(z.object({
    language: z.string().min(1, "Language required"),
    proficiency: z.string().optional().default(""),
  })).default([]),
  computerLiteracy: z.string().optional(),
  certificationsLicenses: z.string().optional(),
  personalStatement: z.string().optional(),
  coverLetter: z.string().optional(),
  // Step 3 - Position info
  vacancyRefNumber: z.string().optional(),
  // Step 6 - Documents (uploaded; urls filled after upload)
  cvUrl: z.string().optional(),
  documents: z.array(z.object({
    documentType: z.string(),
    url: z.string(),
    fileName: z.string(),
  })).default([]),
  // Step 7 - Screening answers
  screeningAnswers: z.array(z.object({
    questionId: z.number(),
    answer: z.string(),
  })).default([]),
  // Step 8 - References & Declarations
  referees: z.array(z.object({
    name: z.string().min(1, "Referee name required"),
    relationship: z.string().optional().default(""),
    organisation: z.string().optional().default(""),
    email: z.string().optional().default(""),
    phone: z.string().optional().default(""),
  })).default([]),
  expectedSalary: z.string().optional(),
  currentSalary: z.string().optional(),
  noticePeriod: z.string().optional(),
  declarationAgreed: z.boolean().refine(v => v === true, { message: "You must agree to the declaration" }),
  backgroundCheckConsent: z.boolean().refine(v => v === true, { message: "Background check consent required" }),
  conflictOfInterest: z.boolean().refine(v => v === true, { message: "You must declare no conflict of interest" }),
  criminalRecord: z.boolean().refine(v => v === true, { message: "You must declare no relevant criminal record" }),
  dataPrivacyConsent: z.boolean().refine(v => v === true, { message: "Data privacy consent required" }),
  // Optional D&I step
  diOptIn: z.boolean().optional(),
  disabilityStatus: z.string().optional(),
  genderIdentity: z.string().optional(),
  ethnicity: z.string().optional(),
});

type WizardValues = z.infer<typeof wizardSchema>;

// ─── Step Definitions ─────────────────────────────────────────────────────────

type StepDef = {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  fields: (keyof WizardValues)[];
};

const STEPS: StepDef[] = [
  { id: "personal", label: "Personal Information", shortLabel: "Personal", icon: User, fields: ["firstName", "lastName", "otherNames", "gender", "dateOfBirth", "nationality", "nationalId", "maritalStatus"] },
  { id: "contact", label: "Contact Details", shortLabel: "Contact", icon: Phone, fields: ["candidateEmail", "candidatePhone", "alternativePhone", "physicalAddress", "city", "province", "district", "postalAddress"] },
  { id: "position", label: "Position & Availability", shortLabel: "Availability", icon: MapPin, fields: ["preferredLocation", "availability", "relocate", "workType"] },
  { id: "education", label: "Education & Experience", shortLabel: "Education", icon: BookOpen, fields: ["education", "experience"] },
  { id: "skills", label: "Skills & Cover Letter", shortLabel: "Skills", icon: Wrench, fields: ["technicalSkillsRaw", "softSkillsRaw", "languages", "computerLiteracy", "certificationsLicenses", "personalStatement", "coverLetter"] },
  { id: "documents", label: "Document Uploads", shortLabel: "Documents", icon: FileText, fields: ["cvUrl", "documents"] },
  { id: "screening", label: "Screening Questions", shortLabel: "Screening", icon: HelpCircle, fields: ["screeningAnswers"] },
  { id: "declarations", label: "References & Declarations", shortLabel: "Declarations", icon: CheckSquare, fields: ["referees", "expectedSalary", "currentSalary", "noticePeriod", "declarationAgreed", "backgroundCheckConsent", "conflictOfInterest", "criminalRecord", "dataPrivacyConsent"] },
  { id: "diversity", label: "Diversity & Inclusion (Optional)", shortLabel: "D&I", icon: Heart, fields: ["diOptIn", "disabilityStatus", "genderIdentity", "ethnicity"] },
];

// ─── Helper: Upload a file ─────────────────────────────────────────────────────

async function uploadFile(file: File, jobId: number): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("jobId", String(jobId));
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Upload failed");
  }
  const { url } = await res.json() as { url: string };
  return url;
}

// ─── Step Components ──────────────────────────────────────────────────────────

function Step1Personal({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="firstName" render={({ field }) => (
          <FormItem>
            <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
            <FormControl><Input placeholder="Given name" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="lastName" render={({ field }) => (
          <FormItem>
            <FormLabel>Last Name / Surname <span className="text-red-500">*</span></FormLabel>
            <FormControl><Input placeholder="Family name" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="otherNames" render={({ field }) => (
        <FormItem>
          <FormLabel>Other Names</FormLabel>
          <FormControl><Input placeholder="Middle name or other names" {...field} /></FormControl>
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="gender" render={({ field }) => (
          <FormItem>
            <FormLabel>Gender</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
          <FormItem>
            <FormLabel>Date of Birth</FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="nationality" render={({ field }) => (
          <FormItem>
            <FormLabel>Nationality</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="Papua New Guinean">Papua New Guinean</SelectItem>
                <SelectItem value="Australian">Australian</SelectItem>
                <SelectItem value="New Zealander">New Zealander</SelectItem>
                <SelectItem value="Fijian">Fijian</SelectItem>
                <SelectItem value="Solomon Islander">Solomon Islander</SelectItem>
                <SelectItem value="Vanuatuan">Vanuatuan</SelectItem>
                <SelectItem value="Filipino">Filipino</SelectItem>
                <SelectItem value="Chinese">Chinese</SelectItem>
                <SelectItem value="Indian">Indian</SelectItem>
                <SelectItem value="British">British</SelectItem>
                <SelectItem value="American">American</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="nationalId" render={({ field }) => (
          <FormItem>
            <FormLabel>National ID / Passport No.</FormLabel>
            <FormControl><Input placeholder="ID number" {...field} /></FormControl>
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="maritalStatus" render={({ field }) => (
        <FormItem>
          <FormLabel>Marital Status</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married">Married</SelectItem>
              <SelectItem value="divorced">Divorced</SelectItem>
              <SelectItem value="widowed">Widowed</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
    </div>
  );
}

function Step2Contact({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="candidateEmail" render={({ field }) => (
          <FormItem>
            <FormLabel>Email Address <span className="text-red-500">*</span></FormLabel>
            <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="candidatePhone" render={({ field }) => (
          <FormItem>
            <FormLabel>Primary Phone</FormLabel>
            <FormControl><Input placeholder="+675 ..." {...field} /></FormControl>
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="alternativePhone" render={({ field }) => (
        <FormItem>
          <FormLabel>Alternative Phone</FormLabel>
          <FormControl><Input placeholder="+675 ..." {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name="physicalAddress" render={({ field }) => (
        <FormItem>
          <FormLabel>Physical / Street Address</FormLabel>
          <FormControl><Input placeholder="Street address" {...field} /></FormControl>
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="city" render={({ field }) => (
          <FormItem>
            <FormLabel>City / Town</FormLabel>
            <FormControl><Input placeholder="e.g. Port Moresby" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="province" render={({ field }) => (
          <FormItem>
            <FormLabel>Province</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger></FormControl>
              <SelectContent>
                {["NCD (Port Moresby)","Central","Gulf","Western","Oro (Northern)","Milne Bay","Morobe","Madang","Eastern Highlands","Western Highlands","Jiwaka","Chimbu (Simbu)","Southern Highlands","Hela","Enga","Sandaun (West Sepik)","East Sepik","Manus","New Ireland","East New Britain","West New Britain","Bougainville (AROB)"].map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="district" render={({ field }) => (
          <FormItem>
            <FormLabel>District</FormLabel>
            <FormControl><Input placeholder="District" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="postalAddress" render={({ field }) => (
          <FormItem>
            <FormLabel>Postal / PO Box Address</FormLabel>
            <FormControl><Input placeholder="PO Box ..." {...field} /></FormControl>
          </FormItem>
        )} />
      </div>
    </div>
  );
}

function Step3Position({ form, jobTitle }: { form: ReturnType<typeof useForm<WizardValues>>; jobTitle?: string }) {
  return (
    <div className="space-y-4">
      {jobTitle && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm">
          <span className="font-medium">Applying for:</span> {jobTitle}
        </div>
      )}
      <FormField control={form.control} name="vacancyRefNumber" render={({ field }) => (
        <FormItem>
          <FormLabel>Vacancy / Job Reference Number</FormLabel>
          <FormControl>
            <Input {...field} readOnly className="bg-muted/50 cursor-default select-all font-mono" />
          </FormControl>
          <p className="text-xs text-muted-foreground">Auto-filled from the job posting. Quote this number in correspondence.</p>
        </FormItem>
      )} />
      <FormField control={form.control} name="preferredLocation" render={({ field }) => (
        <FormItem>
          <FormLabel>Preferred Work Location / Province</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select preferred location" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="Any Location">Any Location / Flexible</SelectItem>
              <SelectItem value="Remote">Remote / Work from Home</SelectItem>
              <SelectItem value="NCD (Port Moresby)">NCD (Port Moresby)</SelectItem>
              <SelectItem value="Central">Central Province</SelectItem>
              <SelectItem value="Gulf">Gulf Province</SelectItem>
              <SelectItem value="Western">Western Province</SelectItem>
              <SelectItem value="Oro (Northern)">Oro (Northern Province)</SelectItem>
              <SelectItem value="Milne Bay">Milne Bay Province</SelectItem>
              <SelectItem value="Morobe">Morobe Province</SelectItem>
              <SelectItem value="Madang">Madang Province</SelectItem>
              <SelectItem value="Eastern Highlands">Eastern Highlands Province</SelectItem>
              <SelectItem value="Western Highlands">Western Highlands Province</SelectItem>
              <SelectItem value="Jiwaka">Jiwaka Province</SelectItem>
              <SelectItem value="Chimbu (Simbu)">Chimbu (Simbu) Province</SelectItem>
              <SelectItem value="Southern Highlands">Southern Highlands Province</SelectItem>
              <SelectItem value="Hela">Hela Province</SelectItem>
              <SelectItem value="Enga">Enga Province</SelectItem>
              <SelectItem value="Sandaun (West Sepik)">Sandaun (West Sepik) Province</SelectItem>
              <SelectItem value="East Sepik">East Sepik Province</SelectItem>
              <SelectItem value="Manus">Manus Province</SelectItem>
              <SelectItem value="New Ireland">New Ireland Province</SelectItem>
              <SelectItem value="East New Britain">East New Britain Province</SelectItem>
              <SelectItem value="West New Britain">West New Britain Province</SelectItem>
              <SelectItem value="Bougainville (AROB)">Bougainville (AROB)</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="availability" render={({ field }) => (
        <FormItem>
          <FormLabel>Availability to Start</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select availability" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="immediate">Immediately</SelectItem>
              <SelectItem value="2_weeks">2 Weeks</SelectItem>
              <SelectItem value="1_month">1 Month</SelectItem>
              <SelectItem value="3_months">3 Months</SelectItem>
              <SelectItem value="6_months">6 Months</SelectItem>
              <SelectItem value="on_request">Upon Request</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="workType" render={({ field }) => (
        <FormItem>
          <FormLabel>Preferred Work Type</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select work type" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      <FormField control={form.control} name="relocate" render={({ field }) => (
        <FormItem className="flex flex-row items-start gap-3 space-y-0">
          <FormControl>
            <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
          </FormControl>
          <FormLabel className="font-normal cursor-pointer">I am willing to relocate for this position</FormLabel>
        </FormItem>
      )} />
    </div>
  );
}

function Step4EducationExp({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({ control: form.control, name: "education" });
  const { fields: expFields, append: appendExp, remove: removeExp } = useFieldArray({ control: form.control, name: "experience" });

  return (
    <div className="space-y-6">
      {/* Education section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Education</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => appendEdu({ institution: "", level: "", qualification: "", fieldOfStudy: "", startDate: "", endDate: "", current: false, certifications: "" })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Education
          </Button>
        </div>
        {eduFields.length === 0 && <p className="text-xs text-muted-foreground py-2">No education entries yet. Click Add Education.</p>}
        <div className="space-y-4">
          {eduFields.map((field, i) => (
            <Card key={field.id} className="border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeEdu(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <FormField control={form.control} name={`education.${i}.institution`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="University / School name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`education.${i}.level`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="vocational">Vocational / TVET</SelectItem>
                          <SelectItem value="diploma">Diploma</SelectItem>
                          <SelectItem value="bachelor">Bachelor's</SelectItem>
                          <SelectItem value="postgraduate">Postgraduate / Masters</SelectItem>
                          <SelectItem value="phd">PhD / Doctorate</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`education.${i}.qualification`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualification / Award</FormLabel>
                      <FormControl><Input placeholder="e.g. Bachelor of Commerce" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`education.${i}.fieldOfStudy`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field of Study / Major</FormLabel>
                    <FormControl><Input placeholder="e.g. Accounting & Finance" {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`education.${i}.startDate`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`education.${i}.endDate`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl><Input type="date" {...field} disabled={form.watch(`education.${i}.current`)} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`education.${i}.current`} render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal text-sm">Currently studying here</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`education.${i}.certifications`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certifications / Awards (optional)</FormLabel>
                    <FormControl><Input placeholder="Any relevant certifications" {...field} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Work experience section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Work Experience</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => appendExp({ employer: "", jobTitle: "", employmentType: "", responsibilities: "", startDate: "", endDate: "", current: false, reasonForLeaving: "", keyAchievements: "" })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Experience
          </Button>
        </div>
        {expFields.length === 0 && <p className="text-xs text-muted-foreground py-2">No work experience entries yet. Click Add Experience.</p>}
        <div className="space-y-4">
          {expFields.map((field, i) => (
            <Card key={field.id} className="border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeExp(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`experience.${i}.employer`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employer / Organisation <span className="text-red-500">*</span></FormLabel>
                      <FormControl><Input placeholder="Company name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`experience.${i}.jobTitle`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title / Position</FormLabel>
                      <FormControl><Input placeholder="Your role" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`experience.${i}.employmentType`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="full_time">Full-time</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract / Fixed-term</SelectItem>
                        <SelectItem value="casual">Casual / Temporary</SelectItem>
                        <SelectItem value="volunteer">Volunteer</SelectItem>
                        <SelectItem value="internship">Internship / Attachment</SelectItem>
                        <SelectItem value="self_employed">Self-employed / Consultant</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`experience.${i}.responsibilities`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Responsibilities</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Describe your main duties..." {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`experience.${i}.startDate`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`experience.${i}.endDate`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl><Input type="date" {...field} disabled={form.watch(`experience.${i}.current`)} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`experience.${i}.current`} render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal text-sm">Currently working here</FormLabel>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`experience.${i}.reasonForLeaving`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Leaving</FormLabel>
                      <FormControl><Input placeholder="If applicable" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`experience.${i}.keyAchievements`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Achievements</FormLabel>
                      <FormControl><Input placeholder="Notable accomplishments" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step5Skills({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const { fields: langFields, append: appendLang, remove: removeLang } = useFieldArray({ control: form.control, name: "languages" });
  return (
    <div className="space-y-4">
      <FormField control={form.control} name="technicalSkillsRaw" render={({ field }) => (
        <FormItem>
          <FormLabel>Technical Skills</FormLabel>
          <FormControl><Input placeholder="e.g. Data Analysis, SAP, AutoCAD (comma separated)" {...field} /></FormControl>
          <p className="text-xs text-muted-foreground">Separate multiple skills with commas</p>
        </FormItem>
      )} />
      <FormField control={form.control} name="softSkillsRaw" render={({ field }) => (
        <FormItem>
          <FormLabel>Soft Skills</FormLabel>
          <FormControl><Input placeholder="e.g. Communication, Leadership, Teamwork" {...field} /></FormControl>
        </FormItem>
      )} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Languages Spoken</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => appendLang({ language: "", proficiency: "" })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Language
          </Button>
        </div>
        <div className="space-y-2">
          {langFields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2">
                <FormField control={form.control} name={`languages.${i}.language`} render={({ field }) => (
                  <FormItem>
                    {i === 0 && <FormLabel>Language</FormLabel>}
                    <FormControl><Input placeholder="English, Tok Pisin..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="col-span-2">
                <FormField control={form.control} name={`languages.${i}.proficiency`} render={({ field }) => (
                  <FormItem>
                    {i === 0 && <FormLabel>Proficiency</FormLabel>}
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="proficient">Proficient</SelectItem>
                        <SelectItem value="fluent">Fluent</SelectItem>
                        <SelectItem value="native">Native</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeLang(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {langFields.length === 0 && <p className="text-xs text-muted-foreground">Add languages you speak</p>}
        </div>
      </div>

      <FormField control={form.control} name="computerLiteracy" render={({ field }) => (
        <FormItem>
          <FormLabel>Computer Literacy</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />

      <FormField control={form.control} name="certificationsLicenses" render={({ field }) => (
        <FormItem>
          <FormLabel>Professional Certifications / Licences</FormLabel>
          <FormControl><Textarea rows={2} placeholder="List any relevant certifications or professional licences..." {...field} /></FormControl>
        </FormItem>
      )} />

      <FormField control={form.control} name="personalStatement" render={({ field }) => (
        <FormItem>
          <FormLabel>Personal Statement</FormLabel>
          <FormControl><Textarea rows={4} placeholder="A brief statement about yourself, your career goals, and what you bring to this role..." {...field} /></FormControl>
        </FormItem>
      )} />

      <FormField control={form.control} name="coverLetter" render={({ field }) => (
        <FormItem>
          <FormLabel>Cover Letter</FormLabel>
          <FormControl><Textarea rows={5} placeholder="Tell us why you're a great fit for this role..." {...field} /></FormControl>
        </FormItem>
      )} />
    </div>
  );
}

const DOC_TYPES = [
  { value: "cover_letter", label: "Cover Letter" },
  { value: "academic_cert", label: "Academic Certificate" },
  { value: "professional_cert", label: "Professional Certificate / Licence" },
  { value: "id_document", label: "ID Document (Passport / National ID)" },
  { value: "reference_letter", label: "Reference Letter" },
  { value: "other", label: "Other Supporting Document" },
];

function Step6Documents({ form, jobId, toast }: { form: ReturnType<typeof useForm<WizardValues>>; jobId: number; toast: ReturnType<typeof useToast>["toast"] }) {
  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({ control: form.control, name: "documents" });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const cvInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState("academic_cert");
  const [parsing, setParsing] = useState(false);
  const [autoFillFields, setAutoFillFields] = useState<string[]>([]);

  const handleCvUpload = async (file: File) => {
    setUploading(p => ({ ...p, cv: true }));
    try {
      if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10 MB", variant: "destructive" }); return; }
      const url = await uploadFile(file, jobId);
      form.setValue("cvUrl", url);
      toast({ title: "CV uploaded" });

      // Try to auto-fill form fields from parsed CV (public endpoint — no auth required)
      setParsing(true);
      try {
        const token = getToken();
        const parseRes = await fetch("/api/ai/cv-prefill", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
          body: JSON.stringify({ cvUrl: url }),
        });
        if (parseRes.ok) {
          const parsed = await parseRes.json() as {
            name?: string | null; email?: string | null; phone?: string | null;
            skills?: string[]; summary?: string | null;
          };
          const filled: string[] = [];
          if (parsed.name && !form.getValues("firstName")) {
            const parts = parsed.name.trim().split(/\s+/);
            if (parts.length >= 2) {
              form.setValue("firstName", parts[0]);
              form.setValue("lastName", parts.slice(1).join(" "));
              filled.push("First Name", "Last Name");
            }
          }
          if (parsed.email && !form.getValues("candidateEmail")) {
            form.setValue("candidateEmail", parsed.email);
            filled.push("Email");
          }
          if (parsed.phone && !form.getValues("candidatePhone")) {
            form.setValue("candidatePhone", parsed.phone);
            filled.push("Phone");
          }
          if (parsed.skills?.length && !form.getValues("technicalSkillsRaw")) {
            form.setValue("technicalSkillsRaw", parsed.skills.slice(0, 10).join(", "));
            filled.push("Technical Skills");
          }
          if (parsed.summary && !form.getValues("personalStatement")) {
            form.setValue("personalStatement", parsed.summary);
            filled.push("Personal Statement");
          }
          if (filled.length > 0) setAutoFillFields(filled);
        }
      } catch { /* parse errors are non-blocking */ }
      finally { setParsing(false); }
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setUploading(p => ({ ...p, cv: false })); }
  };

  const handleDocUpload = async (file: File) => {
    const key = `doc_${Date.now()}`;
    setUploading(p => ({ ...p, [key]: true }));
    try {
      if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10 MB", variant: "destructive" }); return; }
      const url = await uploadFile(file, jobId);
      appendDoc({ documentType: pendingDocType, url, fileName: file.name });
      toast({ title: "Document uploaded" });
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setUploading(p => ({ ...p, [key]: false })); }
  };

  const cvUrl = form.watch("cvUrl");
  const isAnyUploading = Object.values(uploading).some(Boolean);

  return (
    <div className="space-y-6">
      {/* CV Upload */}
      <div className="space-y-2">
        <Label className="font-semibold">CV / Résumé <span className="text-muted-foreground font-normal">(PDF, DOC, DOCX — max 10 MB)</span></Label>
        {cvUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700 flex-1 truncate">CV uploaded</span>
              {parsing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Button type="button" size="sm" variant="ghost" className="text-destructive h-7" onClick={() => { form.setValue("cvUrl", ""); setAutoFillFields([]); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {autoFillFields.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-800">AI auto-filled from your CV</p>
                  <p className="text-blue-700 text-xs mt-0.5">
                    Pre-populated: {autoFillFields.join(", ")}. Please review and edit as needed.
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600" onClick={() => setAutoFillFields([])}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => cvInputRef.current?.click()}
          >
            {uploading.cv ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading CV...
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload CV</p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX — max 10 MB</p>
              </>
            )}
          </div>
        )}
        <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCvUpload(f); e.target.value = ""; }} />
      </div>

      <Separator />

      {/* Additional Documents */}
      <div className="space-y-3">
        <Label className="font-semibold">Additional Documents</Label>
        {docFields.map((field, i) => (
          <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{DOC_TYPES.find(d => d.value === field.documentType)?.label ?? field.documentType}</p>
              <p className="text-xs text-muted-foreground truncate">{(docFields[i] as DocumentEntry).fileName}</p>
            </div>
            <Button type="button" size="sm" variant="ghost" className="text-destructive h-7" onClick={() => removeDoc(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Select value={pendingDocType} onValueChange={setPendingDocType}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" disabled={isAnyUploading} onClick={() => docInputRef.current?.click()}>
            {isAnyUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" />Upload</>}
          </Button>
        </div>
        <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function Step7Screening({ form, questions }: { form: ReturnType<typeof useForm<WizardValues>>; questions: ScreeningQuestion[] }) {
  const { fields, replace } = useFieldArray({ control: form.control, name: "screeningAnswers" });

  // Initialise answer fields when questions load
  useEffect(() => {
    if (questions.length > 0 && fields.length === 0) {
      replace(questions.map(q => ({ questionId: q.id, answer: "" })));
    }
  }, [questions, fields.length, replace]);

  if (questions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No screening questions for this position.</p>
        <p className="text-xs mt-1">Click Next to continue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {questions.map((q, i) => {
        const answerIndex = fields.findIndex((f: ScreeningAnswerEntry) => f.questionId === q.id);
        const idx = answerIndex >= 0 ? answerIndex : i;
        return (
          <FormField key={q.id} control={form.control} name={`screeningAnswers.${idx}.answer`} render={({ field }) => (
            <FormItem>
              <FormLabel>
                {i + 1}. {q.question}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </FormLabel>
              <FormControl>
                {q.questionType === "yes_no" ? (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : q.questionType === "multiple_choice" && q.options ? (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select answer" /></SelectTrigger>
                    <SelectContent>
                      {(q.options as string[]).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : q.questionType === "long_answer" ? (
                  <Textarea rows={4} placeholder="Your answer..." {...field} />
                ) : (
                  <Input placeholder="Your answer..." {...field} />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        );
      })}
    </div>
  );
}

function Step8Declarations({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({ control: form.control, name: "referees" });

  return (
    <div className="space-y-6">
      {/* Referees */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Professional Referees</h3>
          {refFields.length < 3 && (
            <Button type="button" size="sm" variant="outline" onClick={() => appendRef({ name: "", relationship: "", organisation: "", email: "", phone: "" })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Referee
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Please provide at least two professional referees who can attest to your qualifications.</p>
        {refFields.length === 0 && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">No referees added yet. Please add at least one.</p>}
        <div className="space-y-4">
          {refFields.map((field, i) => (
            <Card key={field.id} className="border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Referee {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeRef(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`referees.${i}.name`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                      <FormControl><Input placeholder="Referee's name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`referees.${i}.relationship`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Former Supervisor">Former Supervisor</SelectItem>
                          <SelectItem value="Current Supervisor">Current Supervisor</SelectItem>
                          <SelectItem value="Former Manager">Former Manager</SelectItem>
                          <SelectItem value="Current Manager">Current Manager</SelectItem>
                          <SelectItem value="Colleague / Peer">Colleague / Peer</SelectItem>
                          <SelectItem value="Academic Supervisor">Academic Supervisor</SelectItem>
                          <SelectItem value="Lecturer / Tutor">Lecturer / Tutor</SelectItem>
                          <SelectItem value="Mentor">Mentor</SelectItem>
                          <SelectItem value="Client / Stakeholder">Client / Stakeholder</SelectItem>
                          <SelectItem value="Other Professional">Other Professional</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`referees.${i}.organisation`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organisation</FormLabel>
                    <FormControl><Input placeholder="Company / Agency name" {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name={`referees.${i}.email`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="referee@example.com" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`referees.${i}.phone`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+675 ..." {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Compensation */}
      <div className="space-y-3">
        <h3 className="font-semibold">Compensation & Availability</h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="expectedSalary" render={({ field }) => (
            <FormItem>
              <FormLabel>Expected Salary (PGK / year)</FormLabel>
              <FormControl><Input placeholder="e.g. 60,000" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="currentSalary" render={({ field }) => (
            <FormItem>
              <FormLabel>Current Salary (PGK / year)</FormLabel>
              <FormControl><Input placeholder="e.g. 50,000" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="noticePeriod" render={({ field }) => (
          <FormItem>
            <FormLabel>Notice Period</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="How much notice?" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="1_week">1 Week</SelectItem>
                <SelectItem value="2_weeks">2 Weeks</SelectItem>
                <SelectItem value="1_month">1 Month</SelectItem>
                <SelectItem value="3_months">3 Months</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />
      </div>

      <Separator />

      {/* Declarations */}
      <div className="space-y-4">
        <h3 className="font-semibold">Declarations</h3>
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          All declarations below are required before submitting your application.
        </div>

        <FormField control={form.control} name="conflictOfInterest" render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3">
            <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
            <div>
              <FormLabel className="font-normal text-sm cursor-pointer">I declare that I have no conflict of interest in this application</FormLabel>
            </div>
          </FormItem>
        )} />
        <FormField control={form.control} name="criminalRecord" render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3">
            <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
            <div>
              <FormLabel className="font-normal text-sm cursor-pointer">I declare that I do not have a relevant criminal record</FormLabel>
            </div>
          </FormItem>
        )} />
        <FormField control={form.control} name="backgroundCheckConsent" render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3">
            <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
            <div>
              <FormLabel className="font-normal text-sm cursor-pointer">
                I consent to a background check being conducted as part of the recruitment process <span className="text-red-500">*</span>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )} />
        <FormField control={form.control} name="dataPrivacyConsent" render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-3">
            <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
            <div>
              <FormLabel className="font-normal text-sm cursor-pointer">
                I consent to my personal data being stored and used for recruitment purposes in accordance with the Privacy Act <span className="text-red-500">*</span>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )} />
        <FormField control={form.control} name="declarationAgreed" render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-md border-2 border-primary/30 bg-primary/5 p-3">
            <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
            <div>
              <FormLabel className="font-medium text-sm cursor-pointer">
                I declare that all information provided in this application is true and correct to the best of my knowledge. I understand that any false statement may disqualify my application or result in termination if discovered after appointment. <span className="text-red-500">*</span>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )} />
      </div>
    </div>
  );
}

function StepDiversity({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const optIn = form.watch("diOptIn");
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Voluntary Diversity & Inclusion Information</p>
        <p>This information is entirely optional and is collected solely for aggregate statistical reporting to support PNG NISIT&apos;s D&I commitments. It will not be used in evaluating your application.</p>
      </div>
      <FormField control={form.control} name="diOptIn" render={({ field }) => (
        <FormItem className="flex items-center gap-3 space-y-0">
          <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
          <FormLabel className="font-normal cursor-pointer text-sm">I would like to voluntarily provide diversity information</FormLabel>
        </FormItem>
      )} />
      {optIn && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
          <FormField control={form.control} name="disabilityStatus" render={({ field }) => (
            <FormItem>
              <FormLabel>Disability Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="none">No disability</SelectItem>
                  <SelectItem value="physical">Physical disability</SelectItem>
                  <SelectItem value="sensory">Sensory disability</SelectItem>
                  <SelectItem value="cognitive">Cognitive / learning disability</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="genderIdentity" render={({ field }) => (
            <FormItem>
              <FormLabel>Gender Identity</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="man">Man</SelectItem>
                  <SelectItem value="woman">Woman</SelectItem>
                  <SelectItem value="non_binary">Non-binary / Gender diverse</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="ethnicity" render={({ field }) => (
            <FormItem>
              <FormLabel>Cultural / Ethnic Background</FormLabel>
              <FormControl><Input placeholder="e.g. Melanesian, Polynesian, Asian..." {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

export function ApplyWizard({
  jobId,
  jobTitle,
  screeningQuestions = [],
  open,
  onOpenChange,
}: {
  jobId: number;
  jobTitle?: string;
  screeningQuestions?: ScreeningQuestion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState<{ id: number; email: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "", lastName: "", otherNames: "", gender: "", dateOfBirth: "", nationality: "",
      nationalId: "", maritalStatus: "", candidateEmail: "", candidatePhone: "", alternativePhone: "",
      physicalAddress: "", city: "", province: "", district: "", postalAddress: "",
      vacancyRefNumber: `NISIT-VAC-${jobId}`,
      preferredLocation: "", availability: "", relocate: false, workType: "",
      education: [], experience: [], technicalSkillsRaw: "", softSkillsRaw: "", languages: [],
      computerLiteracy: "", certificationsLicenses: "", personalStatement: "", coverLetter: "",
      cvUrl: "", documents: [], screeningAnswers: [], referees: [],
      expectedSalary: "", currentSalary: "", noticePeriod: "",
      declarationAgreed: false, backgroundCheckConsent: false, conflictOfInterest: false, criminalRecord: false, dataPrivacyConsent: false,
      diOptIn: false, disabilityStatus: "", genderIdentity: "", ethnicity: "",
    },
  });

  const draftEmail = form.watch("candidateEmail");

  // Load draft on open: prioritise server draft (authenticated), fall back to localStorage
  useEffect(() => {
    if (!open) return;
    const localKey = DRAFT_KEY(jobId);
    const local = localStorage.getItem(localKey);
    let localValues: Partial<WizardValues> | null = null;
    let localStep = 0;
    if (local) {
      try {
        const parsed = JSON.parse(local) as { values: Partial<WizardValues>; step: number };
        localValues = parsed.values;
        localStep = parsed.step ?? 0;
      } catch { /* ignore */ }
    }

    // If authenticated, try to load server draft using JWT email (works even without localStorage)
    const token = getToken();
    const jwtEmail = token ? decodeToken(token)?.email ?? null : null;
    const emailForServer = localValues?.candidateEmail ?? jwtEmail;
    if (token && emailForServer) {
      const loadServerDraft = async () => {
        try {
          const res = await fetch(`/api/applications/draft/${jobId}?email=${encodeURIComponent(emailForServer)}`, {
            headers: { "Authorization": `Bearer ${token}` },
          });
          if (res.ok) {
            const serverDraft = await res.json() as { draftData: Partial<WizardValues>; currentStep?: number } | null;
            if (serverDraft?.draftData) {
              // Server draft takes precedence — restore it (enables cross-device resume)
              Object.entries(serverDraft.draftData).forEach(([k, v]) => form.setValue(k as keyof WizardValues, v as never));
              setCurrentStep(serverDraft.currentStep ?? 0);
              return; // server draft loaded, skip localStorage
            }
          }
        } catch { /* fall through to localStorage */ }
        // Fall back to localStorage draft
        if (localValues) {
          Object.entries(localValues).forEach(([k, v]) => form.setValue(k as keyof WizardValues, v as never));
          setCurrentStep(localStep);
        }
      };
      void loadServerDraft();
    } else if (localValues) {
      Object.entries(localValues).forEach(([k, v]) => form.setValue(k as keyof WizardValues, v as never));
      setCurrentStep(localStep);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  // Save draft to localStorage — only when the dialog is open
  const saveDraftLocally = useCallback(() => {
    if (!open) return;
    const values = form.getValues();
    localStorage.setItem(DRAFT_KEY(jobId), JSON.stringify({ values, step: currentStep, savedAt: new Date().toISOString() }));
  }, [open, form, jobId, currentStep]);

  // Auto-save when navigating steps (only while the dialog is open)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    // Skip the save triggered purely by the dialog opening — load, don't overwrite
    if (!open) { prevOpenRef.current = false; return; }
    if (!prevOpenRef.current) { prevOpenRef.current = true; return; }
    saveDraftLocally();
  }, [open, currentStep, saveDraftLocally]);

  const handleSaveDraft = async () => {
    setSaving(true);
    saveDraftLocally();
    // Save to server only if user is authenticated (draft endpoints require auth to protect PII)
    const values = form.getValues();
    const token = getToken();
    if (values.candidateEmail && token) {
      try {
        await fetch(`/api/applications/draft/${jobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ candidateEmail: values.candidateEmail, draftData: values, currentStep }),
        });
      } catch { /* ignore server errors — localStorage draft is the primary mechanism */ }
    }
    setSaving(false);
    toast({ title: "Draft saved", description: "You can resume your application later." });
  };

  const totalSteps = STEPS.length;

  // Fields that are declaration checkboxes — validated only at final submit, not at Next
  const DECLARATION_FIELDS: (keyof WizardValues)[] = ["declarationAgreed", "backgroundCheckConsent", "dataPrivacyConsent", "conflictOfInterest", "criminalRecord"];

  const validateCurrentStep = async (): Promise<boolean> => {
    const stepDef = STEPS[currentStep];
    if (!stepDef || stepDef.fields.length === 0) return true;
    // Exclude declaration fields from step-level validation (they're enforced at Submit)
    const fieldsToValidate = stepDef.fields.filter(
      f => !DECLARATION_FIELDS.includes(f as keyof WizardValues)
    ) as Parameters<typeof form.trigger>[0];
    if (!fieldsToValidate || !(fieldsToValidate as unknown[]).length) return true;
    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const valid = await validateCurrentStep();
    if (!valid) return;
    saveDraftLocally();
    setCurrentStep(s => Math.min(s + 1, totalSteps - 1));
  };

  const handleBack = () => {
    saveDraftLocally();
    setCurrentStep(s => Math.max(s - 1, 0));
  };

  const onSubmit = async (values: WizardValues) => {
    const technicalSkills = values.technicalSkillsRaw ? values.technicalSkillsRaw.split(",").map(s => s.trim()).filter(Boolean) : undefined;
    const softSkills = values.softSkillsRaw ? values.softSkillsRaw.split(",").map(s => s.trim()).filter(Boolean) : undefined;

    const body = {
      jobId,
      firstName: values.firstName,
      lastName: values.lastName,
      otherNames: values.otherNames,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      nationality: values.nationality,
      nationalId: values.nationalId,
      maritalStatus: values.maritalStatus,
      candidateEmail: values.candidateEmail,
      candidatePhone: values.candidatePhone,
      alternativePhone: values.alternativePhone,
      physicalAddress: values.physicalAddress,
      city: values.city,
      province: values.province,
      district: values.district,
      postalAddress: values.postalAddress,
      preferredLocation: values.preferredLocation,
      availability: values.availability,
      relocate: values.relocate,
      workType: values.workType,
      education: values.education,
      experience: values.experience,
      technicalSkills,
      softSkills,
      languages: values.languages,
      computerLiteracy: values.computerLiteracy,
      certificationsLicenses: values.certificationsLicenses,
      personalStatement: values.personalStatement,
      coverLetter: values.coverLetter,
      cvUrl: values.cvUrl,
      documents: values.documents,
      screeningAnswers: values.screeningAnswers,
      referees: values.referees,
      expectedSalary: values.expectedSalary,
      currentSalary: values.currentSalary,
      noticePeriod: values.noticePeriod,
      declarationAgreed: values.declarationAgreed,
      backgroundCheckConsent: values.backgroundCheckConsent,
      conflictOfInterest: values.conflictOfInterest,
      criminalRecord: values.criminalRecord,
      dataPrivacyConsent: values.dataPrivacyConsent,
      ...(values.diOptIn ? {
        diversityInfo: {
          disabilityStatus: values.disabilityStatus,
          genderIdentity: values.genderIdentity,
          ethnicity: values.ethnicity,
        }
      } : {}),
    };

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? "Submission failed");
    }

    const result = await res.json() as { id: number };

    // Clear local draft
    localStorage.removeItem(DRAFT_KEY(jobId));

    setSubmitted({ id: result.id, email: values.candidateEmail });
  };

  const handleSubmit = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast({ title: "Please complete all required fields", variant: "destructive" });
      // Jump to first step with an error
      for (let i = 0; i < STEPS.length; i++) {
        const stepFields = STEPS[i]?.fields ?? [];
        const hasError = stepFields.some(f => !!form.formState.errors[f]);
        if (hasError) { setCurrentStep(i); break; }
      }
      return;
    }
    try {
      await onSubmit(form.getValues());
    } catch (err) {
      toast({ title: "Submission failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const progressPct = ((currentStep + 1) / totalSteps) * 100;
  const StepIcon = STEPS[currentStep]?.icon ?? User;

  const handleClose = (v: boolean) => {
    if (!v) {
      saveDraftLocally();
      setSubmitted(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {submitted ? "Application Submitted" : `Apply for: ${jobTitle ?? "Position"}`}
            </DialogTitle>
            {!submitted && (
              <Button size="sm" variant="ghost" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="ml-1.5 text-xs">Save Draft</span>
              </Button>
            )}
          </div>
          {!submitted && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <StepIcon className="h-3.5 w-3.5" />
                  Step {currentStep + 1} of {totalSteps}: {STEPS[currentStep]?.label}
                </span>
                <span>{Math.round(progressPct)}% complete</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
              {/* Step pills */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = i === currentStep;
                  const isDone = i < currentStep;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => { if (i < currentStep) { saveDraftLocally(); setCurrentStep(i); } }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                        isActive ? "bg-primary text-primary-foreground font-medium" :
                        isDone ? "bg-primary/15 text-primary cursor-pointer" :
                        "bg-muted text-muted-foreground cursor-default"
                      }`}
                    >
                      {isDone ? <Check className="h-2.5 w-2.5" /> : <Icon className="h-2.5 w-2.5" />}
                      {step.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {submitted ? (
            <div className="space-y-4 py-4" data-testid="apply-success">
              <div className="rounded-lg bg-green-50 border border-green-200 p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-green-700 font-semibold text-lg">Application Submitted Successfully!</p>
                <p className="text-xs text-muted-foreground">Save your reference number to track your application status.</p>
                <div className="bg-white border-2 rounded-lg px-6 py-3 mt-2 font-mono text-2xl font-bold tracking-widest text-primary" data-testid="apply-reference">
                  REF-{String(submitted.id).padStart(6, "0")}
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Use your email <strong>{submitted.email}</strong> and the reference number above at{" "}
                <Link href="/track-application" className="text-primary underline">Track Application</Link>{" "}
                to check your status.
              </p>
              <Button className="w-full" onClick={() => { handleClose(false); form.reset(); setCurrentStep(0); }}>
                Close
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={e => e.preventDefault()} className="space-y-4">
                {currentStep === 0 && <Step1Personal form={form} />}
                {currentStep === 1 && <Step2Contact form={form} />}
                {currentStep === 2 && <Step3Position form={form} jobTitle={jobTitle} />}
                {currentStep === 3 && <Step4EducationExp form={form} />}
                {currentStep === 4 && <Step5Skills form={form} />}
                {currentStep === 5 && <Step6Documents form={form} jobId={jobId} toast={toast} />}
                {currentStep === 6 && <Step7Screening form={form} questions={screeningQuestions} />}
                {currentStep === 7 && <Step8Declarations form={form} />}
                {currentStep === 8 && <StepDiversity form={form} />}
              </form>
            </Form>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="flex-shrink-0 border-t px-6 py-4 flex items-center justify-between bg-background">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {currentStep < totalSteps - 1 ? (
                <Button onClick={handleNext} data-testid="button-wizard-next">
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={form.formState.isSubmitting}
                  data-testid="button-submit-application"
                  className="min-w-[140px]"
                >
                  {form.formState.isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Submit Application</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Draft Banner ─────────────────────────────────────────────────────────────

const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function draftRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function DraftBanner({ jobId, onResume }: { jobId: number; onResume: () => void }) {
  const [hasDraft, setHasDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage first; auto-discard if older than 30 days
    const localKey = DRAFT_KEY(jobId);
    const raw = localStorage.getItem(localKey);
    let localHasDraft = false;
    let localSavedAt: string | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { savedAt?: string };
        const ts = parsed.savedAt ? new Date(parsed.savedAt).getTime() : null;
        if (ts && Date.now() - ts > DRAFT_MAX_AGE_MS) {
          localStorage.removeItem(localKey);
        } else {
          localHasDraft = true;
          localSavedAt = parsed.savedAt ?? null;
        }
      } catch {
        localHasDraft = true;
      }
    }

    // Also check server draft for authenticated users
    const token = getToken();
    if (token) {
      const payload = decodeToken(token);
      const email = payload?.email;
      if (email) {
        fetch(`/api/applications/draft/${jobId}?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(res => (res.ok ? res.json() : null))
          .then((draft: { draftData?: unknown } | null) => {
            setHasDraft(localHasDraft || !!(draft?.draftData));
            setSavedAt(localSavedAt);
          })
          .catch(() => { setHasDraft(localHasDraft); setSavedAt(localSavedAt); });
        return;
      }
    }
    setHasDraft(localHasDraft);
    setSavedAt(localSavedAt);
  }, [jobId]);

  if (!hasDraft) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <Save className="h-4 w-4" />
        <div>
          <span>You have a saved draft for this position.</span>
          {savedAt && (
            <span className="ml-1 text-amber-600 text-xs">
              Saved {draftRelativeTime(savedAt)}
            </span>
          )}
        </div>
      </div>
      <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={onResume}>
        Continue Application
      </Button>
    </div>
  );
}
