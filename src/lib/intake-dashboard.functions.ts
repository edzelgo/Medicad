import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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