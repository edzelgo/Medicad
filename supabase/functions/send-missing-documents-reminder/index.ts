import { admin, alreadySent, recordSent, sendEmail, getUserEmail, layout, corsHeaders } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, full_name, application_status, application_status_updated_at, created_at")
      .eq("application_status", "documents_pending");
    if (error) throw error;

    const sent: string[] = [];
    for (const p of profiles ?? []) {
      const since = p.application_status_updated_at ?? p.created_at;
      if (since && since > cutoff) continue;

      const { count } = await admin
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.id);
      if ((count ?? 0) > 0) continue;

      if (await alreadySent(p.id, "missing_documents", "v1")) continue;
      const email = await getUserEmail(p.id);
      if (!email) continue;

      const html = layout(
        "Please upload your Medicaid documents",
        `<p>Hi${p.full_name ? " " + p.full_name.split(" ")[0] : ""},</p>
         <p>Your Medicaid application is on hold pending documents. Please upload the following to your portal:</p>
         <ul>
           <li>Government-issued photo ID</li>
           <li>Proof of income (last 3 months)</li>
           <li>Proof of residency</li>
           <li>Medical records / level-of-care assessment</li>
         </ul>
         <p><a href="https://medicaid-sucess-onboarding.lovable.app/portal" style="display:inline-block;background:#0b3d91;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Upload documents</a></p>`,
      );
      await sendEmail(email, "Documents needed for your Medicaid application", html);
      await recordSent(p.id, "missing_documents", "v1");
      sent.push(email);
    }
    return new Response(JSON.stringify({ ok: true, sent: sent.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});