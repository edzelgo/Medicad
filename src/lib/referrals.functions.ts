import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, getOnboarderAccess } from "@/lib/auth/staff";
import { z } from "zod";

export const ORG_TYPES = ["Facility", "Attorney", "Hospital", "Agency", "Marketer", "Other"] as const;

export type ReferralOrg = {
  id: string;
  name: string;
  org_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

// referral_orgs isn't in the generated Database types until the next Lovable
// type sync — access it untyped until then.
function orgsTable(client: { from: (t: string) => unknown }) {
  return (client.from as (t: string) => any)("referral_orgs");
}

export type ReferralOrgList = { orgs: ReferralOrg[]; editable: boolean };

/** List referral orgs. Returns editable:false (empty) when the table is missing. */
export const listReferralOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralOrgList> => {
    await assertStaff(context);
    const { data, error } = await orgsTable(context.supabase)
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true }) as { data: ReferralOrg[] | null; error: { message: string } | null };
    if (error) return { orgs: [], editable: false };
    return { orgs: data ?? [], editable: true };
  });

const orgSchema = z.object({
  name: z.string().trim().min(1).max(200),
  org_type: z.enum(ORG_TYPES).optional().nullable(),
  contact_name: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  contact_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
});

export const addReferralOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = { name: data.name };
    for (const k of ["org_type", "contact_name", "contact_email", "contact_phone", "notes"] as const) {
      if (data[k]) payload[k] = data[k];
    }
    const { error } = await orgsTable(supabaseAdmin).insert(payload) as { error: { message: string } | null };
    if (error) {
      console.error("[db]", error.message);
      if (error.message.includes("does not exist")) {
        throw new Error("Referral partners aren't available yet — apply the pending migration via Lovable first.");
      }
      if (error.message.includes("duplicate")) throw new Error("A partner with that name already exists.");
      throw new Error("Failed to add referral partner.");
    }
    return { ok: true };
  });

export const updateReferralOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    patch: orgSchema.partial().extend({ active: z.boolean().optional() }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (v === "" ) { patch[k] = null; continue; }
      if (v !== undefined) patch[k] = v;
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await orgsTable(supabaseAdmin).update(patch).eq("id", data.id) as { error: { message: string } | null };
    if (error) { console.error("[db]", error.message); throw new Error("Failed to update referral partner."); }
    return { ok: true };
  });

/**
 * Assign a lead to a referral partner org. Isolated (like priority) so a
 * missing referral_org_id column can't break the main lead save.
 */
export const setLeadReferralOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lead_id: z.string().uuid(),
    referral_org_id: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await (context.supabase.from("leads") as any)
      .update({ referral_org_id: data.referral_org_id }).eq("id", data.lead_id);
    if (error) {
      console.error("[db]", error.message);
      if (/referral_org_id.*does not exist/i.test(error.message)) {
        throw new Error("Referral partner linking isn't available yet — apply the pending migration via Lovable first.");
      }
      throw new Error("Operation failed. Please try again.");
    }
    return { ok: true };
  });

export type MyReferral = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  stage: string;
  created_at: string;
};

/**
 * Group D #46 — a referral partner's own submitted referrals with current
 * status. Scoped to created_by = self so partners never see other intakes.
 */
export const listMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyReferral[]> => {
    const access = await getOnboarderAccess(context);
    if (!access.allowed) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, full_name, first_name, last_name, stage, created_at")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return (data ?? []) as MyReferral[];
  });
