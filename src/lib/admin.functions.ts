import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeRequirementProgress } from "@/lib/medicaid-requirements";
import { z } from "zod";

export const APPLICATION_STAGES = [
  "new_lead",
  "documents_pending",
  "under_review",
  "submitted_to_medicaid",
  "approved",
  "denied",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];
export const APPLICATION_STAGE_LABEL: Record<ApplicationStage, string> = {
  new_lead: "New Lead",
  documents_pending: "Documents Pending",
  under_review: "Under Review",
  submitted_to_medicaid: "Submitted to Medicaid",
  approved: "Approved",
  denied: "Denied",
};

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
  if (!set.has("admin") && !set.has("agent")) throw new Error("Forbidden");
  return { isAdmin: set.has("admin") };
}

export const adminMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
    return { allowed: set.has("admin") || set.has("agent"), isAdmin: set.has("admin") };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .order("created_at", { ascending: false });

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id, role, status");
    const rolesByUser = new Map<string, { role: string; status: string }[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push({ role: r.role, status: r.status });
      rolesByUser.set(r.user_id, arr);
    }

    // Pull auth users (paginated) for email + last_sign_in_at
    const authByUser = new Map<string, { email: string | null; last_sign_in_at: string | null; banned_until: string | null }>();
    let page = 1;
    while (page < 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        authByUser.set(u.id, {
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          banned_until: (u as any).banned_until ?? null,
        });
      }
      if (data.users.length < 200) break;
      page++;
    }

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    // Pull all document filenames so admins can see per-user checklist progress.
    const { data: allDocs } = await supabaseAdmin
      .from("documents")
      .select("user_id, name");
    const docsByUser = new Map<string, string[]>();
    for (const d of allDocs ?? []) {
      const arr = docsByUser.get(d.user_id) ?? [];
      arr.push(d.name);
      docsByUser.set(d.user_id, arr);
    }

    return (profiles ?? []).map((p) => {
      const auth = authByUser.get(p.id);
      const isBanned = !!(auth?.banned_until && new Date(auth.banned_until) > new Date());
      const recentlyActive = auth?.last_sign_in_at && Date.now() - new Date(auth.last_sign_in_at).getTime() < THIRTY_DAYS;
      const status = isBanned ? "inactive" : recentlyActive ? "active" : "inactive";
      const filenames = docsByUser.get(p.id) ?? [];
      const progress = computeRequirementProgress(filenames);
      return {
        ...p,
        email: auth?.email ?? null,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        status,
        roles: rolesByUser.get(p.id) ?? [],
        document_count: filenames.length,
        progress,
      };
    });
  });

export const adminListDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("id, name, mime_type, size_bytes, storage_path, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = Array.from(new Set((docs ?? []).map((d) => d.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return (docs ?? []).map((d) => ({ ...d, owner_name: nameById.get(d.user_id) ?? null }));
  });

export const adminGetDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("documents").select("storage_path").eq("id", data.document_id).single();
    if (docErr || !doc) throw new Error("Document not found");
    const { data: signed, error } = await supabaseAdmin
      .storage.from("documents").createSignedUrl(doc.storage_path, 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Failed to sign URL");
    return { url: signed.signedUrl };
  });

// ============================================================================
// Client application pipeline
// ============================================================================

export const adminListApplicationPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only profiles of users with the "client" role appear on the application board.
    const { data: clientRoles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "client");
    const clientIds = (clientRoles ?? []).map((r) => r.user_id);
    if (!clientIds.length) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, application_status, assigned_agent_id, application_status_updated_at, created_at")
      .in("id", clientIds)
      .order("created_at", { ascending: false });

    const agentIds = Array.from(
      new Set((profiles ?? []).map((p) => p.assigned_agent_id).filter(Boolean) as string[]),
    );
    const agentNameById = new Map<string, string | null>();
    if (agentIds.length) {
      const { data: agents } = await supabaseAdmin
        .from("profiles").select("id, full_name").in("id", agentIds);
      for (const a of agents ?? []) agentNameById.set(a.id, a.full_name);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      application_status: p.application_status as ApplicationStage,
      assigned_agent_id: p.assigned_agent_id,
      assigned_agent_name: p.assigned_agent_id ? agentNameById.get(p.assigned_agent_id) ?? null : null,
      created_at: p.created_at,
      application_status_updated_at: p.application_status_updated_at,
    }));
  });

export const adminListAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id").in("role", ["admin", "agent"]);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (!ids.length) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, full_name").in("id", ids);
    return (profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }));
  });

export const adminUpdateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      profile_id: z.string().uuid(),
      application_status: z.enum(APPLICATION_STAGES),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        application_status: data.application_status,
        application_status_updated_at: new Date().toISOString(),
      })
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAssignAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      profile_id: z.string().uuid(),
      agent_id: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ assigned_agent_id: data.agent_id })
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
