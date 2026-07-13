// Group B #18 — conditional/logic-based intake fields. A pure, dependency-free
// catalog + evaluator usable on both client (intake form) and server. Rules are
// stored in the field_rules table and edited by admins in Settings.

/** Intake fields whose visibility/requiredness can be driven by a rule. */
export const CONTROLLABLE_FIELDS = [
  { key: "ssn", label: "Social Security Number" },
  { key: "dob", label: "Date of birth" },
  { key: "address", label: "Address" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP code" },
  { key: "veteran_status", label: "Veteran status" },
  { key: "transfer_amount", label: "Estimated transfer amount" },
  { key: "date_first_coverage", label: "Date first coverage needed" },
  { key: "estimated_spend_down_remaining", label: "Estimated resources to spend down" },
  { key: "email", label: "Email" },
] as const;

/** Fields usable as the condition source. */
export const CONDITION_FIELDS = [
  { key: "referral_status", label: "Current status of referral" },
  { key: "veteran_status", label: "Veteran status" },
  { key: "marital_status", label: "Marital status" },
  { key: "state", label: "State" },
  { key: "spend_down_completed", label: "Spend-down completed" },
  { key: "transferred_resources_60mo", label: "Transferred resources (60mo)" },
  { key: "retroactive_required", label: "Retroactive benefits required" },
  { key: "has_lri", label: "Has a Legally Responsible Individual" },
] as const;

export const OPERATORS = ["equals", "not_equals", "contains", "truthy", "falsy"] as const;
export type Operator = (typeof OPERATORS)[number];
export const OPERATOR_LABEL: Record<Operator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  truthy: "is set / yes",
  falsy: "is empty / no",
};

export const FIELD_ACTIONS = ["show", "require"] as const;
export type FieldAction = (typeof FIELD_ACTIONS)[number];

export type FieldRule = {
  field: string;
  condition_field: string;
  operator: Operator;
  condition_value: string | null;
  action: FieldAction;
};

function matches(rule: FieldRule, values: Record<string, unknown>): boolean {
  const raw = values[rule.condition_field];
  const cmp = (rule.condition_value ?? "").trim().toLowerCase();
  switch (rule.operator) {
    case "truthy":
      return typeof raw === "boolean" ? raw : !!(raw != null && String(raw).trim() !== "");
    case "falsy":
      return typeof raw === "boolean" ? !raw : !(raw != null && String(raw).trim() !== "");
    case "equals":
      return String(raw ?? "").trim().toLowerCase() === cmp;
    case "not_equals":
      return String(raw ?? "").trim().toLowerCase() !== cmp;
    case "contains":
      return String(raw ?? "").toLowerCase().includes(cmp);
    default:
      return false;
  }
}

export type FieldRuleState = { hidden: Set<string>; required: Set<string> };

/**
 * Evaluate rules against the current form values.
 * - A field with one or more `show` rules is HIDDEN unless at least one matches.
 * - A field is REQUIRED when any active `require` rule matches.
 * Fields with no `show` rule are always visible.
 */
export function evaluateFieldRules(rules: FieldRule[], values: Record<string, unknown>): FieldRuleState {
  const showFields = new Set(rules.filter((r) => r.action === "show").map((r) => r.field));
  const shown = new Set<string>();
  const required = new Set<string>();
  for (const r of rules) {
    if (!matches(r, values)) continue;
    if (r.action === "show") shown.add(r.field);
    else if (r.action === "require") required.add(r.field);
  }
  const hidden = new Set<string>();
  for (const f of showFields) if (!shown.has(f)) hidden.add(f);
  return { hidden, required };
}
