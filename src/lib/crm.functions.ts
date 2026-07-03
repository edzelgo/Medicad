import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";

const stageEnum = z.enum([
  "new", "intake", "screening", "application", "submitted", "approved", "denied", "closed",
]);

const leadInputSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  middle_initial: z.string().trim().max(5).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  state: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  zip: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  dob: z.string().optional().nullable().or(z.literal("")),
  ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  source: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  referral_status: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  veteran_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  marital_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  spouse_first_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_last_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_dob: z.string().optional().nullable().or(z.literal("")),
  spouse_ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  has_lri: z.boolean().optional(),
  lri_first_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  lri_last_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  lri_phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  lri_email: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  lri_status: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spend_down_completed: z.boolean().optional().nullable(),
  transferred_resources_60mo: z.boolean().optional().nullable(),
  transfer_amount: z.number().optional().nullable(),
  retroactive_required: z.boolean().optional().nullable(),
  date_first_coverage: z.string().optional().nullable().or(z.literal("")),
  estimated_spend_down_remaining: z.number().optional().nullable(),
  brochure_provided: z.array(z.string()).optional(),
  household_size: z.number().int().optional().nullable(),
  monthly_income: z.number().optional().nullable(),
  notes: z.string().max(10000).optional().nullable().or(z.literal("")),
});

function cleanLead(input: z.infer<typeof leadInputSchema>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return data ?? [];
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: lead, error } = await context.supabase
      .from("leads").select("*").eq("id", data.id).maybeSingle();
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    if (!lead) throw new Error("Lead not found");
    const { data: activities } = await context.supabase
      .from("activities").select("*").eq("lead_id", data.id).order("created_at", { ascending: false });
    return { lead, activities: activities ?? [] };
  });

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const payload = cleanLead(data);
    payload.created_by = context.userId;
    payload.assigned_to = context.userId;
    payload.full_name = `${data.first_name} ${data.last_name}`.trim();
    payload.source = (payload.source as string | undefined) ?? "manual";
    const { data: row, error } = await context.supabase
      .from("leads").insert(payload as never).select().single();
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    await context.supabase.from("activities").insert({
      lead_id: row.id, type: "intake", content: "Intake submitted.", created_by: context.userId,
    });
    return row;
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), patch: leadInputSchema.partial().extend({ stage: stageEnum.optional(), assigned_to: z.string().uuid().nullable().optional() }) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const patch = cleanLead(data.patch as never);
    if (data.patch.stage) patch.stage = data.patch.stage;
    if (data.patch.assigned_to !== undefined) patch.assigned_to = data.patch.assigned_to;
    let prevStage: string | undefined;
    if (data.patch.stage) {
      const { data: prev } = await context.supabase
        .from("leads").select("stage").eq("id", data.id).maybeSingle();
      prevStage = prev?.stage;
    }
    const { error } = await context.supabase
      .from("leads").update(patch as never).eq("id", data.id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    if (data.patch.stage && prevStage !== data.patch.stage) {
      await context.supabase.from("activities").insert({
        lead_id: data.id,
        type: "stage_change",
        content: `Stage changed${prevStage ? ` from ${prevStage}` : ""} to ${data.patch.stage}.`,
        created_by: context.userId,
      });
    }
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

export const addActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lead_id: z.string().uuid(),
    content: z.string().trim().min(1).max(5000),
    type: z.string().max(40).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("activities").insert({
      lead_id: data.lead_id,
      content: data.content,
      type: data.type ?? "note",
      created_by: context.userId,
    });
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data: leads } = await context.supabase.from("leads").select("id, stage, full_name, first_name, last_name, email, created_at").order("created_at", { ascending: false }).limit(100);
    const stageCounts: Record<string, number> = {};
    for (const l of leads ?? []) stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1;
    const { data: activities } = await context.supabase.from("activities").select("id, lead_id, type, content, created_at").order("created_at", { ascending: false }).limit(20);
    return { stageCounts, recentLeads: (leads ?? []).slice(0, 8), recentActivities: activities ?? [] };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data: roles, error } = await context.supabase
      .from("user_roles").select("user_id, role, status");
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const { data: profiles } = await context.supabase
      .from("profiles").select("id, full_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byUser = new Map<string, { id: string; full_name: string | null; roles: string[]; status: string }>();
    for (const r of roles ?? []) {
      const p = profiles?.find((x) => x.id === r.user_id);
      const existing = byUser.get(r.user_id) ?? { id: r.user_id, full_name: p?.full_name ?? null, roles: [], status: r.status };
      existing.roles.push(r.role);
      byUser.set(r.user_id, existing);
    }
    return Array.from(byUser.values());
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    role: z.enum(["admin", "agent", "marketer", "client", "referral"]),
    status: z.enum(["approved", "pending"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").upsert({
      user_id: data.user_id, role: data.role, status: data.status ?? "approved",
    }, { onConflict: "user_id,role" });
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

export const revokeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    role: z.enum(["admin", "agent", "marketer", "client", "referral"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role, status").eq("user_id", context.userId);
    return { roles: (data ?? []).map((r) => r.role), isAdmin: (data ?? []).some((r) => r.role === "admin") };
  });