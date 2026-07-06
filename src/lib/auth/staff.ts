import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type StaffContext = { supabase: SupabaseClient<Database>; userId: string };

/** Throws unless the caller holds the admin or agent role. Use in every staff-only server fn. */
export async function assertStaff(context: StaffContext): Promise<{ isAdmin: boolean }> {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("status", "approved");
  const set = new Set((roles ?? []).map((r) => r.role));
  if (!set.has("admin") && !set.has("agent")) throw new Error("Forbidden");
  return { isAdmin: set.has("admin") };
}

export async function getStaffAccess(context: StaffContext): Promise<{ allowed: boolean; isAdmin: boolean }> {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("status", "approved");
  const set = new Set((roles ?? []).map((r) => r.role));
  return { allowed: set.has("admin") || set.has("agent"), isAdmin: set.has("admin") };
}

/** Admin / agent / referral — anyone allowed to onboard a new client. */
export async function assertOnboarder(context: StaffContext): Promise<{ role: "admin" | "agent" | "referral" }> {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("status", "approved");
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("admin")) return { role: "admin" };
  if (set.has("agent")) return { role: "agent" };
  if (set.has("referral")) return { role: "referral" };
  throw new Error("Forbidden");
}

export async function getOnboarderAccess(context: StaffContext): Promise<{ allowed: boolean; role: "admin" | "agent" | "referral" | null }> {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("status", "approved");
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("admin")) return { allowed: true, role: "admin" };
  if (set.has("agent")) return { allowed: true, role: "agent" };
  if (set.has("referral")) return { allowed: true, role: "referral" };
  return { allowed: false, role: null };
}
