// Shared helpers for the three Resend-based notification functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const FROM_ADDRESS = "Medicaid Success <onboarding@resend.dev>";

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

export async function alreadySent(userId: string, kind: string, context: string) {
  const { data } = await admin
    .from("email_notifications_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("context", context)
    .maybeSingle();
  return !!data;
}

export async function recordSent(userId: string, kind: string, context: string) {
  await admin.from("email_notifications_log").insert({ user_id: userId, kind, context });
}

export const PORTAL_URL = "https://medicaid-sucess-onboarding.lovable.app/portal";
export const SITE_URL = "https://medicaid-sucess-onboarding.lovable.app";
export const CONTACT_PHONE = "(888) 372-7522";
export const CONTACT_EMAIL = "support@medicaidsuccess.com";

const NAVY = "#0b3d91";
const NAVY_DARK = "#072a66";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BG = "#f4f7fc";

export function button(label: string, href: string = PORTAL_URL) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0">
    <tr><td style="border-radius:8px;background:${NAVY}">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a>
    </td></tr>
  </table>`;
}

export function checklist(items: { label: string; done?: boolean }[]) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 4px">
    ${items.map((i) => `
      <tr><td style="padding:8px 0;border-bottom:1px solid ${BORDER};font-family:Arial,sans-serif;font-size:15px;color:${INK}">
        <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:${i.done ? "#16a34a" : "#e2e8f0"};color:${i.done ? "#fff" : "#64748b"};font-size:13px;font-weight:700;margin-right:10px;vertical-align:middle">${i.done ? "✓" : "•"}</span>
        <span style="vertical-align:middle">${i.label}</span>
      </td></tr>`).join("")}
  </table>`;
}

export function statusTransition(oldLabel: string | null, newLabel: string) {
  const old = oldLabel ?? "Previous status";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0 8px;background:#f1f5fb;border:1px solid ${BORDER};border-radius:10px">
    <tr>
      <td align="center" style="padding:18px 12px;font-family:Arial,sans-serif">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};margin-bottom:6px">From</div>
        <div style="font-size:15px;color:${INK};text-decoration:line-through">${old}</div>
      </td>
      <td align="center" width="40" style="color:${NAVY};font-size:22px;font-weight:700">→</td>
      <td align="center" style="padding:18px 12px;font-family:Arial,sans-serif">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${NAVY};margin-bottom:6px">Now</div>
        <div style="font-size:17px;color:${NAVY_DARK};font-weight:700">${newLabel}</div>
      </td>
    </tr>
  </table>`;
}

interface LayoutOpts {
  preheader?: string;
  cta?: { label: string; href?: string };
}

export function layout(title: string, body: string, opts: LayoutOpts = {}) {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${opts.preheader}</div>`
    : "";
  const cta = opts.cta ? button(opts.cta.label, opts.cta.href) : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${INK}">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER}">
      <tr><td style="background:linear-gradient(135deg,${NAVY} 0%,${NAVY_DARK} 100%);padding:28px 32px" align="left">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding-right:12px;vertical-align:middle">
              <div style="width:44px;height:44px;border-radius:10px;background:#ffffff;color:${NAVY};font-weight:800;font-size:18px;line-height:44px;text-align:center;font-family:Georgia,serif">M</div>
            </td>
            <td style="vertical-align:middle">
              <div style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.1">Medicaid Success</div>
              <div style="color:#cfd8ee;font-size:12px;letter-spacing:.06em;text-transform:uppercase">Long-term care Medicaid planning</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:32px">
        <h1 style="margin:0 0 16px;color:${NAVY_DARK};font-size:22px;line-height:1.3;font-family:Georgia,serif">${title}</h1>
        <div style="font-size:15px;line-height:1.6;color:${INK}">${body}</div>
        ${cta}
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid ${BORDER};padding:22px 32px;font-size:13px;color:${MUTED};line-height:1.6">
        <div style="color:${INK};font-weight:600;margin-bottom:4px">Medicaid Success</div>
        <div>Questions? Call <a href="tel:${CONTACT_PHONE.replace(/[^0-9+]/g, "")}" style="color:${NAVY};text-decoration:none">${CONTACT_PHONE}</a> or email <a href="mailto:${CONTACT_EMAIL}" style="color:${NAVY};text-decoration:none">${CONTACT_EMAIL}</a>.</div>
        <div style="margin-top:8px"><a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline">medicaidsuccess.com</a> · You're receiving this because you started an application with us.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}