import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOnboarder } from "@/lib/auth/staff";
import { assertStaff } from "@/lib/auth/staff";
import { OPERATORS, FIELD_ACTIONS, type FieldRule } from "@/lib/field-rules";
import { z } from "zod";

function tbl(client: unknown, name: string) {
  return ((client as { from: (t: string) => any }).from)(name);
}

/** All active intake field rules. Readable by anyone who can submit intake
 *  (staff or referral partners). Empty when the table is missing. */
export const listFieldRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rules: FieldRule[]; editable: boolean }> => {
    // Onboarders (admin/agent/referral) may read; only admins edit.
    await assertOnboarder(context);
    const { data, error } = await tbl(context.supabase, "field_rules")
      .select("field, condition_field, operator, condition_value, action, active, form")
      .eq("form", "intake") as { data: any[] | null; error: any };
    if (error) return { rules: [], editable: false };
    return {
      rules: (data ?? []).filter((r) => r.active).map((r) => ({
        field: r.field, condition_field: r.condition_field, operator: r.operator,
        condition_value: r.condition_value, action: r.action,
      })),
      editable: true,
    };
  });

const ruleSchema = z.object({
  field: z.string().trim().min(1).max(100),
  condition_field: z.string().trim().min(1).max(100),
  operator: z.enum(OPERATORS),
  condition_value: z.string().trim().max(200).optional().nullable(),
  action: z.enum(FIELD_ACTIONS),
});

export const addFieldRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ruleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = data.operator === "truthy" || data.operator === "falsy" ? null : (data.condition_value ?? null);
    const { error } = await tbl(supabaseAdmin, "field_rules").upsert(
      {
        form: "intake", field: data.field, condition_field: data.condition_field,
        operator: data.operator, condition_value: value, action: data.action, active: true,
      },
      { onConflict: "form,field,condition_field,operator,condition_value,action" },
    ) as { error: any };
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Field rules aren't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to add rule.");
    }
    return { ok: true };
  });

export const removeFieldRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ruleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = data.operator === "truthy" || data.operator === "falsy" ? null : (data.condition_value ?? null);
    let builder = tbl(supabaseAdmin, "field_rules")
      .update({ active: false })
      .eq("form", "intake").eq("field", data.field).eq("condition_field", data.condition_field)
      .eq("operator", data.operator).eq("action", data.action);
    builder = value === null ? builder.is("condition_value", null) : builder.eq("condition_value", value);
    const { error } = await builder as { error: any };
    if (error) throw new Error("Failed to remove rule.");
    return { ok: true };
  });
