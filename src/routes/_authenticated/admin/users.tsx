import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const fn = useServerFn(adminListUsers);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fn() });
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">Users</h1>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={4}>Loading…</td></tr>}
            {(data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">{u.full_name ?? "—"}</td>
                <td className="px-3 py-2">{u.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  {u.roles.length ? u.roles.map((r) => `${r.role}${r.status === "pending" ? " (pending)" : ""}`).join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!isLoading && !data?.length && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={4}>No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
