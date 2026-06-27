import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListDocuments } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: AdminDocuments,
});

function fmtSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminDocuments() {
  const fn = useServerFn(adminListDocuments);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "documents"], queryFn: () => fn() });
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">Documents</h1>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={5}>Loading…</td></tr>}
            {(data ?? []).map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-3 py-2 truncate max-w-[260px]">{d.name}</td>
                <td className="px-3 py-2">{d.owner_name ?? d.user_id.slice(0, 8)}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.mime_type ?? "—"}</td>
                <td className="px-3 py-2">{fmtSize(d.size_bytes)}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!isLoading && !data?.length && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={5}>No documents uploaded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
