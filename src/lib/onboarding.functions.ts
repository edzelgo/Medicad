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
  // Account handling:
  //   none     — save the intake as a lead only (no login)
  //   invite   — email the client a magic-link invite (needs an email)
  //   password — create a confirmed client login now with a temp password and
  //              no email sent; email is optional (a placeholder is generated).
  //              Admin-only.
  account_mode: z.enum(["none", "invite", "password"]).optional(),
  client_full_name: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  // Back-compat with the earlier invite checkbox.
  invite_client: z.boolean().optional().default(false),
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

/** Readable, reasonably strong temporary password (no ambiguous chars). */
function genTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return `${out}!7`; // guarantee a symbol + digit for password policies
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

    const { invite_client, client_email, account_mode, client_full_name, ...intake } = data;

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
    if (leadErr || !leadRow) { console.error("[db]", leadErr?.message); throw new Error("Failed to save intake."); }
    const leadId: string = leadRow.id;

    const fullName = (client_full_name?.trim()) || `${data.first_name} ${data.last_name}`.trim();
    const mode = account_mode ?? (invite_client ? "invite" : "none");

    // Link a freshly-created client account back to this lead (best-effort;
    // the client_user_id column may not exist until the migration is applied).
    async function linkClient(userId: string) {
      const { error } = await supabaseAdmin
        .from("leads").update({ client_user_id: userId } as never).eq("id", leadId);
      if (error && !/client_user_id.*does not exist/i.test(error.message)) {
        console.error("[onboard:link]", error.message);
      }
    }

    type Account =
      | { mode: "none" }
      | { mode: "invite"; sent: boolean; email?: string; error?: string }
      | { mode: "password"; created: boolean; email?: string; tempPassword?: string; placeholder?: boolean; error?: string };
    let account: Account = { mode: "none" };

    if (mode === "invite") {
      account = { mode: "invite", sent: false };
      if (!client_email) {
        account = { mode: "invite", sent: false, error: "An email is required to send an invite." };
      } else {
        try {
          const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            client_email, { data: { role: "client", full_name: fullName, phone: data.phone ?? undefined } },
          );
          if (error) throw error;
          if (invited?.user?.id) await linkClient(invited.user.id);
          account = { mode: "invite", sent: true, email: client_email };
        } catch (e) {
          account = { mode: "invite", sent: false, email: client_email, error: e instanceof Error ? e.message : "Invite failed" };
        }
      }
    } else if (mode === "password") {
      // Creating a login with a set password is powerful — admins only.
      if (role !== "admin") throw new Error("Only admins can create a client login with a password.");
      const placeholder = !client_email;
      const email = client_email || `client.${leadId.slice(0, 8)}.${Date.now().toString(36)}@no-email.invalid`;
      const tempPassword = genTempPassword();
      try {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: "client", full_name: fullName, phone: data.phone ?? undefined },
        });
        if (error) throw error;
        const uid = created?.user?.id;
        if (uid) {
          // Ensure the client role exists even if the signup trigger didn't set it.
          await supabaseAdmin.from("user_roles").upsert(
            { user_id: uid, role: "client", status: "approved" }, { onConflict: "user_id,role" },
          );
          await supabaseAdmin.from("profiles").upsert(
            { id: uid, full_name: fullName, phone: data.phone ?? null }, { onConflict: "id" },
          );
          await linkClient(uid);
        }
        account = { mode: "password", created: true, email, tempPassword, placeholder };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Account creation failed";
        account = { mode: "password", created: false, email, error: /already.*(registered|exists)/i.test(msg) ? "A user with this email already exists." : msg };
      }
    }

    return { lead_id: leadId, account };
  });