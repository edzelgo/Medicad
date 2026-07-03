import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

const TERMINAL_STATUSES = ["Application Approved", "Application Denied"];

const dateRangeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  refSource: z.string().nullable().optional(),
  marketer: z.string().nullable().optional(),
  caseType: z.enum(["medicaid", "caregiver"]).nullable().optional(),
});

/** Referrals report: cases received in a date range, grouped by referral source/marketer. */
export const reportReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateRangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    let builder = context.supabase
      .from("intake_case_view")
      .select("id,case_id,first_name,last_name,date_received,ref_source,marketer,workflow,status,case_type")
      .order("date_received", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (data.dateFrom) builder = builder.gte("date_received", data.dateFrom);
    if (data.dateTo) builder = builder.lte("date_received", data.dateTo);
    if (data.refSource) builder = builder.eq("ref_source", data.refSource);
    if (data.marketer) builder = builder.eq("marketer", data.marketer);
    if (data.caseType) builder = builder.eq("case_type", data.caseType);
    const { data: rows, error } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }

    const byMarketer: Record<string, number> = {};
    for (const r of rows ?? []) {
      const key = r.marketer || "Unassigned";
      byMarketer[key] = (byMarketer[key] ?? 0) + 1;
    }
    return { rows: rows ?? [], total: rows?.length ?? 0, byMarketer };
  });

/** On Service report: tracks currently in progress (not approved/denied). */
export const reportOnService = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateRangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    let builder = context.supabase
      .from("intake_case_view")
      .select("id,case_id,first_name,last_name,date_received,workflow,status,agent,case_type")
      .not("status", "in", `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(",")})`)
      .order("date_received", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (data.dateFrom) builder = builder.gte("date_received", data.dateFrom);
    if (data.dateTo) builder = builder.lte("date_received", data.dateTo);
    if (data.caseType) builder = builder.eq("case_type", data.caseType);
    const { data: rows, error } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { rows: rows ?? [], total: rows?.length ?? 0 };
  });

/** Active Tracks report: counts by workflow + status, excluding terminal statuses. */
export const reportActiveTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateRangeSchema.pick({ caseType: true }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    let builder = context.supabase
      .from("intake_case_view")
      .select("workflow,status")
      .not("status", "in", `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(",")})`);
    if (data.caseType) builder = builder.eq("case_type", data.caseType);
    const { data: rows, error } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    const stats: Record<string, Record<string, number>> = {};
    for (const r of rows ?? []) {
      const wf = r.workflow || "Unassigned";
      const st = r.status || "—";
      stats[wf] = stats[wf] ?? {};
      stats[wf][st] = (stats[wf][st] ?? 0) + 1;
    }
    return { stats, total: rows?.length ?? 0 };
  });

/** Follow Up report: tracks with a follow-up date, flagging overdue ones. */
export const reportFollowUp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateRangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    let builder = context.supabase
      .from("intake_case_view")
      .select("id,case_id,first_name,last_name,follow_up_date,follow_count,workflow,status,agent,case_type")
      .not("follow_up_date", "is", null)
      .order("follow_up_date", { ascending: true })
      .limit(1000);
    if (data.dateFrom) builder = builder.gte("follow_up_date", data.dateFrom);
    if (data.dateTo) builder = builder.lte("follow_up_date", data.dateTo);
    if (data.caseType) builder = builder.eq("case_type", data.caseType);
    const { data: rows, error } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    const today = new Date().toISOString().slice(0, 10);
    const withOverdue = (rows ?? []).map((r) => ({ ...r, overdue: !!r.follow_up_date && r.follow_up_date < today }));
    return { rows: withOverdue, total: withOverdue.length, overdueCount: withOverdue.filter((r) => r.overdue).length };
  });

/** Activity Log report: a global feed of case_tracks changes across all cases. */
export const reportActivityLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dateRangeSchema.pick({ dateFrom: true, dateTo: true }).extend({
    limit: z.number().int().min(1).max(500).default(200),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    let builder = context.supabase
      .from("intake_case_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.dateFrom) builder = builder.gte("created_at", data.dateFrom);
    if (data.dateTo) builder = builder.lte("created_at", data.dateTo);
    const { data: events, error } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }

    const trackIds = Array.from(new Set((events ?? []).map((e) => e.case_id)));
    const { data: rows } = trackIds.length
      ? await context.supabase.from("intake_case_view").select("id,case_id,first_name,last_name").in("id", trackIds)
      : { data: [] };
    const nameByTrack = new Map((rows ?? []).map((r) => [r.id, `${r.last_name ?? ""}, ${r.first_name ?? ""}`.trim()]));

    return (events ?? []).map((e) => ({ ...e, case_name: nameByTrack.get(e.case_id) ?? "—" }));
  });
