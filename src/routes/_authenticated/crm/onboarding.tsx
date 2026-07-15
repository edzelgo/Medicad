import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { adminListUsers } from "@/lib/admin.functions";
import { myRoles } from "@/lib/crm.functions";
import { ClientOnboardForm, TeamOnboardForm } from "@/components/crm/onboard-forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, UserCheck, MailWarning, CheckCircle2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm/onboarding")({
  component: OnboardingTracker,
});

const TEAM_ROLES = ["admin", "agent", "marketer", "referral"];

type Row = Awaited<ReturnType<typeof adminListUsers>>[number];

function OnboardingTracker() {
  const fn = useServerFn(adminListUsers);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fn() });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const isAdmin = !!roles?.isAdmin;
  const [tab, setTab] = useState<"clients" | "team">("clients");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState<null | "client" | "team">(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const users = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const search = q.trim().toLowerCase();
    return users
      .filter((u: Row) => {
        const roles = u.roles.map((r) => r.role);
        return tab === "clients" ? roles.includes("client") : roles.some((r) => TEAM_ROLES.includes(r));
      })
      .filter((u: Row) => {
        if (!search) return true;
        return (u.full_name ?? "").toLowerCase().includes(search) || (u.email ?? "").toLowerCase().includes(search);
      })
      .sort((a: Row, b: Row) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [users, tab, q]);

  // "Accepted" = they've signed in at least once, i.e. the invite/login was used.
  const pending = rows.filter((u: Row) => !u.last_sign_in_at).length;
  const complete = rows.filter((u: Row) => u.progress.percent === 100).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl">Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every account onboarded into the system and how far along they are.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAddOpen("client")}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Onboard Client
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen("team")}>
              <Users className="h-4 w-4 mr-1.5" /> Onboard Team Member
            </Button>
          )}
        </div>
      </div>

      {/* Onboard via form, without leaving the tracker */}
      <Dialog open={addOpen !== null} onOpenChange={(o) => !o && setAddOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{addOpen === "team" ? "Onboard a team member" : "Onboard a client"}</DialogTitle>
            <DialogDescription>
              {addOpen === "team"
                ? "Enter their details and either email an invite or create their login now."
                : "Fill in the intake. You can also create the client's login here."}
            </DialogDescription>
          </DialogHeader>
          {addOpen === "client" && (
            <ClientOnboardForm
              onboarderRole={isAdmin ? "admin" : "agent"}
              onFinished={() => { setAddOpen(null); refresh(); }}
            />
          )}
          {addOpen === "team" && (
            <TeamOnboardForm onFinished={() => { setAddOpen(null); refresh(); }} />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex gap-1 border-b border-border">
        {([
          ["clients", "Clients", Users],
          ["team", "Team members", UserCheck],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px inline-flex items-center gap-1.5 ${
              tab === key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Tracker summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={tab === "clients" ? "Clients onboarded" : "Team members"} value={rows.length} icon={Users} />
        <Stat label="Invite not yet accepted" value={pending} icon={MailWarning} accent={pending > 0 ? "text-amber-600" : undefined} />
        {tab === "clients" && (
          <Stat label="Document checklist complete" value={complete} icon={CheckCircle2} accent={complete > 0 ? "text-emerald-600" : undefined} />
        )}
      </div>

      <Input
        placeholder="Search name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">{tab === "clients" ? "Role" : "Role(s)"}</th>
              <th className="px-3 py-2">Onboarded</th>
              <th className="px-3 py-2">Login status</th>
              {tab === "clients" && <th className="px-3 py-2 w-56">Document progress</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td className="px-3 py-4 text-muted-foreground" colSpan={tab === "clients" ? 6 : 5}>Loading…</td></tr>
            )}
            {rows.map((u: Row) => {
              const accepted = !!u.last_sign_in_at;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.length
                        ? u.roles.map((r) => (
                            <Badge key={r.role} variant={r.role === "admin" ? "default" : "secondary"} className="capitalize">
                              {r.role}{r.status === "pending" ? " · pending" : ""}
                            </Badge>
                          ))
                        : <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {!accepted ? (
                      <Badge className="bg-amber-500 hover:bg-amber-500">Invite pending</Badge>
                    ) : u.status === "active" ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </td>
                  {tab === "clients" && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={u.progress.percent} aria-label="Document progress" className="h-2 flex-1" />
                        <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">
                          {u.progress.satisfied}/{u.progress.total}
                        </span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!isLoading && !rows.length && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={tab === "clients" ? 6 : 5}>
                  {tab === "clients"
                    ? "No client accounts yet. Use “Onboard Client” and choose to create a login."
                    : "No team members yet. Use “Onboard Team Member” to invite one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        “Invite pending” means the account exists but the person hasn’t signed in yet. Clients only appear here once
        they have a login — intakes saved without one live under Leads.
      </p>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Users; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
