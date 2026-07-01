import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
  if (!set.has("admin") && !set.has("agent")) throw new Error("Forbidden");
}

export type IntakeCase = {
  id: string;
  case_id: string;
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

export const listIntakeCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntakeCase[]> => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("intake_cases")
      .select("*")
      .order("date_received", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as IntakeCase[];
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
    const { data: row, error } = await context.supabase
      .from("intake_cases")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
    return (rows ?? []) as IntakeCaseEvent[];
  });