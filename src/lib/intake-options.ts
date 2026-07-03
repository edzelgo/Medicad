// Hardcoded dropdown option lists for case intake, matching Bolt's "Add New Case" form.
// Not a no-code config engine (per product decision) — to add/change an option, edit here
// and redeploy.

export const CASE_TYPE_OPTIONS = ["medicaid", "caregiver"] as const;

export const REFERRAL_TYPE_OPTIONS = [
  "Agent",
  "Attorney",
  "Discharge Planner",
  "Facility",
  "Family Member",
  "Hospital",
  "Marketer",
  "Self",
  "Other",
] as const;

export const REFERRAL_SOURCE_TYPE_OPTIONS = [
  "Marketer",
  "Facility",
  "Referral Partner",
  "Web",
  "Other",
] as const;

export const VETERAN_STATUS_OPTIONS = [
  "Not a veteran",
  "Veteran",
  "Spouse of veteran",
  "Unknown",
] as const;

export const MARITAL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
] as const;

export const BROCHURE_PROVIDED_OPTIONS = [
  "Mailed",
  "Emailed",
  "Handed in person",
  "Not yet provided",
] as const;

export const MEDICAID_ASSET_REQUIREMENT_OPTIONS = ["Yes", "No", "Unknown"] as const;

// Caregiver (CG) vertical — placeholder taxonomy. Bolt's actual CG Dropdown Config
// page was never captured (blocked before we reached it), so these are reasonable
// starting values based on the Medicaid track's shape. Refine once real CG workflow
// names are available.
export const CG_WORKFLOW_OPTIONS = [
  "Caregiver Intake",
  "Caregiver Services Active",
  "Caregiver Services On Hold",
  "Caregiver Services Closed",
] as const;

export const CG_STATUS_OPTIONS = [
  "Referral Received",
  "Assessment Scheduled",
  "Assessment Complete",
  "Care Plan Active",
  "Care Plan Paused",
  "Discharged",
] as const;
