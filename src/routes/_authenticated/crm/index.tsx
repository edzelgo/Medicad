import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { dashboardStats } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/crm/")({
  component: Dashboard,
});

const STAGES = ["new", "intake", "screening", "application", "submitted", "approved", "denied", "closed"] as const;

function Dashboard() {
  const fn = useServerFn(dashboardStats);
  const { data } = useQuery({ queryKey: ["crm", "dashboard"], queryFn: () => fn() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">Dashboard</h1>
        <Link
          to="/onboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
        >
          <UserPlus className="h-4 w-4" /> Onboard New Client
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAGES.map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase text-muted-foreground">{s}</div>
            <div className="text-3xl font-semibold mt-1">{data?.stageCounts?.[s] ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Recent leads</h2>
          <ul className="divide-y divide-border">
            {(data?.recentLeads ?? []).map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                <Link to="/crm/leads/$id" params={{ id: l.id }} className="hover:underline">
                  {l.full_name || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || l.email}
                </Link>
                <span className="text-xs text-muted-foreground">{l.stage}</span>
              </li>
            ))}
            {!data?.recentLeads?.length && <li className="py-2 text-sm text-muted-foreground">No leads yet.</li>}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          <ul className="divide-y divide-border">
            {(data?.recentActivities ?? []).map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <div className="text-foreground">{a.content}</div>
                <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
              </li>
            ))}
            {!data?.recentActivities?.length && <li className="py-2 text-sm text-muted-foreground">No activity yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
