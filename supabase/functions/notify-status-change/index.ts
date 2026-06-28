import { admin, sendEmail, getUserEmail, layout, recordSent, corsHeaders } from "../_shared/email.ts";

const STATUS_LABEL: Record<string, string> = {
  new_lead: "New Lead",
  documents_pending: "Documents Pending",
  under_review: "Under Review",
  submitted_to_medicaid: "Submitted to Medicaid",
  approved: "Approved",
  denied: "Denied",
};

const NEXT_STEP: Record<string, string> = {
  new_lead: "We're reviewing your information and will reach out shortly to start your intake.",
  documents_pending: "Please upload the required documents (ID, proof of income, proof of residency, medical records) in your portal.",
  under_review: "Our specialists are reviewing your file. No action is needed from you right now.",
  submitted_to_medicaid: "Your application has been submitted to the state Medicaid agency. We'll keep you posted on their response.",
  approved: "Congratulations — your Medicaid application was approved! Your case manager will contact you with next steps.",
  denied: "Your application was denied. Your case manager will reach out to discuss appeal options.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { user_id, new_status, old_status } = await req.json();
    if (!user_id || !new_status) {
      return new Response(JSON.stringify({ ok: false, error: "Missing user_id or new_status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user_id).maybeSingle();
    const email = await getUserEmail(user_id);
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "No user email" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const label = STATUS_LABEL[new_status] ?? new_status;
    const next = NEXT_STEP[new_status] ?? "Your case manager will contact you with more details.";
    const html = layout(
      `Your application status: ${label}`,
      `<p>Hi${profile?.full_name ? " " + profile.full_name.split(" ")[0] : ""},</p>
       <p>Your Medicaid application status has been updated to <strong>${label}</strong>${old_status ? ` (previously ${STATUS_LABEL[old_status] ?? old_status})` : ""}.</p>
       <p><strong>What's next:</strong> ${next}</p>
       <p><a href="https://medicaid-sucess-onboarding.lovable.app/portal" style="display:inline-block;background:#0b3d91;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">View my application</a></p>`,
    );

    await sendEmail(email, `Medicaid application update: ${label}`, html);
    await recordSent(user_id, "status_change", `${old_status ?? "none"}->${new_status}-${Date.now()}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});