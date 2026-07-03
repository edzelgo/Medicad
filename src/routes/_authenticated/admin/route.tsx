import { createFileRoute, Link, Outlet, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { Users, KanbanSquare, FileText, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { adminMyAccess } from "@/lib/admin.functions";

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
];

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
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
