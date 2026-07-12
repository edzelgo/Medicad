import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { adminListUsers } from "@/lib/admin.functions";
import { adminInviteUser, adminResendInvite, adminSetUserActive, adminListPendingRoles } from "@/lib/admin-users.functions";
import { myRoles, setUserRole, revokeUserRole } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, UserPlus, MailPlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

const ROLE_FILTERS = ["all", "admin", "agent", "marketer", "client", "referral"] as const;
const ROLES = ["admin", "agent", "marketer", "client", "referral"] as const;
type RoleFilter = typeof ROLE_FILTERS[number];
type Role = typeof ROLES[number];

function AdminUsers() {
  const fn = useServerFn(adminListUsers);
  const inviteFn = useServerFn(adminInviteUser);
  const resendFn = useServerFn(adminResendInvite);
  const activeFn = useServerFn(adminSetUserActive);
  const pendingFn = useServerFn(adminListPendingRoles);
  const setRoleFn = useServerFn(setUserRole);
  const revokeRoleFn = useServerFn(revokeUserRole);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fn() });
  const { data: pending } = useQuery({ queryKey: ["admin", "pending-roles"], queryFn: () => pendingFn() });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const isAdmin = !!roles?.isAdmin;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("client");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "pending-roles"] });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      const userRoles = u.roles.map((r) => r.role);
      if (roleFilter !== "all" && !userRoles.includes(roleFilter)) return false;
      if (!q) return true;
      return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [data, search, roleFilter]);

  const selected = useMemo(
    () => (data ?? []).find((u) => u.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">Users</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">{filtered.length} of {data?.length ?? 0}</div>
          {isAdmin && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Invite user
            </Button>
          )}
        </div>
      </div>

      {/* Pending role approvals */}
      {(pending?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            {pending!.length} pending role request{pending!.length === 1 ? "" : "s"}
          </div>
          <ul className="space-y-2">
            {pending!.map((p) => (
              <li key={`${p.user_id}-${p.role}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{p.full_name ?? p.email ?? p.user_id.slice(0, 8)}</span>
                <span className="text-muted-foreground">{p.email}</span>
                <Badge variant="secondary" className="capitalize">{p.role}</Badge>
                {p.requested_at && (
                  <span className="text-xs text-muted-foreground">
                    requested {new Date(p.requested_at).toLocaleDateString()}
                  </span>
                )}
                {isAdmin && (
                  <span className="ml-auto flex gap-1">
                    <Button size="sm" onClick={async () => {
                      try {
                        await setRoleFn({ data: { user_id: p.user_id, role: p.role as Role, status: "approved" } });
                        toast.success(`Approved ${p.role} for ${p.full_name ?? p.email ?? "user"}`);
                        refresh();
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        await revokeRoleFn({ data: { user_id: p.user_id, role: p.role as Role } });
                        toast.success("Request rejected");
                        refresh();
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}>Reject</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1 flex-wrap">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize border ${roleFilter === r ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Full Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 w-56">Document progress</th>
              <th className="px-3 py-2">Sign-up Date</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={6}>Loading…</td></tr>}
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => setSelectedId(u.id)}
                className="border-t border-border cursor-pointer hover:bg-muted/40"
              >
                <td className="px-3 py-2 font-medium">{u.full_name ?? "—"}</td>
                <td className="px-3 py-2">{u.email ?? "—"}</td>
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
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Progress value={u.progress.percent} aria-label="Document progress" className="h-2 flex-1" />
                    <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">
                      {u.progress.satisfied}/{u.progress.total}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <Badge variant={u.status === "active" ? "default" : "outline"} className="capitalize">{u.status}</Badge>
                </td>
              </tr>
            ))}
            {!isLoading && !filtered.length && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={6}>No users match.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              Sends a magic-link email so they can set a password. The role is granted immediately.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await inviteFn({ data: { email: inviteEmail.trim(), role: inviteRole, full_name: inviteName.trim() || undefined } });
                toast.success(`Invite sent to ${inviteEmail.trim()} as ${inviteRole}`);
                setInviteOpen(false);
                setInviteEmail(""); setInviteName(""); setInviteRole("client");
                refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Invite failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@example.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role *</Label>
              <div className="flex gap-1 flex-wrap">
                {ROLES.map((r) => (
                  <button type="button" key={r}
                    onClick={() => setInviteRole(r)}
                    className={`px-3 py-1.5 rounded-md text-sm capitalize border ${inviteRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy || !inviteEmail.trim()}>
              <MailPlus className="h-4 w-4 mr-2" /> {busy ? "Sending…" : "Send invite"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* User detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.full_name ?? "Unnamed user"}</SheetTitle>
                <SheetDescription>{selected.email ?? "No email on file"}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <Field label="User ID" value={selected.id} mono />
                <Field label="Phone" value={selected.phone ?? "—"} />
                <Field label="Sign-up date" value={new Date(selected.created_at).toLocaleString()} />
                <Field label="Last sign-in" value={selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleString() : "Never"} />
                <Field label="Status" value={selected.status} />
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Roles</div>
                  {isAdmin ? (
                    <div className="flex gap-1 flex-wrap">
                      {ROLES.map((r) => {
                        const has = selected.roles.some((x) => x.role === r);
                        return (
                          <Button key={r} size="sm" variant={has ? "secondary" : "outline"}
                            onClick={async () => {
                              try {
                                if (has) await revokeRoleFn({ data: { user_id: selected.id, role: r } });
                                else await setRoleFn({ data: { user_id: selected.id, role: r } });
                                toast.success(has ? `Revoked ${r}` : `Granted ${r}`);
                                refresh();
                              } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                            }}>{has ? `− ${r}` : `+ ${r}`}</Button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {selected.roles.length
                        ? selected.roles.map((r) => (
                            <Badge key={r.role} variant={r.role === "admin" ? "default" : "secondary"} className="capitalize">
                              {r.role}{r.status === "pending" ? " · pending" : ""}
                            </Badge>
                          ))
                        : <span className="text-muted-foreground">No roles assigned</span>}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button size="sm" variant="outline" onClick={async () => {
                      if (!selected.email) { toast.error("No email on file"); return; }
                      try {
                        const res = await resendFn({ data: { email: selected.email } });
                        toast.success(res.kind === "invite" ? "Invite re-sent" : "Password reset link sent");
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}>Resend invite</Button>
                    <Button size="sm" variant={selected.status === "active" ? "destructive" : "default"} onClick={async () => {
                      const activate = selected.status !== "active";
                      if (!activate && !confirm("Deactivate this account? They will not be able to sign in.")) return;
                      try {
                        await activeFn({ data: { user_id: selected.id, active: activate } });
                        toast.success(activate ? "Account reactivated" : "Account deactivated");
                        refresh();
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                    }}>{selected.status === "active" ? "Deactivate" : "Reactivate"}</Button>
                  </div>
                )}

                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase text-muted-foreground">Medicaid document checklist</div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {selected.progress.satisfied}/{selected.progress.total} · {selected.progress.percent}%
                    </div>
                  </div>
                  <Progress value={selected.progress.percent} aria-label="Document progress" className="h-2 mb-3" />
                  <div className="text-xs text-muted-foreground mb-1">{selected.document_count} file(s) uploaded</div>

                  {selected.progress.missing.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-foreground mb-1">Missing ({selected.progress.missing.length})</div>
                      <ul className="space-y-1">
                        {selected.progress.missing.map((m) => (
                          <li key={m} className="flex items-start gap-2 text-sm">
                            <Circle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.progress.satisfiedLabels.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-foreground mb-1">Submitted ({selected.progress.satisfiedLabels.length})</div>
                      <ul className="space-y-1">
                        {selected.progress.satisfiedLabels.map((m) => (
                          <li key={m} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground mb-1">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : ""}>{value}</div>
    </div>
  );
}
