import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeRequirementProgress } from "@/lib/medicaid-requirements";

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
