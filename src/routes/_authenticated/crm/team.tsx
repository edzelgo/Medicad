import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTeam, setUserRole, revokeUserRole, myRoles } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/team")({
  component: Team,
});

const ROLES = ["admin", "agent", "client", "referral"] as const;

function Team() {
  const list = useServerFn(listTeam);
  const set = useServerFn(setUserRole);
  const revoke = useServerFn(revokeUserRole);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm", "team"], queryFn: () => list() });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const isAdmin = !!roles?.isAdmin;

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="font-serif text-2xl">Team</h1>
      {!isAdmin && <p className="text-sm text-muted-foreground">You can view team members. Only admins can change roles.</p>}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr><th className="text-left p-3">User</th><th className="text-left p-3">Roles</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">{u.full_name ?? u.id.slice(0, 8)}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">{u.roles.map((r) => <span key={r} className="px-2 py-0.5 rounded text-xs bg-secondary">{r}</span>)}</div>
                </td>
                <td className="p-3">{u.status}</td>
                <td className="p-3">
                  {isAdmin && (
                    <div className="flex flex-wrap gap-1">
                      {ROLES.map((r) => {
                        const has = u.roles.includes(r);
                        return (
                          <Button key={r} size="sm" variant={has ? "secondary" : "outline"}
                            onClick={async () => {
                              try {
                                if (has) await revoke({ data: { user_id: u.id, role: r } });
                                else await set({ data: { user_id: u.id, role: r } });
                                qc.invalidateQueries({ queryKey: ["crm", "team"] });
                                toast.success(has ? `Revoked ${r}` : `Granted ${r}`);
                              } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                            }}>{has ? `- ${r}` : `+ ${r}`}</Button>
                        );
                      })}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No team members.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
