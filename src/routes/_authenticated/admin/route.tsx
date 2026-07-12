import { createFileRoute, Link, Outlet, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, KanbanSquare, FileText, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { adminMyAccess } from "@/lib/admin.functions";
import { adminListPendingRoles } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const res = await adminMyAccess();
    if (!res.allowed) throw redirect({ to: "/portal" });
  },
  component: AdminLayout,
});

const nav = [
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
];

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const pendingFn = useServerFn(adminListPendingRoles);
  const { data: pending } = useQuery({
    queryKey: ["admin", "pending-roles"],
    queryFn: () => pendingFn(),
    refetchInterval: 60_000,
  });
  const pendingCount = pending?.length ?? 0;
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to site</Link>
          <div className="mt-2 font-serif text-lg">Admin CRM</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4" /> {n.label}
                {n.to === "/admin/users" && pendingCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", search: { role: "client" as const } });
          }}><LogOut className="h-3.5 w-3.5 mr-2" /> Sign out</Button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
    </div>
  );
}
