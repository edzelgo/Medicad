import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { computeRequirementProgress } from "@/lib/medicaid-requirements";

/**
 * Group C #30 — email every client with an incomplete document checklist a
 * reminder listing what's still missing. Staff-triggered here; the same
 * handler can be wired to a scheduled job later. Returns a summary.
 */
export const sendMissingDocReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Only admins can send bulk reminders.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const notify = await import("@/lib/notify.server");

    // Client user ids.
    const { data: clientRoles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "client");
    const clientIds = Array.from(new Set((clientRoles ?? []).map((r) => r.user_id)));
    if (!clientIds.length) return { sent: 0, skipped: 0, complete: 0 };

    // Documents grouped by user.
    const { data: docs } = await supabaseAdmin
      .from("documents").select("user_id, name").in("user_id", clientIds);
    const byUser = new Map<string, string[]>();
    for (const d of docs ?? []) {
      const arr = byUser.get(d.user_id) ?? [];
      arr.push(d.name);
      byUser.set(d.user_id, arr);
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, full_name").in("id", clientIds);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    let sent = 0, skipped = 0, complete = 0;
    for (const id of clientIds) {
      const progress = computeRequirementProgress(byUser.get(id) ?? []);
      if (progress.missing.length === 0) { complete++; continue; }
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      const email = u?.user?.email;
      if (!email) { skipped++; continue; }
      const ok = await notify.sendEmail(
        [email],
        `Action needed: ${progress.missing.length} document${progress.missing.length === 1 ? "" : "s"} still needed`,
        notify.brandedEmailHtml({
          heading: "Documents still needed",
          bodyLines: [
            `Hi ${nameById.get(id) ?? "there"},`,
            `We still need ${progress.missing.length} item${progress.missing.length === 1 ? "" : "s"} to move your Medicaid application forward:`,
            ...progress.missing.map((m) => `• ${m}`),
            "You can upload them anytime from your portal.",
          ],
          ctaLabel: "Upload documents",
          ctaUrl: `${notify.getSiteUrl()}/portal`,
        }),
      );
      await notify.logComm({
        channel: "email", kind: "doc_reminder", recipient: email,
        subject: "Documents still needed",
        bodyPreview: `${progress.missing.length} missing`, success: ok, createdBy: context.userId,
      });
      if (ok) sent++; else skipped++;
    }
    return { sent, skipped, complete };
  });

/**
 * Group C #31 — email the requesting admin a digest of overdue follow-ups so
 * nothing slips. (Agents are free-text on tracks today, so the digest routes
 * to the admin who triggers it; per-agent routing comes with the agent-ref
 * migration.)
 */
export const sendFollowUpDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Only admins can send the follow-up digest.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const notify = await import("@/lib/notify.server");

    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await context.supabase
      .from("intake_case_view")
      .select("case_id, first_name, last_name, follow_up_date, workflow, status, agent")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", today)
      .not("status", "in", '("Application Approved","Application Denied")')
      .order("follow_up_date", { ascending: true })
      .limit(200);

    const overdue = rows ?? [];
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = u?.user?.email;
    if (!email) throw new Error("No email on file for your account.");
    if (!overdue.length) {
      return { count: 0, emailed: false };
    }

    const lines = overdue.map((r) =>
      `• ${r.last_name ?? ""}, ${r.first_name ?? ""} — ${r.status ?? "—"} (due ${r.follow_up_date}${r.agent ? `, ${r.agent}` : ""})`,
    );
    const ok = await notify.sendEmail(
      [email],
      `${overdue.length} overdue follow-up${overdue.length === 1 ? "" : "s"}`,
      notify.brandedEmailHtml({
        heading: "Overdue follow-ups",
        bodyLines: [
          `You have ${overdue.length} case${overdue.length === 1 ? "" : "s"} with a follow-up date on or before today:`,
          ...lines,
        ],
        ctaLabel: "Open intake dashboard",
        ctaUrl: `${notify.getSiteUrl()}/crm/intake-dashboard`,
      }),
    );
    await notify.logComm({
      channel: "email", kind: "followup_digest", recipient: email,
      subject: "Overdue follow-ups", bodyPreview: `${overdue.length} overdue`,
      success: ok, createdBy: context.userId,
    });
    return { count: overdue.length, emailed: ok };
  });
