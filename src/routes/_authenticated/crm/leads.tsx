import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listLeads, createLead } from "@/lib/crm.functions";
import { IntakeForm } from "@/components/crm/intake-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/leads")({
  component: LeadsList,
});

function LeadsList() {
  const fn = useServerFn(listLeads);
  const qc = useQueryClient();
  const create = useServerFn(createLead);
  const { data } = useQuery({ queryKey: ["crm", "leads"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const list = data ?? [];
    const filtered = list.filter((l) => {
      if (stage && l.stage !== stage) return false;
      if (source && (l.source ?? "") !== source) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return [l.full_name, l.first_name, l.last_name, l.email, l.phone, l.state, l.source]
        .some((x) => x?.toLowerCase().includes(s));
    });
    return [...filtered].sort((a, b) => {
      const t = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (t !== 0) return t;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [data, q, stage, source]);
  const total = data?.length ?? 0;
  const resetFilters = () => { setQ(""); setStage(""); setSource(""); };

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
                toast.success("Lead created");
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["crm"] });
                window.location.href = `/crm/leads/${(row as { id: string }).id}`;
              } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
            }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <select className="border border-input rounded-md px-3 text-sm bg-background" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          {["new","intake","screening","application","submitted","approved","denied","closed"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="border border-input rounded-md px-3 text-sm bg-background" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {Array.from(new Set((data ?? []).map((l) => l.source ?? "").filter(Boolean))).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button variant="outline" onClick={resetFilters}>Reset filters</Button>
        <span className="ml-auto self-center text-xs text-muted-foreground">Showing {rows.length} of {total}</span>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Email</th><th className="text-left p-3">Phone</th><th className="text-left p-3">State</th><th className="text-left p-3">Stage</th><th className="text-left p-3">Source</th><th className="text-left p-3">Created</th></tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/50">
                <td className="p-3"><Link to="/crm/leads/$id" params={{ id: l.id }} className="hover:underline font-medium">{l.full_name || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "—"}</Link></td>
                <td className="p-3">{l.email ?? "—"}</td>
                <td className="p-3">{l.phone ?? "—"}</td>
                <td className="p-3">{l.state ?? "—"}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-secondary">{l.stage}</span></td>
                <td className="p-3">{l.source ?? "—"}</td>
                <td className="p-3">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No leads.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
