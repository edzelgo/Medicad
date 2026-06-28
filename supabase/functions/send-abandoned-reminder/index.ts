import { admin, alreadySent, recordSent, sendEmail, getUserEmail, layout, corsHeaders } from "../_shared/email.ts";

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

      const items = missing.map((m) => `<li>${m}</li>`).join("");
      const html = layout(
        "Finish your Medicaid application",
        `<p>Hi${p.full_name ? " " + p.full_name.split(" ")[0] : ""},</p>
         <p>You started your Medicaid Success application but haven't completed your profile yet. To keep your application moving, please add:</p>
         <ul>${items}</ul>
         <p><a href="https://medicaid-sucess-onboarding.lovable.app/portal" style="display:inline-block;background:#0b3d91;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Complete my profile</a></p>`,
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