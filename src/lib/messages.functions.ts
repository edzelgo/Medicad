import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStaffAccess } from "@/lib/auth/staff";
import { z } from "zod";

// Tables aren't in the generated Database types until the next Lovable type
// sync — access them untyped until then.
function tbl(client: unknown, name: string) {
  return ((client as { from: (t: string) => any }).from)(name);
}

function supportThread(clientUserId: string) {
  return `support:${clientUserId}`;
}
function dmThread(a: string, b: string) {
  return `dm:${[a, b].sort().join(":")}`;
}
/** The other participant of a dm:{a}:{b} thread, from the caller's POV. */
function dmOther(threadId: string, me: string): string | null {
  if (!threadId.startsWith("dm:")) return null;
  const [a, b] = threadId.slice(3).split(":");
  return a === me ? b : a;
}

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mine: boolean;
};

export type ThreadSummary = {
  thread_id: string;
  other_id: string;      // client user id (support) or the other staffer (dm)
  name: string | null;
  email: string | null;
  last_body: string;
  last_at: string;
  unread: number;
};

async function isStaff(context: { supabase: any; userId: string }) {
  const { allowed } = await getStaffAccess(context);
  return allowed;
}

async function markRead(admin: unknown, threadId: string, userId: string) {
  await tbl(admin, "message_reads").upsert(
    { thread_id: threadId, user_id: userId, last_read_at: new Date().toISOString() },
    { onConflict: "thread_id,user_id" },
  );
}

// ---------------------------------------------------------------------------
// Client support (C39) — a client's single thread with staff.
// ---------------------------------------------------------------------------

export const getMyThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ available: boolean; messages: ChatMessage[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = supportThread(context.userId);
    const { data, error } = await tbl(supabaseAdmin, "messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(500) as { data: any[] | null; error: any };
    if (error) return { available: false, messages: [] };
    await markRead(supabaseAdmin, threadId, context.userId);
    return {
      available: true,
      messages: (data ?? []).map((m) => ({ ...m, mine: m.sender_id === context.userId })),
    };
  });

export const sendMyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ body: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = supportThread(context.userId);
    const { error } = await tbl(supabaseAdmin, "messages")
      .insert({ thread_id: threadId, sender_id: context.userId, body: data.body });
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Messaging isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to send message.");
    }
    await markRead(supabaseAdmin, threadId, context.userId);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Staff side of client support (C39).
// ---------------------------------------------------------------------------

export const listSupportThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ available: boolean; threads: ThreadSummary[] }> => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msgs, error } = await tbl(supabaseAdmin, "messages")
      .select("thread_id, sender_id, body, created_at")
      .like("thread_id", "support:%")
      .order("created_at", { ascending: false })
      .limit(2000) as { data: any[] | null; error: any };
    if (error) return { available: false, threads: [] };

    const { data: reads } = await tbl(supabaseAdmin, "message_reads")
      .select("thread_id, last_read_at")
      .eq("user_id", context.userId) as { data: any[] | null };
    const readAt = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));

    const byThread = new Map<string, { last: any; unread: number }>();
    for (const m of msgs ?? []) {
      const entry = byThread.get(m.thread_id) ?? { last: m, unread: 0 };
      // messages come newest-first, so the first seen per thread is the latest.
      const lastRead = readAt.get(m.thread_id);
      const isUnread = m.sender_id !== context.userId && (!lastRead || m.created_at > lastRead);
      if (isUnread) entry.unread++;
      byThread.set(m.thread_id, entry);
    }

    const clientIds = Array.from(byThread.keys()).map((t) => t.slice("support:".length));
    const { data: profiles } = clientIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", clientIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    const threads: ThreadSummary[] = Array.from(byThread.entries()).map(([thread_id, v]) => {
      const other_id = thread_id.slice("support:".length);
      return {
        thread_id, other_id,
        name: nameById.get(other_id) ?? null, email: null,
        last_body: v.last.body, last_at: v.last.created_at, unread: v.unread,
      };
    }).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    return { available: true, threads };
  });

export const getSupportThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ client_user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ChatMessage[]> => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = supportThread(data.client_user_id);
    const { data: msgs, error } = await tbl(supabaseAdmin, "messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(500) as { data: any[] | null; error: any };
    if (error) return [];
    await markRead(supabaseAdmin, threadId, context.userId);
    return (msgs ?? []).map((m) => ({ ...m, mine: m.sender_id === context.userId }));
  });

export const staffReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    client_user_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = supportThread(data.client_user_id);
    const { error } = await tbl(supabaseAdmin, "messages")
      .insert({ thread_id: threadId, sender_id: context.userId, body: data.body });
    if (error) throw new Error("Failed to send reply.");
    await markRead(supabaseAdmin, threadId, context.userId);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Staff direct messages (C32).
// ---------------------------------------------------------------------------

export const listDmContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string | null }[]> => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id").in("role", ["admin", "agent", "marketer"]);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id))).filter((id) => id !== context.userId);
    if (!ids.length) return [];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
    return (profiles ?? []).map((p: any) => ({ id: p.id, name: p.full_name }));
  });

