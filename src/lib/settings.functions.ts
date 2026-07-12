import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";
import { WORKFLOW_OPTIONS, STATUS_OPTIONS } from "@/lib/intake-dashboard.functions";
import {
  CG_WORKFLOW_OPTIONS, CG_STATUS_OPTIONS, REFERRAL_TYPE_OPTIONS, REFERRAL_SOURCE_TYPE_OPTIONS,
  VETERAN_STATUS_OPTIONS, MARITAL_STATUS_OPTIONS, BROCHURE_PROVIDED_OPTIONS, MEDICAID_ASSET_REQUIREMENT_OPTIONS,
} from "@/lib/intake-options";

export const OPTION_CATEGORIES = [
  "medicaid_workflow", "medicaid_status", "cg_workflow", "cg_status",
  "referral_type", "referral_source_type", "veteran_status", "marital_status",
  "brochure_provided", "asset_requirement",
] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

export const OPTION_CATEGORY_LABEL: Record<OptionCategory, string> = {
  medicaid_workflow: "Medicaid workflow tracks",
  medicaid_status: "Medicaid statuses",
  cg_workflow: "Caregiver (CG) workflow tracks",
  cg_status: "Caregiver (CG) statuses",
  referral_type: "Referral type",
  referral_source_type: "Referral source type",
  veteran_status: "Veteran status",
  marital_status: "Marital status",
  brochure_provided: "Brochure provided",
  asset_requirement: "Meets Medicaid asset requirements",
};

// Fallbacks keep every dropdown working until the workflow_options migration
// is applied on the remote (migrations sync via Lovable).
export const OPTION_FALLBACKS: Record<OptionCategory, readonly string[]> = {
  medicaid_workflow: WORKFLOW_OPTIONS,
  medicaid_status: STATUS_OPTIONS,
  cg_workflow: CG_WORKFLOW_OPTIONS,
  cg_status: CG_STATUS_OPTIONS,
  referral_type: REFERRAL_TYPE_OPTIONS,
  referral_source_type: REFERRAL_SOURCE_TYPE_OPTIONS,
  veteran_status: VETERAN_STATUS_OPTIONS,
  marital_status: MARITAL_STATUS_OPTIONS,
  brochure_provided: BROCHURE_PROVIDED_OPTIONS,
  asset_requirement: MEDICAID_ASSET_REQUIREMENT_OPTIONS,
};

export type CrmOptions = {
  /** label lists per category, DB-backed when available */
  options: Record<OptionCategory, string[]>;
  /** false while the workflow_options table doesn't exist yet */
  editable: boolean;
};

function fallbackOptions(): Record<OptionCategory, string[]> {
  return Object.fromEntries(
    OPTION_CATEGORIES.map((c) => [c, [...OPTION_FALLBACKS[c]]]),
  ) as Record<OptionCategory, string[]>;
}

// workflow_options isn't in the generated Database types until the next
// Lovable type sync — access it untyped until then.
type OptionRow = { category: string; label: string; sort_order: number; active: boolean };
function optionsTable(client: { from: (table: string) => unknown }) {
  return (client.from as (table: string) => any)("workflow_options");
}

export const listCrmOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmOptions> => {
    await assertStaff(context);
    const { data, error } = await optionsTable(context.supabase)
      .select("category, label, sort_order, active")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }) as {
        data: OptionRow[] | null;
        error: { message: string } | null;
      };
    if (error) {
      // Table missing (migration not applied yet) — serve the in-code lists.
      return { options: fallbackOptions(), editable: false };
    }
    const options = fallbackOptions();
    const seen = new Set<string>();
    for (const row of data ?? []) {
      if (!row.active) continue;
      if (!(OPTION_CATEGORIES as readonly string[]).includes(row.category)) continue;
      if (!seen.has(row.category)) {
        options[row.category as OptionCategory] = [];
        seen.add(row.category);
      }
      options[row.category as OptionCategory].push(row.label);
    }
    return { options, editable: true };
  });

const addSchema = z.object({
  category: z.enum(OPTION_CATEGORIES),
  label: z.string().trim().min(1).max(150),
});

export const addCrmOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Upsert so re-adding a previously removed (deactivated) option re-enables it.
    const { error } = await optionsTable(supabaseAdmin).upsert(
      { category: data.category, label: data.label, sort_order: 999, active: true },
      { onConflict: "category,label" },
    ) as { error: { message: string } | null };
    if (error) {
      console.error("[db]", error.message);
      if (error.message.includes("does not exist")) {
        throw new Error("Options are not editable yet — the workflow_options migration hasn't been applied. Sync migrations via Lovable first.");
      }
      throw new Error("Failed to add option.");
    }
    return { ok: true };
  });

const removeSchema = z.object({
  category: z.enum(OPTION_CATEGORIES),
  label: z.string().trim().min(1).max(150),
});

export const removeCrmOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Deactivate instead of delete so historical rows referencing the label
    // keep their meaning and the option can be re-enabled by re-adding it.
    const { error } = await optionsTable(supabaseAdmin)
      .update({ active: false })
      .eq("category", data.category)
      .eq("label", data.label) as { error: { message: string } | null };
    if (error) { console.error("[db]", error.message); throw new Error("Failed to remove option."); }
    return { ok: true };
  });
