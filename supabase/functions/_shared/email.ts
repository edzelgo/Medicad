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

export function layout(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="color:#0b3d91;margin:0 0 16px;font-size:22px">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#64748b">Medicaid Success · Long-term care Medicaid planning</p>
  </div></body></html>`;
}