// Server-only notification helpers: branded email via Resend and SMS via
// Twilio. Both are env-gated no-ops when keys are missing, and every send is
// wrapped so a notification failure never breaks the operation that fired it.
//
// Env:
//   RESEND_API_KEY      — enables email (already used by eligibility emails)
//   EMAIL_FROM          — branded sender, e.g. "Medicaid Success <notify@medicaidsuccess.com>"
//   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM — enables SMS
//   SITE_URL            — absolute base URL used in email/SMS links

export function getSiteUrl() {
  return process.env.SITE_URL ?? "https://medicaidsuccess.com";
}

type CommKind = "stage_change" | "assignment" | "doc_reminder" | "followup_digest" | "manual";

/**
 * Record a sent (or attempted) communication for audit + per-lead history.
 * Best-effort: a missing communications_log table (migration not applied yet)
 * or any insert error is swallowed so it never affects the caller.
 */
export async function logComm(entry: {
  channel: "email" | "sms";
  kind: CommKind;
  recipient: string;
  subject?: string | null;
  bodyPreview?: string | null;
  success: boolean;
  error?: string | null;
  leadId?: string | null;
  createdBy?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin.from as (t: string) => any)("communications_log").insert({
      channel: entry.channel,
      kind: entry.kind,
      recipient: entry.recipient,
      subject: entry.subject ?? null,
      body_preview: entry.bodyPreview ? entry.bodyPreview.slice(0, 300) : null,
      success: entry.success,
      error: entry.error ?? null,
      lead_id: entry.leadId ?? null,
      created_by: entry.createdBy ?? null,
    });
  } catch (err) {
    console.error("[notify:log]", err instanceof Error ? err.message : err);
  }
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const NAVY = "#0b3d91";

/** Small branded shell matching the eligibility email styling. */
export function brandedEmailHtml(opts: {
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const body = opts.bodyLines.map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join("");
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<div style="margin:22px 0 6px">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:${NAVY};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${escapeHtml(opts.ctaLabel)}</a>
      </div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f7fc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:${NAVY};color:#fff;padding:22px 28px">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Medicaid Success</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">${escapeHtml(opts.heading)}</div>
      </div>
      <div style="padding:26px 28px;font-size:15px;line-height:1.6">
        ${body}
        ${cta}
        <p style="margin:18px 0 0;color:#64748b;font-size:13px">This is an automated notification from Medicaid Success.</p>
      </div>
    </div></body></html>`;
}

/** Send an email via Resend. No-op when RESEND_API_KEY is unset. Never throws. */
export async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const recipients = to.filter(Boolean);
  if (!key || recipients.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Medicaid Success <onboarding@resend.dev>",
        to: recipients, subject, html,
      }),
    });
    if (!res.ok) console.error("[notify:email]", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[notify:email]", err);
    return false;
  }
}

/**
 * Send an SMS via Twilio's REST API. No-op when Twilio env vars are unset.
 * Callers are responsible for checking consent before calling. Never throws.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from || !to) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    if (!res.ok) console.error("[notify:sms]", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[notify:sms]", err);
    return false;
  }
}

const STAGE_LABEL: Record<string, string> = {
  new: "Received", intake: "Intake", screening: "Screening", application: "Application in Progress",
  submitted: "Submitted", approved: "Approved", denied: "Denied", closed: "Closed",
};

/**
 * Notify a lead's contact that their application stage changed.
 * Email includes the friendly stage label; SMS (consent-gated by the caller
 * passing smsConsent) is a generic PHI-free nudge.
 */
export async function notifyLeadStageChange(opts: {
  firstName: string | null;
  email: string | null;
  phone: string | null;
  smsConsent: boolean;
  stage: string;
  leadId?: string | null;
  actorId?: string | null;
}) {
  const label = STAGE_LABEL[opts.stage] ?? opts.stage;
  const portalUrl = `${getSiteUrl()}/portal`;
  if (opts.email) {
    const subject = `Your application status: ${label}`;
    const ok = await sendEmail(
      [opts.email],
      subject,
      brandedEmailHtml({
        heading: "Application status update",
        bodyLines: [
          `Hi ${opts.firstName ?? "there"},`,
          `Your Medicaid application status is now: ${label}.`,
          "Log in to your portal for details and any next steps.",
        ],
        ctaLabel: "Open my portal",
        ctaUrl: portalUrl,
      }),
    );
    await logComm({
      channel: "email", kind: "stage_change", recipient: opts.email, subject,
      bodyPreview: `Status is now: ${label}`, success: ok, leadId: opts.leadId, createdBy: opts.actorId,
    });
  }
  if (opts.smsConsent && opts.phone) {
    const body = `Medicaid Success: your application status was updated. Log in to your portal for details: ${portalUrl}. Reply STOP to opt out.`;
    const ok = await sendSms(opts.phone, body);
    await logComm({
      channel: "sms", kind: "stage_change", recipient: opts.phone,
      bodyPreview: body, success: ok, leadId: opts.leadId, createdBy: opts.actorId,
    });
  }
}

/** Notify a staff member that a lead was assigned to them. */
export async function notifyLeadAssigned(opts: {
  agentEmail: string;
  agentName: string | null;
  leadName: string;
  leadId: string;
  actorId?: string | null;
}) {
  const subject = `New lead assigned: ${opts.leadName}`;
  const ok = await sendEmail(
    [opts.agentEmail],
    subject,
    brandedEmailHtml({
      heading: "A lead was assigned to you",
      bodyLines: [
        `Hi ${opts.agentName ?? "there"},`,
        `${opts.leadName} has been assigned to you in the CRM.`,
        "Please review the intake details and schedule a follow-up.",
      ],
      ctaLabel: "Open lead",
      ctaUrl: `${getSiteUrl()}/crm/leads/${opts.leadId}`,
    }),
  );
  await logComm({
    channel: "email", kind: "assignment", recipient: opts.agentEmail, subject,
    bodyPreview: `${opts.leadName} assigned`, success: ok, leadId: opts.leadId, createdBy: opts.actorId,
  });
}
