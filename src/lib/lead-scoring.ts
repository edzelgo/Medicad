// Group D #48 — heuristic lead score. Pure + dependency-free so it runs on the
// client (lead detail) without a round-trip. Reflects how "ready to convert"
// a long-term-care Medicaid intake looks based on the data captured.

export type ScoredLead = {
  email?: string | null;
  phone?: string | null;
  ssn?: string | null;
  veteran_status?: string | null;
  marital_status?: string | null;
  spend_down_completed?: boolean | null;
  transferred_resources_60mo?: boolean | null;
  monthly_income?: number | null;
  household_size?: number | null;
  has_lri?: boolean | null;
  stage?: string | null;
  created_at?: string | null;
};

export type LeadScore = {
  score: number;
  band: "hot" | "warm" | "cold";
  factors: { label: string; points: number }[];
};

export function computeLeadScore(lead: ScoredLead): LeadScore {
  const factors: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => factors.push({ label, points });

  if (lead.email) add("Email on file", 10);
  if (lead.phone) add("Phone on file", 10);
  if (lead.ssn) add("SSN provided (serious intake)", 10);
  if (lead.veteran_status && /veteran/i.test(lead.veteran_status)) add("Veteran benefit eligibility", 10);
  if (lead.marital_status) add("Marital status known", 5);
  if (lead.spend_down_completed) add("Spend-down completed", 15);
  if (lead.transferred_resources_60mo === false) add("No disqualifying transfers", 10);
  if (lead.monthly_income != null || lead.household_size != null) add("Financials captured", 5);
  if (lead.has_lri) add("Decision-maker (LRI) identified", 10);

  const stagePts: Record<string, number> = {
    screening: 5, application: 10, submitted: 15, approved: 15,
  };
  if (lead.stage && stagePts[lead.stage]) add(`Advanced stage (${lead.stage})`, stagePts[lead.stage]);

  if (lead.created_at) {
    const days = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 7) add("Fresh (≤7 days old)", 10);
  }

  const raw = factors.reduce((a, f) => a + f.points, 0);
  const score = Math.min(100, raw);
  const band: LeadScore["band"] = score >= 60 ? "hot" : score >= 35 ? "warm" : "cold";
  return { score, band, factors };
}
