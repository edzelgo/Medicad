import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOnboarder, getOnboarderAccess } from "@/lib/auth/staff";
import { z } from "zod";

// Facility Intake schema — mirrors the fields captured in the Bolt Facility
// Intake spec (Bolt_Intake_May_19.xlsx). Everything except first/last name is
// optional so referral partners can submit what they have and staff can
// complete the record later.
const intakeSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  middle_initial: z.string().trim().max(5).optional().nullable().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  state: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  zip: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  dob: z.string().optional().nullable().or(z.literal("")),
  ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  source: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  referral_status: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  veteran_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  marital_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  spouse_first_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_last_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_dob: z.string().optional().nullable().or(z.literal("")),
  spouse_ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  has_lri: z.boolean().optional(),
  lri_first_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  lri_last_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  lri_phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  lri_email: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  lri_status: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spend_down_completed: z.boolean().optional().nullable(),
  transferred_resources_60mo: z.boolean().optional().nullable(),
  transfer_amount: z.number().optional().nullable(),
  retroactive_required: z.boolean().optional().nullable(),
  date_first_coverage: z.string().optional().nullable().or(z.literal("")),
  estimated_spend_down_remaining: z.number().optional().nullable(),
  brochure_provided: z.array(z.string()).optional(),
  notes: z.string().max(10000).optional().nullable().or(z.literal("")),
  invite_client: z.boolean().default(false),
  client_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
});

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === "" || v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

export const myOnboardAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getOnboarderAccess(context));

export const onboardClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => intakeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { role } = await assertOnboarder(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { invite_client, client_email, ...intake } = data;

    const payload = clean(intake) as Record<string, unknown>;
    payload.created_by = context.userId;
    payload.assigned_to = context.userId;
    payload.stage = "intake";
    // Referrals default the source to their org tag if none provided.
    if (role === "referral" && !payload.source) payload.source = "Referral Partner";

    const { data: leadRow, error: leadErr } = await supabaseAdmin
      .from("leads")
      .insert(payload as never)
      .select("id")
      .single();
    if (leadErr) { console.error("[db]", leadErr.message); throw new Error("Failed to save intake."); }

    let invite: { sent: boolean; email?: string; error?: string } = { sent: false };
    if (invite_client && client_email) {
      try {
        const fullName = `${data.first_name} ${data.last_name}`.trim();
        const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          client_email,
          { data: { role: "client", full_name: fullName, phone: data.phone ?? undefined } },
        );
        if (inviteErr) throw inviteErr;
        invite = { sent: true, email: client_email };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invite failed";
        console.error("[invite]", msg);
        invite = { sent: false, email: client_email, error: msg };
      }
    }

    return { lead_id: leadRow.id, invite };
  });