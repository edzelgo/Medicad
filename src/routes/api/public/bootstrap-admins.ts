import { createFileRoute } from "@tanstack/react-router";

// One-off bootstrap endpoint to seed internal admin accounts.
// Authenticated with CRON_SECRET so it cannot be abused publicly.
const ADMINS: { email: string; password: string; full_name: string }[] = [
  { email: "dean@medicaidsuccess.com", password: "123456", full_name: "Dean (Admin)" },
  { email: "mike@medicaidsucess.com", password: "123456", full_name: "Mike (Admin)" },
];

export const Route = createFileRoute("/api/public/bootstrap-admins")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Idempotent one-off seed. Only ever provisions the two named
        // internal admins below — cannot be used to escalate other accounts.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: { email: string; status: string; user_id?: string; error?: string }[] = [];

        for (const a of ADMINS) {
          // Find or create the auth user
          let userId: string | null = null;
          const created = await supabaseAdmin.auth.admin.createUser({
            email: a.email,
            password: a.password,
            email_confirm: true,
            user_metadata: { full_name: a.full_name, role: "client" },
          });
          if (created.data?.user) {
            userId = created.data.user.id;
          } else {
            // Already exists — locate by paging
            let page = 1;
            while (page < 20 && !userId) {
              const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
              if (error || !data?.users?.length) break;
              const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === a.email.toLowerCase());
              if (hit) userId = hit.id;
              if (data.users.length < 200) break;
              page++;
            }
            if (userId) {
              // Reset password so the requested credentials always work
              await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: a.password,
                email_confirm: true,
              });
            }
          }

          if (!userId) {
            results.push({ email: a.email, status: "failed", error: created.error?.message ?? "no user" });
            continue;
          }

          // Ensure profile exists
          await supabaseAdmin
            .from("profiles")
            .upsert({ id: userId, full_name: a.full_name }, { onConflict: "id" });

          // Grant approved admin role
          await supabaseAdmin
            .from("user_roles")
            .upsert(
              { user_id: userId, role: "admin", status: "approved" },
              { onConflict: "user_id,role" },
            );

          results.push({ email: a.email, status: "ok", user_id: userId });
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});