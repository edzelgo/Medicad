import { admin, alreadySent, recordSent, sendEmail, getUserEmail, layout, checklist, corsHeaders, requireCronAuth } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = requireCronAuth(req);
  if (unauth) return unauth;
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

      const firstName = p.full_name ? p.full_name.split(" ")[0] : "";
      const html = layout(
        "We need a few documents to keep your application moving",
        `<p style="margin:0 0 12px">Hi${firstName ? " " + firstName : " there"},</p>
         <p style="margin:0 0 12px">Your Medicaid application is currently on hold because we haven't received your supporting documents yet. Upload them in your portal and we'll resume your review right away.</p>
         <p style="margin:18px 0 6px;font-weight:600;color:#0b3d91">Documents we need:</p>
         ${checklist([
           { label: "Government-issued photo ID" },
           { label: "Proof of income (last 3 months)" },
           { label: "Proof of residency" },
           { label: "Medical records / level-of-care assessment" },
         ])}
         <p style="margin:18px 0 0">You can upload up to 200 files at once — we'll handle organizing and combining them for you.</p>`,
        { preheader: "Upload your ID, proof of income, residency, and medical records to resume your review.",
          cta: { label: "Upload documents" } },
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