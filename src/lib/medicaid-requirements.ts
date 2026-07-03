// Shared list of standard documents required for a long-term care Medicaid
// application. Used by the client portal checklist and the admin CRM
// progress tracker so both views stay in sync.
export type MedicaidRequirement = { label: string; hint: string; match: RegExp };

export const REQUIRED_DOCUMENTS: MedicaidRequirement[] = [
  { label: "Government-issued photo ID",       hint: "Driver's license, state ID, or passport",                              match: /(\bid\b|driver|license|passport|state[\s_-]?id)/i },
  { label: "Social Security card",             hint: "Applicant and spouse if married",                                      match: /(social|ssn|ss[\s_-]?card)/i },
  { label: "Medicare card",                    hint: "Front and back",                                                       match: /medicare/i },
  { label: "Birth certificate",                hint: "Proof of age and citizenship",                                         match: /(birth|certificate)/i },
  { label: "Marriage certificate",             hint: "If currently or previously married",                                   match: /(marriage|marri)/i },
  { label: "Proof of income (last 3 months)",  hint: "Social Security, pension, annuity, or wage statements",                match: /(income|pension|wage|paystub|pay[\s_-]?stub|annuity|ssa)/i },
  { label: "Bank statements (last 60 months)", hint: "All checking, savings, and money-market accounts",                     match: /(bank|checking|savings|statement)/i },
  { label: "Life insurance policies",          hint: "Declaration page and cash-value statement",                            match: /(life[\s_-]?insurance|policy)/i },
  { label: "Health insurance card",            hint: "Any supplemental or long-term care coverage",                          match: /(health[\s_-]?insurance|insurance[\s_-]?card|supplement)/i },
  { label: "Deed / mortgage statement",        hint: "Required if you own real property",                                    match: /(deed|mortgage|property|real[\s_-]?estate)/i },
  { label: "Vehicle title or registration",    hint: "For every vehicle owned",                                              match: /(title|registration|vehicle|auto)/i },
  { label: "Burial / funeral contract",        hint: "Prepaid burial or funeral arrangements, if any",                       match: /(burial|funeral|cemetery)/i },
  { label: "Power of attorney",                hint: "Financial or healthcare POA documents",                                 match: /(power[\s_-]?of[\s_-]?attorney|poa)/i },
  { label: "Medical / facility records",       hint: "Admission paperwork or physician's level-of-care assessment",          match: /(medical|physician|admission|facility|level[\s_-]?of[\s_-]?care)/i },
];

export type RequirementProgress = {
  total: number;
  satisfied: number;
  percent: number;
  missing: string[];
  satisfiedLabels: string[];
};

export function computeRequirementProgress(filenames: string[]): RequirementProgress {
  const satisfiedLabels: string[] = [];
  const missing: string[] = [];
  for (const req of REQUIRED_DOCUMENTS) {
    if (filenames.some((n) => req.match.test(n))) satisfiedLabels.push(req.label);
    else missing.push(req.label);
  }
  const total = REQUIRED_DOCUMENTS.length;
  const satisfied = satisfiedLabels.length;
  return { total, satisfied, percent: Math.round((satisfied / total) * 100), missing, satisfiedLabels };
}