export const listDmThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ available: boolean; threads: ThreadSummary[] }> => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msgs, error } = await tbl(supabaseAdmin, "messages")
      .select("thread_id, sender_id, body, created_at")
      .like("thread_id", `dm:%`)
      .order("created_at", { ascending: false })
      .limit(2000) as { data: any[] | null; error: any };
    if (error) return { available: false, threads: [] };

    const mine = (msgs ?? []).filter((m) => m.thread_id.includes(context.userId));
    const { data: reads } = await tbl(supabaseAdmin, "message_reads")
      .select("thread_id, last_read_at").eq("user_id", context.userId) as { data: any[] | null };
    const readAt = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));

    const byThread = new Map<string, { last: any; unread: number }>();
    for (const m of mine) {
      const entry = byThread.get(m.thread_id) ?? { last: m, unread: 0 };
      const lastRead = readAt.get(m.thread_id);
      if (m.sender_id !== context.userId && (!lastRead || m.created_at > lastRead)) entry.unread++;
      byThread.set(m.thread_id, entry);
    }
    const otherIds = Array.from(byThread.keys()).map((t) => dmOther(t, context.userId)).filter(Boolean) as string[];
    const { data: profiles } = otherIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", otherIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    const threads = Array.from(byThread.entries()).map(([thread_id, v]) => {
      const other_id = dmOther(thread_id, context.userId)!;
      return {
        thread_id, other_id, name: nameById.get(other_id) ?? null, email: null,
        last_body: v.last.body, last_at: v.last.created_at, unread: v.unread,
      };
    }).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    return { available: true, threads };
  });

export const getDmThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ other_user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ChatMessage[]> => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = dmThread(context.userId, data.other_user_id);
    const { data: msgs, error } = await tbl(supabaseAdmin, "messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true }).limit(500) as { data: any[] | null; error: any };
    if (error) return [];
    await markRead(supabaseAdmin, threadId, context.userId);
    return (msgs ?? []).map((m) => ({ ...m, mine: m.sender_id === context.userId }));
  });

export const sendDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    other_user_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = dmThread(context.userId, data.other_user_id);
    const { error } = await tbl(supabaseAdmin, "messages")
      .insert({ thread_id: threadId, sender_id: context.userId, body: data.body });
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Messaging isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to send message.");
    }
    await markRead(supabaseAdmin, threadId, context.userId);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Announcements / broadcast (C33).
// ---------------------------------------------------------------------------

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  created_at: string;
  author_name: string | null;
};

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Announcement[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const staff = await isStaff(context);
    const audiences = staff ? ["all", "staff"] : ["all", "clients"];
    const { data, error } = await tbl(supabaseAdmin, "announcements")
      .select("id, title, body, audience, created_at, author_id")
      .in("audience", audiences)
      .order("created_at", { ascending: false })
      .limit(50) as { data: any[] | null; error: any };
    if (error) return [];
    const authorIds = Array.from(new Set((data ?? []).map((a) => a.author_id).filter(Boolean)));
    const { data: profiles } = authorIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", authorIds)
      : { data: [] };
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    return (data ?? []).map((a) => ({
      id: a.id, title: a.title, body: a.body, audience: a.audience, created_at: a.created_at,
      author_name: a.author_id ? nameById.get(a.author_id) ?? null : null,
    }));
  });

export const postAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    audience: z.enum(["all", "staff", "clients"]),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await getStaffAccess(context);
    if (!isAdmin) throw new Error("Only admins can post announcements.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tbl(supabaseAdmin, "announcements")
      .insert({ audience: data.audience, title: data.title, body: data.body, author_id: context.userId });
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Announcements aren't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to post announcement.");
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Unread badge (staff: support inbox + DMs; client: their support thread).
// ---------------------------------------------------------------------------

export const myUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const staff = await isStaff(context);
    const pattern = staff ? null : supportThread(context.userId);
    let query = tbl(supabaseAdmin, "messages").select("thread_id, sender_id, created_at");
    query = staff ? query.or("thread_id.like.support:%,thread_id.like.dm:%") : query.eq("thread_id", pattern);
    const { data: msgs, error } = await query.order("created_at", { ascending: false }).limit(2000) as { data: any[] | null; error: any };
    if (error) return 0;
    const relevant = (msgs ?? []).filter((m) =>
      staff ? (m.thread_id.startsWith("support:") || m.thread_id.includes(context.userId)) : true,
    );
    const { data: reads } = await tbl(supabaseAdmin, "message_reads")
      .select("thread_id, last_read_at").eq("user_id", context.userId) as { data: any[] | null };
    const readAt = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));
    let count = 0;
    for (const m of relevant) {
      if (m.sender_id === context.userId) continue;
      const lastRead = readAt.get(m.thread_id);
      if (!lastRead || m.created_at > lastRead) count++;
    }
    return count;
  });
