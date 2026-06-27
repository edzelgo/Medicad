import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      .from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id, role, status");
    const rolesByUser = new Map<string, { role: string; status: string }[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push({ role: r.role, status: r.status });
      rolesByUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
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
