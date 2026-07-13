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

export const LEAD_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const listLeadsSchema = z.object({
  q: z.string().trim().max(200).optional(),
  stage: stageEnum.optional(),
  source: z.string().trim().max(150).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listLeadsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const from = (data.page - 1) * data.pageSize;
    let builder = context.supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + data.pageSize - 1);
    if (data.stage) builder = builder.eq("stage", data.stage);
    if (data.source) builder = builder.eq("source", data.source);
    // priority column exists only after the migration; ignore the filter if not.
    if (data.priority) builder = (builder as any).eq("priority", data.priority);
    if (data.q) {
      const p = `%${data.q.replace(/[%,]/g, "")}%`;
      builder = builder.or(
        `full_name.ilike.${p},first_name.ilike.${p},last_name.ilike.${p},email.ilike.${p},phone.ilike.${p},state.ilike.${p}`,
      );
    }
    const { data: rows, error, count } = await builder;
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }

    // Distinct sources for the filter dropdown (lightweight column scan).
    const { data: sourceRows } = await context.supabase
      .from("leads").select("source").not("source", "is", null).limit(2000);
    const sources = Array.from(new Set((sourceRows ?? []).map((r) => r.source).filter(Boolean))) as string[];

    return { rows: rows ?? [], total: count ?? 0, sources: sources.sort() };
  });

/**
 * Possible duplicates of an intake: same email, same phone, or same
 * first+last name. Used to warn staff before/after creating a lead.
 */
