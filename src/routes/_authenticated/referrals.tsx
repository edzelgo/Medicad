import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyReferrals } from "@/lib/referrals.functions";
import { myOnboardAccess } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserPlus, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/referrals")({
  beforeLoad: async () => {
    const res = await myOnboardAccess();
    if (!res.allowed) throw redirect({ to: "/portal" });
    return { onboarderRole: res.role };
  },
  component: MyReferrals,
});

const STAGE_STYLE: Record<string, string> = {
  new: "bg-sky-100 text-sky-800",
  intake: "bg-blue-100 text-blue-800",
  screening: "bg-indigo-100 text-indigo-800",
  application: "bg-amber-100 text-amber-800",
  submitted: "bg-purple-100 text-purple-800",
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-red-100 text-red-800",
  closed: "bg-muted text-muted-foreground",
};

function MyReferrals() {
  const fn = useServerFn(listMyReferrals);
  const { data, isLoading } = useQuery({ queryKey: ["my-referrals"], queryFn: () => fn() });
  const rows = data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Referral partner</div>
            <h1 className="font-serif text-2xl">My Referrals</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/onboard" search={{ tab: "client" as const }} className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90">
              <UserPlus className="h-4 w-4" /> Submit new referral
            </Link>
            <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth?role=referral"; }}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Every referral you've submitted and its current status. Status updates as our team works the case.
        </p>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Status</th><th className="text-left p-3">Submitted</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={3} className="p-4 text-muted-foreground">Loading…</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-medium">{r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs capitalize ${STAGE_STYLE[r.stage] ?? "bg-secondary"}`}>{r.stage}</span></td>
                  <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!isLoading && !rows.length && (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">
                  You haven't submitted any referrals yet. Use "Submit new referral" to get started.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
