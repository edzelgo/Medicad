import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listLeads, createLead } from "@/lib/crm.functions";
import { IntakeForm } from "@/components/crm/intake-form";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/leads")({
  component: LeadsList,
});

const STAGES = ["new","intake","screening","application","submitted","approved","denied","closed"] as const;
const PRIORITIES = ["low","normal","high","urgent"] as const;
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  high: "bg-amber-100 text-amber-800",
  normal: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
};
const PAGE_SIZE = 50;

function LeadsList() {
  const fn = useServerFn(listLeads);
  const qc = useQueryClient();
  const create = useServerFn(createLead);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const args = {
    q: debouncedQ || undefined,
    stage: (stage || undefined) as typeof STAGES[number] | undefined,
    source: source || undefined,
    priority: (priority || undefined) as typeof PRIORITIES[number] | undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isFetching } = useQuery({
    queryKey: ["crm", "leads", args],
    queryFn: () => fn({ data: args }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const sources = data?.sources ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetFilters = () => { setQ(""); setStage(""); setSource(""); setPriority(""); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">Leads</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New intake</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New intake</DialogTitle></DialogHeader>
            <IntakeForm busy={busy} onSubmit={async (v) => {
              setBusy(true);
              try {
                const row = await create({ data: v as never });
                const dupes = (row as { possibleDuplicates?: unknown[] }).possibleDuplicates ?? [];
                if (dupes.length) {
                  toast.warning(`Lead created — ${dupes.length} possible duplicate(s) found. Check the lead's activity log.`, { duration: 8000 });
                } else {
                  toast.success("Lead created");
                }
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["crm"] });
                window.location.href = `/crm/leads/${(row as { id: string }).id}`;
              } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <select className="border border-input rounded-md px-3 text-sm bg-background" value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="border border-input rounded-md px-3 text-sm bg-background" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-input rounded-md px-3 text-sm bg-background capitalize" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Button variant="outline" onClick={resetFilters}>Reset filters</Button>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {isFetching && <Loader2 className="h-3 w-3 inline animate-spin mr-1" />}
          {total} lead{total === 1 ? "" : "s"} · page {page} of {totalPages}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Priority</th><th className="text-left p-3">Email</th><th className="text-left p-3">Phone</th><th className="text-left p-3">State</th><th className="text-left p-3">Stage</th><th className="text-left p-3">Source</th><th className="text-left p-3">Created</th></tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/50">
                <td className="p-3"><Link to="/crm/leads/$id" params={{ id: l.id }} className="hover:underline font-medium">{l.full_name || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "—"}</Link></td>
                <td className="p-3">
                  {(() => {
                    const p = (l as { priority?: string }).priority ?? "normal";
                    return <span className={`px-2 py-0.5 rounded text-xs capitalize ${PRIORITY_STYLE[p] ?? PRIORITY_STYLE.normal}`}>{p}</span>;
                  })()}
                </td>
                <td className="p-3">{l.email ?? "—"}</td>
                <td className="p-3">{l.phone ?? "—"}</td>
                <td className="p-3">{l.state ?? "—"}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-secondary">{l.stage}</span></td>
                <td className="p-3">{l.source ?? "—"}</td>
                <td className="p-3">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No leads match.</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-end gap-1 p-3 border-t border-border text-xs">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="h-8 px-2 rounded border border-border hover:bg-muted disabled:opacity-40 inline-flex items-center">
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="px-2 text-muted-foreground">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 px-2 rounded border border-border hover:bg-muted disabled:opacity-40 inline-flex items-center">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
