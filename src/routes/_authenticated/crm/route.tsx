import { createFileRoute, Link, Outlet, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Users, KanbanSquare, Shield, LogOut, ClipboardList, FolderPlus, BarChart3, Settings, UserPlus, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { adminMyAccess } from "@/lib/admin.functions";
import { adminListPendingRoles } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/crm")({
  beforeLoad: async () => {
    const res = await adminMyAccess();
    if (!res.allowed) throw redirect({ to: "/portal" });
  },
  component: CrmLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: NavItem[] = [
  { to: "/crm", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/crm/intake-dashboard", label: "Intake Dashboard", icon: ClipboardList },
  { to: "/crm/cases/new", label: "Add New Case", icon: FolderPlus },
  { to: "/crm/leads", label: "Leads", icon: Users },
  { to: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/crm/reports", label: "Reports", icon: BarChart3 },
  { to: "/crm/referral-partners", label: "Referral Partners", icon: Building2 },
  { to: "/crm/team", label: "Team", icon: Shield },
  { to: "/crm/settings", label: "Settings", icon: Settings },
];

function CrmLayout() {
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
          <div className="mt-2 font-serif text-lg">Medicaid CRM</div>
        </div>
        <div className="p-3 border-b border-border">
          <Link
            to="/onboard"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
          >
            <UserPlus className="h-4 w-4" /> Onboard New Client
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            const Icon = n.icon;
            const showBadge = n.label === "Team" && pendingCount > 0;
            return (
              <Link key={n.to} to={n.to as string} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4" /> {n.label}
                {showBadge && (
                  <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold inline-flex items-center justify-center">
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