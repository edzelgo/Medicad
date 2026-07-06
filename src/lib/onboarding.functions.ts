import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOnboarder, getOnboarderAccess } from "@/lib/auth/staff";
import { z } from "zod";

const onboardSchema = z.object({
  case_type: z.enum(["medicaid", "caregiver"]).default("medicaid"),
  first_name: z.string().trim().min(1).max(100),
  middle_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  last_name: z.string().trim().min(1).max(100),
  dob: z.string().optional().nullable().or(z.literal("")),
  ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  phone_cell: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  phone_home: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  phone_other: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  address1: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  apartment: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  city: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  county: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  state: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  zip: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  veteran_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  marital_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  spouse_first_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_last_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_dob: z.string().optional().nullable().or(z.literal("")),
  spouse_ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  responsible_party_name: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  responsible_party_phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  responsible_party_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  meets_asset_requirements: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  months_until_spend_down: z.number().int().optional().nullable(),
  transferred_resources_60mo: z.boolean().optional().nullable(),
  transfer_amount: z.number().optional().nullable(),
  brochure_provided: z.array(z.string()).optional(),
  workflow: z.string().trim().min(1),
  ref_source: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  marketer: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  date_received: z.string().optional().nullable().or(z.literal("")),
  invite_client: z.boolean().default(false),
  client_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
});

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function genCaseNumber() {
  return `C-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase()}`;
}

export const myOnboardAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getOnboarderAccess(context));

export const onboardClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => onboardSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { role } = await assertOnboarder(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const {
      workflow, ref_source, marketer, date_received,
      invite_client, client_email, ...demo
    } = data;

    const casePayload = clean(demo);
    casePayload.case_number = genCaseNumber();
    const { data: caseRow, error: caseErr } = await supabaseAdmin
      .from("cases").insert(casePayload as never).select("id, case_number").single();
    if (caseErr) { console.error("[db]", caseErr.message); throw new Error("Failed to create case."); }

    const trackPayload = clean({ ref_source, marketer, date_received });
    trackPayload.case_id = caseRow.id;
    trackPayload.workflow = workflow;
    trackPayload.status = "Workflow Created";
    trackPayload.status_date = new Date().toISOString().slice(0, 10);
    if (role === "referral") trackPayload.ref_source = trackPayload.ref_source ?? "Referral Partner";
    const { error: trackErr } = await supabaseAdmin
      .from("case_tracks").insert(trackPayload as never);
    if (trackErr) { console.error("[db]", trackErr.message); throw new Error("Failed to create workflow track."); }

    let invite: { sent: boolean; email?: string; error?: string } = { sent: false };
    if (invite_client && client_email) {
      try {
        const fullName = `${data.first_name} ${data.last_name}`.trim();
        const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          client_email,
          {
            data: { role: "client", full_name: fullName, phone: data.phone_cell ?? undefined },
          },
        );
        if (inviteErr) throw inviteErr;
        invite = { sent: true, email: client_email };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invite failed";
        console.error("[invite]", msg);
        invite = { sent: false, email: client_email, error: msg };
      }
    }

    return {
      case_id: caseRow.id,
      case_number: caseRow.case_number,
      invite,
    };
  });