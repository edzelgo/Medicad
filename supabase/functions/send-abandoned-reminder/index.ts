import { admin, alreadySent, recordSent, sendEmail, getUserEmail, layout, checklist, corsHeaders } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, full_name, phone, address, created_at")
      .lte("created_at", cutoff);
    if (error) throw error;

    const sent: string[] = [];
    for (const p of profiles ?? []) {
      const missing: string[] = [];
      if (!p.full_name?.trim()) missing.push("Full name");
      if (!p.phone?.trim()) missing.push("Phone number");
      if (!p.address?.trim()) missing.push("Mailing address");
      if (!missing.length) continue;
      if (await alreadySent(p.id, "abandoned_application", "v1")) continue;

      const email = await getUserEmail(p.id);
      if (!email) continue;

      const allFields = [
        { label: "Full name", key: "Full name" },
        { label: "Phone number", key: "Phone number" },
        { label: "Mailing address", key: "Mailing address" },
      ];
      const items = allFields.map((f) => ({ label: f.label, done: !missing.includes(f.key) }));
      const firstName = p.full_name ? p.full_name.split(" ")[0] : "";
      const html = layout(
        "Let's finish your Medicaid application",
        `<p style="margin:0 0 12px">Hi${firstName ? " " + firstName : " there"},</p>
         <p style="margin:0 0 12px">You started your Medicaid Success application but a few profile details are still missing. Adding them takes about two minutes and lets your case manager begin reviewing your eligibility right away.</p>
         <p style="margin:18px 0 6px;font-weight:600;color:#0b3d91">Still needed on your profile:</p>
         ${checklist(items)}
         <p style="margin:18px 0 0">Once these are in, we'll reach out within one business day with next steps.</p>`,
        { preheader: `You're ${missing.length} field${missing.length === 1 ? "" : "s"} away from completing your application.`,
          cta: { label: "Complete my profile" } },
      );
      await sendEmail(email, "Action needed: complete your Medicaid application", html);
      await recordSent(p.id, "abandoned_application", "v1");
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