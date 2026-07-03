import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

const ACTIONS = [
  "login",
  "logout",
  "document.upload",
  "document.delete",
  "document.download",
  "packet.compress",
] as const;

const searchSchema = z.object({
  q: z.string().max(200).optional(),
  userId: z.string().uuid().optional(),
  email: z.string().max(255).optional(),
  action: z.enum(ACTIONS).optional(),
  ip: z.string().max(64).optional(),
  ua: z.string().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

function applyFilters(query: any, f: z.infer<typeof searchSchema>) {
  if (f.userId) query = query.eq("user_id", f.userId);
  if (f.action) query = query.eq("action", f.action);
  if (f.email) query = query.ilike("actor_email", `%${f.email}%`);
  if (f.ip) query = query.ilike("ip_address", `%${f.ip}%`);
  if (f.ua) query = query.ilike("user_agent", `%${f.ua}%`);
  if (f.from) query = query.gte("created_at", f.from);
  if (f.to) query = query.lte("created_at", f.to);
  if (f.q) {
    const s = f.q.replace(/[,%()]/g, " ");
    query = query.or(
      [
        `actor_email.ilike.%${s}%`,
        `resource.ilike.%${s}%`,
        `ip_address.ilike.%${s}%`,
        `user_agent.ilike.%${s}%`,
      ].join(","),
    );
  }
  return query;
}

export const AUDIT_ACTIONS = ACTIONS;
export type AuditFilter = z.infer<typeof searchSchema>;

export const adminSearchAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => searchSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, actor_email, action, resource, metadata, ip_address, user_agent, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    q = applyFilters(q, data);
    const { data: rows, count, error } = await q;
    if (error) {
      console.error("[audit.search]", error.message);
      throw new Error("Operation failed");
    }
    return { rows: rows ?? [], count: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const adminExportAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => searchSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, actor_email, action, resource, metadata, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);
    q = applyFilters(q, data);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[audit.export]", error.message);
      throw new Error("Operation failed");
    }
    const header = [
      "created_at","action","actor_email","user_id","ip_address","user_agent","resource","metadata",
    ];
    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      lines.push([
        r.created_at, r.action, r.actor_email, r.user_id, r.ip_address, r.user_agent, r.resource, r.metadata,
      ].map(escape).join(","));
    }
    return { csv: lines.join("\n"), rowCount: rows?.length ?? 0 };
  });