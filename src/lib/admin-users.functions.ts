import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

const INVITABLE_ROLES = ["admin", "agent", "marketer", "client", "referral"] as const;

/**
 * Invite a user by email and grant them a role immediately. This is the
 * missing "admins can onboard agents/clients" flow: previously staff had to
 * self-register and wait for an admin to notice.
 */
export const adminInviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().email().max(255),
    role: z.enum(INVITABLE_ROLES),
    full_name: z.string().trim().max(150).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { role: data.role, full_name: data.full_name ?? undefined } },
    );
    if (error) {
      const msg = error.message ?? "Invite failed";
      if (/already.*(registered|exists)/i.test(msg)) {
        throw new Error("A user with this email already exists. Grant them the role from their user row instead.");
      }
      console.error("[invite]", msg);
      throw new Error("Failed to send the invite email. Please try again.");
    }

    // Grant the role approved right away — the signup trigger may create it
    // as pending (or not at all for invited users), so make it explicit.
    if (invited?.user?.id) {
      const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert(
        { user_id: invited.user.id, role: data.role, status: "approved" },
        { onConflict: "user_id,role" },
      );
      if (roleErr) console.error("[invite:role]", roleErr.message);
      if (data.full_name) {
        await supabaseAdmin.from("profiles")
          .upsert({ id: invited.user.id, full_name: data.full_name }, { onConflict: "id" });
      }
    }
    return { ok: true, email: data.email, role: data.role };
  });

/** Re-send the invite email to a user who hasn't accepted yet. */
export const adminResendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) {
      // Already-accepted users can't be re-invited; send a recovery link instead.
      const { error: recErr } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
      if (recErr) {
        console.error("[resend-invite]", error.message, recErr.message);
        throw new Error("Could not re-send the invite. The user may already be active.");
      }
      return { ok: true, kind: "recovery" as const };
    }
    return { ok: true, kind: "invite" as const };
  });

/** Edit a user's profile fields (name / phone). Admin-only. (Gap A #9) */
export const adminUpdateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    full_name: z.string().trim().max(150).optional().nullable().or(z.literal("")),
    phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name || null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin
      .from("profiles").update(patch as never).eq("id", data.user_id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

/** Deactivate (ban) or reactivate a user account. */
export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    if (data.user_id === context.userId && !data.active) {
      throw new Error("You can't deactivate your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      // ~100 years for "deactivated"; "none" lifts the ban.
      ban_duration: data.active ? "none" : "876000h",
    });
    if (error) { console.error("[ban]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

export type PendingRoleRequest = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  requested_at: string | null;
};

/**
 * Self-registered users whose role grant is still pending. Readable by staff
 * (so the sidebar badge works for agents too); approving remains admin-only
 * via setUserRole/revokeUserRole.
 */
export const adminListPendingRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingRoleRequest[]> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("status", "pending");
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    if (!rows?.length) return [];

    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, full_name").in("id", ids);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const emailById = new Map<string, string | null>();
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      emailById.set(id, u?.user?.email ?? null);
    }

    return rows.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      full_name: nameById.get(r.user_id) ?? null,
      email: emailById.get(r.user_id) ?? null,
      requested_at: r.created_at ?? null,
    }));
  });
