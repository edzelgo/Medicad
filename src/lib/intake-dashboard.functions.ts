import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

export type IntakeCase = {
  id: string;
  case_id: string;
  case_pk: string;
  case_type: string;
  date_received: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  ref_source: string | null;
  marketer: string | null;
  notes_count: number;
  follow_up_date: string | null;
  follow_count: number;
  workflow: string | null;
  status: string | null;
  status_date: string | null;
  track_count: number;
  agent: string | null;
};

const filterSchema = z.object({
  q: z.string().optional(),
  workflow: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  agent: z.string().nullable().optional(),
  caseType: z.enum(["medicaid", "caregiver"]).nullable().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

function applyFilters(builder: any, f: z.infer<typeof filterSchema>) {
  if (f.workflow) builder = builder.eq("workflow", f.workflow);
  if (f.status) builder = builder.eq("status", f.status);
  if (f.agent) builder = builder.eq("agent", f.agent);
  if (f.caseType) builder = builder.eq("case_type", f.caseType);
  if (f.dateFrom) builder = builder.gte("date_received", f.dateFrom);
  if (f.dateTo) builder = builder.lte("date_received", f.dateTo);
  if (f.q && f.q.trim()) {
    const q = f.q.trim().replace(/[%,]/g, "");
    const p = `%${q}%`;
    builder = builder.or(
      `first_name.ilike.${p},last_name.ilike.${p},case_id.ilike.${p},status.ilike.${p},workflow.ilike.${p}`,
    );
  }
  return builder;
}

const listSchema = filterSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export type IntakeListResult = {
  rows: IntakeCase[];
  total: number;
  agents: string[];
  workflowStats: Record<string, Record<string, number>>;
  totalAll: number;
};

export const listIntakeCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<IntakeListResult> => {
    await assertStaff(context);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let builder = context.supabase
      .from("intake_case_view")
      .select("*", { count: "exact" })
      .order("date_received", { ascending: false, nullsFirst: false })
      .range(from, to);
    builder = applyFilters(builder, data);

    const { data: rows, error, count } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }

    // Aggregates scope to the selected case type (if any), lightweight columns only.
    let aggBuilder = context.supabase.from("intake_case_view").select("workflow,status,agent");
    if (data.caseType) aggBuilder = aggBuilder.eq("case_type", data.caseType);
    const { data: aggRows, error: aggErr } = await aggBuilder;
    if (aggErr) throw new Error(aggErr.message);

    const agentsSet = new Set<string>();
    const workflowStats: Record<string, Record<string, number>> = {};
    for (const r of aggRows ?? []) {
      if (r.agent) agentsSet.add(r.agent);
      const wf = r.workflow || "Unassigned";
      const st = r.status || "—";
      workflowStats[wf] = workflowStats[wf] ?? {};
      workflowStats[wf][st] = (workflowStats[wf][st] ?? 0) + 1;
    }

    return {
      rows: (rows ?? []) as IntakeCase[],
      total: count ?? 0,
      agents: Array.from(agentsSet).sort(),
      workflowStats,
      totalAll: (aggRows ?? []).length,
    };
  });

export const WORKFLOW_OPTIONS = [
  "OLD Medicaid Application",
  "New Medicaid Application",
  "Texas Application",
  "Pennsylvania Application",
  "CommCare",
] as const;

export const STATUS_OPTIONS = [
  "Workflow Created",
  "Intake Interview",
  "Gathering Documents",
  "Verifications Pending",
  "Application Pending",
  "Application Filed",
  "Minor Corrective Action",
  "Major Corrective Action",
  "Fair Hearing",
  "Application Approved",
  "Application Denied",
  "Pending",
] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  workflow: z.string().min(1).nullable().optional(),
  status: z.string().min(1).nullable().optional(),
  agent: z.string().nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
});

export const updateIntakeCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }): Promise<IntakeCase> => {
    await assertStaff(context);
    const patch: {
      workflow?: string | null;
      status?: string | null;
      status_date?: string;
      agent?: string | null;
      follow_up_date?: string | null;
    } = {};
    if (data.workflow !== undefined) patch.workflow = data.workflow;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.status_date = new Date().toISOString().slice(0, 10);
    }
    if (data.agent !== undefined) patch.agent = data.agent;
    if (data.follow_up_date !== undefined) patch.follow_up_date = data.follow_up_date;
    const { error } = await context.supabase
      .from("case_tracks")
      .update(patch)
      .eq("id", data.id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    const { data: row, error: viewErr } = await context.supabase
      .from("intake_case_view")
      .select("*")
      .eq("id", data.id)
      .single();
    if (viewErr) throw new Error(viewErr.message);
    return row as IntakeCase;
  });

export type IntakeCaseEvent = {
  id: string;
  case_id: string;
  actor_id: string | null;
  actor_email: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export const listIntakeCaseEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<IntakeCaseEvent[]> => {
    await assertStaff(context);
    const { data: rows, error } = await context.supabase
      .from("intake_case_events")
      .select("*")
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return (rows ?? []) as IntakeCaseEvent[];
  });

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  workflow: z.string().min(1).nullable().optional(),
  status: z.string().min(1).nullable().optional(),
});

export const bulkUpdateIntakeCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ updated: number }> => {
    await assertStaff(context);
    if (data.workflow === undefined && data.status === undefined) {
      throw new Error("Nothing to update");
    }
    const patch: {
      workflow?: string | null;
      status?: string | null;
      status_date?: string;
    } = {};
    if (data.workflow !== undefined) patch.workflow = data.workflow;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.status_date = new Date().toISOString().slice(0, 10);
    }
    const { error, count } = await context.supabase
      .from("case_tracks")
      .update(patch, { count: "exact" })
      .in("id", data.ids);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { updated: count ?? 0 };
  });

export type IntakeExportRow = IntakeCase & {
  last_change_at: string | null;
  last_change_field: string | null;
  last_change_from: string | null;
  last_change_to: string | null;
  last_change_by: string | null;
};

export const exportIntakeCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<IntakeExportRow[]> => {
    await assertStaff(context);
    let builder = context.supabase
      .from("intake_case_view")
      .select("*")
      .order("date_received", { ascending: false, nullsFirst: false })
      .limit(5000);
    builder = applyFilters(builder, data);
    const { data: rows, error } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    const cases = (rows ?? []) as IntakeCase[];
    if (!cases.length) return [];

    const ids = cases.map((c) => c.id);
    const { data: events, error: evErr } = await context.supabase
      .from("intake_case_events")
      .select("case_id,field,old_value,new_value,actor_email,created_at")
      .in("case_id", ids)
      .order("created_at", { ascending: false });
    if (evErr) throw new Error(evErr.message);

    const latest = new Map<string, any>();
    for (const ev of events ?? []) {
      if (!latest.has(ev.case_id)) latest.set(ev.case_id, ev);
    }

    return cases.map((c) => {
      const ev = latest.get(c.id);
      return {
        ...c,
        last_change_at: ev?.created_at ?? null,
        last_change_field: ev?.field ?? null,
        last_change_from: ev?.old_value ?? null,
        last_change_to: ev?.new_value ?? null,
        last_change_by: ev?.actor_email ?? null,
      };
    });
  });