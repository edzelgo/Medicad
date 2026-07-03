import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { adminListDocuments, adminGetDocumentUrl } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

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
  const getUrl = useServerFn(adminGetDocumentUrl);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "documents"], queryFn: () => fn() });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const d of data ?? []) if (d.mime_type) set.add(d.mime_type);
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      if (typeFilter !== "all" && d.mime_type !== typeFilter) return false;
      if (!q) return true;
      return (
        (d.owner_name ?? "").toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.mime_type ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, typeFilter]);

  async function openDoc(id: string) {
    try {
      const { url } = await getUrl({ data: { document_id: id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open document");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">Documents</h1>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search by client name, file, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All document types</SelectItem>
            {types.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
          </SelectContent>
        </Select>
        <div className="ml-auto self-center text-sm text-muted-foreground">
          {filtered.length} of {data?.length ?? 0}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={6}>Loading…</td></tr>}
            {filtered.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-3 py-2">{d.owner_name ?? d.user_id.slice(0, 8)}</td>
                <td className="px-3 py-2 truncate max-w-[260px]">{d.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.mime_type ?? "—"}</td>
                <td className="px-3 py-2">{fmtSize(d.size_bytes)}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openDoc(d.id)}>
                    View / Download
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && !filtered.length && (
              <tr><td className="px-3 py-4 text-muted-foreground" colSpan={6}>No documents match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
