import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { adminListUsers } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

const ROLE_FILTERS = ["all", "admin", "agent", "client", "referral"] as const;
type RoleFilter = typeof ROLE_FILTERS[number];

function AdminUsers() {
  const fn = useServerFn(adminListUsers);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fn() });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selected, setSelected] = useState<NonNullable<typeof data>[number] | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      const userRoles = u.roles.map((r) => r.role);
      if (roleFilter !== "all" && !userRoles.includes(roleFilter)) return false;
      if (!q) return true;
      return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [data, search, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">Users</h1>
        <div className="text-sm text-muted-foreground">{filtered.length} of {data?.length ?? 0}</div>
      </div>

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
                onClick={() => setSelected(u)}
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

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
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
                  <div className="flex gap-1 flex-wrap">
                    {selected.roles.length
                      ? selected.roles.map((r) => (
                          <Badge key={r.role} variant={r.role === "admin" ? "default" : "secondary"} className="capitalize">
                            {r.role}{r.status === "pending" ? " · pending" : ""}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground">No roles assigned</span>}
                  </div>
                </div>

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
