import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side role gate for the user portal. Verifies the caller has an
// approved agent / referral / client role. Admin / staff are redirected
// to the admin CRM instead of the client-style portal.
export const getPortalAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role, status")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const roles = (data ?? []) as { role: string; status: string }[];
    const isAdmin = roles.some((r) => r.role === "admin" && r.status === "approved");
    const portalRoles = roles.filter(
      (r) => (r.role === "agent" || r.role === "referral" || r.role === "client") && r.status === "approved",
    );

    return {
      isAdmin,
      allowed: portalRoles.length > 0,
      role: portalRoles[0]?.role ?? null,
      pending: roles.some((r) => r.status === "pending"),
    };
  });