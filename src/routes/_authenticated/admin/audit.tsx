import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Loader2, RotateCcw, Search } from "lucide-react";
import {
  AUDIT_ACTIONS,
  adminSearchAuditLogs,
  adminExportAuditLogs,
  type AuditFilter,
} from "@/lib/audit-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

type FormState = {
  q: string;
  userId: string;
  email: string;
  action: string;
  ip: string;
  ua: string;
  from: string;
  to: string;
};

const EMPTY: FormState = { q: "", userId: "", email: "", action: "", ip: "", ua: "", from: "", to: "" };

function toFilter(f: FormState, page = 1, pageSize = 50): AuditFilter {
  const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
  return {
    q: f.q || undefined,
    userId: f.userId || undefined,
    email: f.email || undefined,
    action: (f.action || undefined) as AuditFilter["action"],
    ip: f.ip || undefined,
    ua: f.ua || undefined,
    from: iso(f.from),
    to: iso(f.to),
    page,
    pageSize,
  };
}

function AuditPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const searchFn = useServerFn(adminSearchAuditLogs);
  const exportFn = useServerFn(adminExportAuditLogs);

  const search = useMutation({
    mutationFn: (vars: { page: number }) => searchFn({ data: toFilter(form, vars.page, pageSize) }),
    onError: () => toast.error("Failed to load audit logs"),
  });

  const exp = useMutation({
    mutationFn: () => exportFn({ data: toFilter(form, 1, pageSize) }),
    onSuccess: (res) => {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.rowCount} rows`);
    },
    onError: () => toast.error("Export failed"),
  });

  const totalPages = useMemo(() => {
    const count = search.data?.count ?? 0;
    return Math.max(1, Math.ceil(count / pageSize));
  }, [search.data]);

  const runSearch = (p = 1) => {
    setPage(p);
    search.mutate({ page: p });
  };

  const reset = () => {
    setForm(EMPTY);
    setPage(1);
    search.reset();
  };

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Search logins, document activity, and packet compression events across every account.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label>Free-text (email / resource / IP / UA)</Label>
          <Input value={form.q} onChange={upd("q")} placeholder="jane@example.com or 10.0.0.1" />
        </div>
        <div>
          <Label>Event type</Label>
          <Select value={form.action || "all"} onValueChange={(v) => setForm((s) => ({ ...s, action: v === "all" ? "" : v }))}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any event</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>User ID</Label>
          <Input value={form.userId} onChange={upd("userId")} placeholder="uuid" />
        </div>
        <div>
          <Label>Email contains</Label>
          <Input value={form.email} onChange={upd("email")} />
        </div>
        <div>
          <Label>IP contains</Label>
          <Input value={form.ip} onChange={upd("ip")} />
        </div>
        <div>
          <Label>User-agent contains</Label>
          <Input value={form.ua} onChange={upd("ua")} placeholder="Chrome, iPhone…" />
        </div>
        <div>
          <Label>From</Label>
          <Input type="datetime-local" value={form.from} onChange={upd("from")} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="datetime-local" value={form.to} onChange={upd("to")} />
        </div>

        <div className="md:col-span-4 flex flex-wrap gap-2 pt-2">
          <Button onClick={() => runSearch(1)} disabled={search.isPending}>
            {search.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Search
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button variant="secondary" onClick={() => exp.mutate()} disabled={exp.isPending}>
            {exp.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export CSV
          </Button>
          <div className="ml-auto text-sm text-muted-foreground self-center">
            {search.data ? `${search.data.count.toLocaleString()} results` : "Run a search to view logs"}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>User-Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(search.data?.rows ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Date(r.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs font-mono">{r.action}</TableCell>
                <TableCell className="text-xs">
                  <div>{r.actor_email ?? "—"}</div>
                  <div className="text-muted-foreground">{r.user_id?.slice(0, 8)}…</div>
                </TableCell>
                <TableCell className="text-xs font-mono">{r.ip_address ?? "—"}</TableCell>
                <TableCell className="text-xs max-w-[220px] truncate" title={r.resource ?? ""}>
                  {r.resource ?? "—"}
                </TableCell>
                <TableCell className="text-xs max-w-[240px] truncate" title={r.user_agent ?? ""}>
                  {r.user_agent ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {search.data && search.data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No audit events match those filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {search.data && search.data.count > pageSize && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => runSearch(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => runSearch(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}