async function findPossibleDuplicates(
  supabase: Parameters<typeof assertStaff>[0]["supabase"],
  probe: { email?: string | null; phone?: string | null; first_name?: string; last_name?: string },
  excludeId?: string,
) {
  const clauses: string[] = [];
  const clean = (s: string) => s.replace(/[%,()]/g, "");
  if (probe.email) clauses.push(`email.ilike.${clean(probe.email)}`);
  if (probe.phone) clauses.push(`phone.eq.${clean(probe.phone)}`);
  if (probe.first_name && probe.last_name) {
    clauses.push(`and(first_name.ilike.${clean(probe.first_name)},last_name.ilike.${clean(probe.last_name)})`);
  }
  if (!clauses.length) return [];
  let builder = supabase
    .from("leads")
    .select("id, full_name, first_name, last_name, email, phone, stage, created_at")
    .or(clauses.join(","))
    .order("created_at", { ascending: false })
    .limit(5);
  if (excludeId) builder = builder.neq("id", excludeId);
  const { data } = await builder;
  return data ?? [];
}

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

    const possibleDuplicates = await findPossibleDuplicates(context.supabase, {
      email: data.email, phone: data.phone,
      first_name: data.first_name, last_name: data.last_name,
    });

    const { data: row, error } = await context.supabase
      .from("leads").insert(payload as never).select().single();
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    await context.supabase.from("activities").insert({
      lead_id: row.id, type: "intake", content: "Intake submitted.", created_by: context.userId,
    });
    if (possibleDuplicates.length) {
      await context.supabase.from("activities").insert({
        lead_id: row.id,
        type: "system",
        content: `Possible duplicate of: ${possibleDuplicates
          .map((d) => d.full_name || `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || d.id.slice(0, 8))
          .join(", ")}`,
        created_by: context.userId,
      });
    }
    return { ...row, possibleDuplicates };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), patch: leadInputSchema.partial().extend({ stage: stageEnum.optional(), assigned_to: z.string().uuid().nullable().optional() }) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const patch = cleanLead(data.patch as never);
    if (data.patch.stage) patch.stage = data.patch.stage;
    if (data.patch.assigned_to !== undefined) patch.assigned_to = data.patch.assigned_to;

    const needsPrev = !!data.patch.stage || data.patch.assigned_to !== undefined;
    let prev: {
      stage: string; assigned_to: string | null; first_name: string | null; full_name: string | null;
      email: string | null; phone: string | null; sms_consent: boolean;
    } | null = null;
    if (needsPrev) {
      const { data: prevRow } = await context.supabase
        .from("leads")
        .select("stage, assigned_to, first_name, full_name, email, phone, sms_consent")
        .eq("id", data.id).maybeSingle();
      prev = prevRow ?? null;
    }
    const prevStage = prev?.stage;

    const { error } = await context.supabase
      .from("leads").update(patch as never).eq("id", data.id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }

    const stageChanged = !!data.patch.stage && prevStage !== data.patch.stage;
    if (stageChanged) {
      await context.supabase.from("activities").insert({
        lead_id: data.id,
        type: "stage_change",
        content: `Stage changed${prevStage ? ` from ${prevStage}` : ""} to ${data.patch.stage}.`,
        created_by: context.userId,
      });
    }

    // Notifications are best-effort — never fail the update because of them.
    try {
      const notify = await import("@/lib/notify.server");
      if (stageChanged && prev) {
        await notify.notifyLeadStageChange({
          firstName: prev.first_name,
          email: prev.email,
          phone: prev.phone,
          smsConsent: !!prev.sms_consent,
          stage: data.patch.stage!,
          leadId: data.id,
          actorId: context.userId,
        });
      }
      const newAgent = data.patch.assigned_to;
      if (newAgent && newAgent !== prev?.assigned_to && newAgent !== context.userId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: agentUser } = await supabaseAdmin.auth.admin.getUserById(newAgent);
        const { data: agentProfile } = await supabaseAdmin
          .from("profiles").select("full_name").eq("id", newAgent).maybeSingle();
        if (agentUser?.user?.email) {
          await notify.notifyLeadAssigned({
            agentEmail: agentUser.user.email,
            agentName: agentProfile?.full_name ?? null,
            leadName: prev?.full_name || prev?.first_name || "New lead",
            leadId: data.id,
            actorId: context.userId,
          });
        }
      }
    } catch (e) {
      console.error("[notify]", e instanceof Error ? e.message : e);
    }

    return { ok: true };
  });

/**
 * Set a lead's priority (Group D #44). Isolated from updateLead so that a
 * missing `priority` column (migration not yet applied) surfaces a friendly
 * message instead of breaking the main save path.
 */
export const setLeadPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    priority: z.enum(LEAD_PRIORITIES),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await (context.supabase.from("leads") as any)
      .update({ priority: data.priority }).eq("id", data.id);
    if (error) {
      console.error("[db]", error.message);
      if (/column .*priority.* does not exist/i.test(error.message)) {
        throw new Error("Priority isn't available yet — apply the pending migration via Lovable first.");
      }
      throw new Error("Operation failed. Please try again.");
    }
    return { ok: true };
  });

/**
 * Linked client portal account for a lead (Group D #41) + their Medicaid
 * document-checklist progress. Returns { linked: false } when the lead has no
 * client_user_id (or the column doesn't exist yet).
 */
export const getLeadClientProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: lead } = await context.supabase
      .from("leads").select("*").eq("id", data.id).maybeSingle();
    const clientUserId = (lead as { client_user_id?: string | null } | null)?.client_user_id ?? null;
    if (!clientUserId) return { linked: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeRequirementProgress } = await import("@/lib/medicaid-requirements");
    const { data: docs } = await supabaseAdmin
      .from("documents").select("name").eq("user_id", clientUserId);
    const progress = computeRequirementProgress((docs ?? []).map((d) => d.name));
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(clientUserId);
    return {
      linked: true as const,
      clientUserId,
      email: u?.user?.email ?? null,
      progress,
    };
  });

/** Possible duplicates of an existing lead (Group D #49), for the merge tool. */
export const listLeadDuplicates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: lead } = await context.supabase
      .from("leads").select("id, email, phone, first_name, last_name").eq("id", data.id).maybeSingle();
    if (!lead) return [];
    return findPossibleDuplicates(context.supabase, {
      email: lead.email, phone: lead.phone,
      first_name: lead.first_name ?? undefined, last_name: lead.last_name ?? undefined,
    }, data.id);
  });

/**
 * Merge a duplicate lead into a primary (Group D #49). Moves activities to the
 * primary, backfills any empty primary fields from the duplicate, then deletes
 * the duplicate. Admin-only and non-reversible, so guarded on the client too.
 */
export const mergeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    primary_id: z.string().uuid(),
    duplicate_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Only admins can merge leads.");
    if (data.primary_id === data.duplicate_id) throw new Error("Cannot merge a lead into itself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: primary } = await supabaseAdmin.from("leads").select("*").eq("id", data.primary_id).maybeSingle();
    const { data: dup } = await supabaseAdmin.from("leads").select("*").eq("id", data.duplicate_id).maybeSingle();
    if (!primary || !dup) throw new Error("Lead not found.");

    // Backfill empty primary fields from the duplicate (never overwrite existing).
    const patch: Record<string, unknown> = {};
    const skip = new Set(["id", "created_at", "created_by", "full_name"]);
    for (const [k, v] of Object.entries(dup as Record<string, unknown>)) {
      if (skip.has(k)) continue;
      const cur = (primary as Record<string, unknown>)[k];
      if ((cur === null || cur === undefined || cur === "") && v !== null && v !== undefined && v !== "") {
        patch[k] = v;
      }
    }
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("leads").update(patch as never).eq("id", data.primary_id);
    }

    // Move activities, then log the merge on the primary.
    await supabaseAdmin.from("activities").update({ lead_id: data.primary_id } as never).eq("lead_id", data.duplicate_id);
    await supabaseAdmin.from("activities").insert({
      lead_id: data.primary_id,
      type: "system",
      content: `Merged duplicate lead "${(dup.full_name ?? `${dup.first_name ?? ""} ${dup.last_name ?? ""}`.trim()) || dup.id.slice(0, 8)}" into this record.`,
      created_by: context.userId,
    } as never);

    const { error: delErr } = await supabaseAdmin.from("leads").delete().eq("id", data.duplicate_id);
    if (delErr) { console.error("[db]", delErr.message); throw new Error("Merge failed while removing the duplicate."); }
    return { ok: true, backfilled: Object.keys(patch).length };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Only admins can delete leads.");
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