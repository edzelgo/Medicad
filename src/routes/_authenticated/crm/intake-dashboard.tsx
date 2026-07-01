import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  listIntakeCases,
  updateIntakeCase,
  bulkUpdateIntakeCases,
  exportIntakeCases,
  listIntakeCaseEvents,
  WORKFLOW_OPTIONS,
  STATUS_OPTIONS,
  type IntakeCase,
  type IntakeListResult,
  type IntakeCaseEvent,
  type IntakeExportRow,
} from "@/lib/intake-dashboard.functions";
import { Input } from "@/components/ui/input";
import {
  Filter, FileText, Loader2, X, History, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  workflow: z.string().optional().default(""),
  status: z.string().optional().default(""),
  agent: z.string().optional().default(""),
  dateFrom: z.string().optional().default(""),
  dateTo: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(10).max(200).optional().default(50),
});

export const Route = createFileRoute("/_authenticated/crm/intake-dashboard")({
  validateSearch: (s) => searchSchema.parse(s),
  component: IntakeDashboard,
});

const WORKFLOW_COLORS: Record<string, string> = {
  "OLD Medicaid Application": "bg-blue-100 text-blue-800 border-blue-300",
  "Texas Application": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Pennsylvania Application": "bg-amber-100 text-amber-800 border-amber-300",
  "New Medicaid Application": "bg-sky-100 text-sky-800 border-sky-300",
  "CommCare": "bg-purple-100 text-purple-800 border-purple-300",
};

function IntakeDashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const listFn = useServerFn(listIntakeCases);
  const updateFn = useServerFn(updateIntakeCase);
  const bulkFn = useServerFn(bulkUpdateIntakeCases);
  const exportFn = useServerFn(exportIntakeCases);
  const eventsFn = useServerFn(listIntakeCaseEvents);
  const qc = useQueryClient();

  const filterArgs = {
    q: search.q || undefined,
    workflow: search.workflow || undefined,
    status: search.status || undefined,
    agent: search.agent || undefined,
    dateFrom: search.dateFrom || undefined,
    dateTo: search.dateTo || undefined,
  };
  const listArgs = { ...filterArgs, page: search.page, pageSize: search.pageSize };
  const queryKey = ["intake-cases", listArgs] as const;

  const { data, isFetching } = useQuery<IntakeListResult>({
    queryKey,
    queryFn: () => listFn({ data: listArgs }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalAll = data?.totalAll ?? 0;
  const agents = data?.agents ?? [];
  const workflowStats = data?.workflowStats ?? {};

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorkflow, setBulkWorkflow] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  const setSearch = (patch: Partial<typeof search>, resetPage = true) => {
    navigate({
      search: (prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) }),
      replace: true,
    });
  };

  const selected = useMemo(
    () => rows.find((c) => c.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const mutation = useMutation({
    mutationFn: (vars: {
      id: string;
      workflow?: string | null;
      status?: string | null;
      agent?: string | null;
      follow_up_date?: string | null;
    }) => updateFn({ data: vars }),
    onMutate: async (vars) => {
      setPendingId(vars.id);
      await qc.cancelQueries({ queryKey: ["intake-cases"] });
      const previous = qc.getQueryData<IntakeListResult>(queryKey);
      if (previous) {
        qc.setQueryData<IntakeListResult>(queryKey, {
          ...previous,
          rows: previous.rows.map((c) =>
            c.id === vars.id
              ? {
                  ...c,
                  ...(vars.workflow !== undefined ? { workflow: vars.workflow } : {}),
                  ...(vars.status !== undefined
                    ? { status: vars.status, status_date: new Date().toISOString().slice(0, 10) }
                    : {}),
                  ...(vars.agent !== undefined ? { agent: vars.agent } : {}),
                  ...(vars.follow_up_date !== undefined
                    ? { follow_up_date: vars.follow_up_date }
                    : {}),
                }
              : c,
          ),
        });
      }
      return { previous };
    },
    onSuccess: (row) => {
      const cur = qc.getQueryData<IntakeListResult>(queryKey);
      if (cur) {
        qc.setQueryData<IntakeListResult>(queryKey, {
          ...cur,
          rows: cur.rows.map((c) => (c.id === row.id ? row : c)),
        });
      }
      qc.invalidateQueries({ queryKey: ["intake-case-events", row.id] });
      toast.success("Case updated");
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      toast.error(`Update failed: ${e.message}`, { duration: 6000 });
    },
    onSettled: () => setPendingId(null),
  });

  const bulkMutation = useMutation({
    mutationFn: (vars: { ids: string[]; workflow?: string | null; status?: string | null }) =>
      bulkFn({ data: vars }),
    onSuccess: ({ updated }) => {
      toast.success(`${updated} case${updated === 1 ? "" : "s"} updated`);
      setSelectedIds(new Set());
      setBulkWorkflow("");
      setBulkStatus("");
      qc.invalidateQueries({ queryKey: ["intake-cases"] });
    },
    onError: (e: Error) => toast.error(`Bulk update failed: ${e.message}`, { duration: 6000 }),
  });

  const hasActiveFilters =
    !!search.q || !!search.agent || !!search.workflow ||
    !!search.status || !!search.dateFrom || !!search.dateTo;

  const resetFilters = () => {
    navigate({
      search: { q: "", agent: "", workflow: "", status: "", dateFrom: "", dateTo: "", page: 1, pageSize: search.pageSize },
      replace: true,
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / search.pageSize));
  const allSelectedOnPage = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await exportFn({ data: filterArgs });
      downloadCsv(rows);
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl">Agent Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalAll} total cases · {total} match filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </button>
          <button
            onClick={() => setSearch({ workflow: "" })}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
          >
            All Cases
          </button>
        </div>
      </div>

      {/* Workflow stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(workflowStats).map(([wf, statuses]) => {
          const count = Object.values(statuses).reduce((a, b) => a + b, 0);
          const active = search.workflow === wf;
          return (
            <button
              key={wf}
              onClick={() => setSearch({ workflow: active ? "" : wf })}
              className={`text-left rounded-lg border p-3 transition ${
                active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
              } ${WORKFLOW_COLORS[wf] ?? "bg-card"}`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                <span className="truncate">{wf}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{count}</div>
              <div className="mt-2 space-y-0.5 text-[11px] opacity-80">
                {Object.entries(statuses).map(([s, n]) => (
                  <div key={s} className="flex justify-between gap-2">
                    <span className="truncate">{s}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
        <div className="rounded-lg border border-border bg-primary/5 p-3">
          <div className="text-xs font-semibold text-muted-foreground">Total Cases</div>
          <div className="text-3xl font-bold mt-1 text-primary">{totalAll}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap gap-3 items-end">
        <Filter className="h-4 w-4 text-muted-foreground self-center" />
        <Input
          placeholder="Search name, case #, status…"
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value })}
          className="max-w-xs"
        />
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Status</div>
          <select
            value={search.status}
            onChange={(e) => setSearch({ status: e.target.value })}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Agent</div>
          <select
            value={search.agent}
            onChange={(e) => setSearch({ agent: e.target.value })}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">All Agents</option>
            {agents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Received from</div>
          <Input type="date" value={search.dateFrom}
            onChange={(e) => setSearch({ dateFrom: e.target.value })} className="h-9 w-[150px]" />
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Received to</div>
          <Input type="date" value={search.dateTo}
            onChange={(e) => setSearch({ dateTo: e.target.value })} className="h-9 w-[150px]" />
        </label>
        {search.workflow && (
          <button
            onClick={() => setSearch({ workflow: "" })}
            className="text-xs px-2 py-1 rounded bg-primary/10 text-primary inline-flex items-center gap-1"
          >
            Workflow: {search.workflow} <X className="h-3 w-3" />
          </button>
        )}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="h-9 text-xs px-3 rounded-md border border-border hover:bg-muted inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Reset filters
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto self-center">
          {isFetching && <Loader2 className="h-3 w-3 inline animate-spin mr-1" />}
          Page {search.page} of {totalPages} · {total} results
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <label className="flex items-center gap-2 text-xs">
            Set workflow:
            <select value={bulkWorkflow} onChange={(e) => setBulkWorkflow(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {WORKFLOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            Set status:
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">—</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button
            disabled={bulkMutation.isPending || (!bulkWorkflow && !bulkStatus)}
            onClick={() =>
              bulkMutation.mutate({
                ids: Array.from(selectedIds),
                workflow: bulkWorkflow || undefined,
                status: bulkStatus || undefined,
              })
            }
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {bulkMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Apply to {selectedIds.size}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-background"
          >
            Clear
          </button>
        </div>
      )}

      {/* Cases table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide">
              <tr>
                <th className="p-2 w-8">
                  <input type="checkbox" checked={allSelectedOnPage} onChange={toggleAllOnPage} />
                </th>
                <th className="p-2 text-left">Case #</th>
                <th className="p-2 text-left">Date Rec</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Notes</th>
                <th className="p-2 text-left">Follow-up</th>
                <th className="p-2 text-left">Workflow</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Agent</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c: IntakeCase) => (
                <tr key={c.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedId(c.id)}>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(c.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        });
                      }} />
                  </td>
                  <td className="p-2 font-mono text-xs">{c.case_id}</td>
                  <td className="p-2 whitespace-nowrap">{c.date_received ?? "—"}</td>
                  <td className="p-2 font-medium">{c.last_name}, {c.first_name}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" /> {c.notes_count}
                    </span>
                  </td>
                  <td className="p-2 whitespace-nowrap">{c.follow_up_date ?? "—"}</td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <select value={c.workflow ?? ""} disabled={pendingId === c.id}
                      onChange={(e) => mutation.mutate({ id: c.id, workflow: e.target.value || null })}
                      className={`text-[11px] px-1.5 py-1 rounded border bg-transparent ${
                        WORKFLOW_COLORS[c.workflow ?? ""] ?? "border-border"
                      }`}>
                      <option value="">—</option>
                      {WORKFLOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <select value={c.status ?? ""} disabled={pendingId === c.id}
                      onChange={(e) => mutation.mutate({ id: c.id, status: e.target.value || null })}
                      className="text-xs px-1.5 py-1 rounded border border-border bg-transparent font-semibold">
                      <option value="">—</option>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-xs">{c.agent ?? "—"}</td>
                  <td className="p-2 text-right w-6">
                    {pendingId === c.id && (
                      <Loader2 className="h-3.5 w-3.5 inline animate-spin text-muted-foreground" />
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-muted-foreground text-sm">
                    No cases match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-3 border-t border-border text-xs">
          <label className="flex items-center gap-2 text-muted-foreground">
            Rows per page
            <select value={search.pageSize}
              onChange={(e) => setSearch({ pageSize: Number(e.target.value) })}
              className="h-8 rounded-md border border-input bg-transparent px-2">
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              disabled={search.page <= 1}
              onClick={() => setSearch({ page: search.page - 1 }, false)}
              className="h-8 px-2 rounded border border-border hover:bg-muted disabled:opacity-40 inline-flex items-center">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="px-2 text-muted-foreground">
              {search.page} / {totalPages}
            </span>
            <button
              disabled={search.page >= totalPages}
              onClick={() => setSearch({ page: search.page + 1 }, false)}
              className="h-8 px-2 rounded border border-border hover:bg-muted disabled:opacity-40 inline-flex items-center">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.last_name}, {selected.first_name}</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Case #{selected.case_id}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-2">
                <Field label="Date Received" value={selected.date_received} />
                <Field label="Phone" value={selected.phone} />
                <Field label="Referral Source" value={selected.ref_source} />
                <Field label="Marketer" value={selected.marketer} />
                <Field label="Follow-up Date" value={selected.follow_up_date} />
                <Field label="Follow Count" value={String(selected.follow_count)} />
                <Field label="Notes Count" value={String(selected.notes_count)} />
                <Field label="Track Count" value={String(selected.track_count)} />
                <Field label="Workflow" value={selected.workflow} />
                <Field label="Status" value={selected.status} />
                <Field label="Status Date" value={selected.status_date} />
                <Field label="Assigned Agent" value={selected.agent} />
              </div>
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick Update
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">Workflow</span>
                    <select value={selected.workflow ?? ""} disabled={pendingId === selected.id}
                      onChange={(e) => mutation.mutate({ id: selected.id, workflow: e.target.value || null })}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                      <option value="">—</option>
                      {WORKFLOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">Status</span>
                    <select value={selected.status ?? ""} disabled={pendingId === selected.id}
                      onChange={(e) => mutation.mutate({ id: selected.id, status: e.target.value || null })}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                      <option value="">—</option>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <CaseTimeline caseId={selected.id} eventsFn={eventsFn} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function CaseTimeline({
  caseId, eventsFn,
}: {
  caseId: string;
  eventsFn: (args: { data: { caseId: string } }) => Promise<IntakeCaseEvent[]>;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["intake-case-events", caseId],
    queryFn: () => eventsFn({ data: { caseId } }),
  });
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        <History className="h-3.5 w-3.5" /> Activity timeline
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="text-sm text-muted-foreground">No changes recorded yet.</div>
      ) : (
        <ol className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {data.map((ev) => (
            <li key={ev.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold capitalize">{ev.field.replace("_", " ")}</span>
                <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-0.5">
                <span className="text-muted-foreground line-through">{ev.old_value ?? "—"}</span>{" "}
                → <span className="font-medium">{ev.new_value ?? "—"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                by {ev.actor_email ?? "system"}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function downloadCsv(rows: IntakeExportRow[]) {
  const headers = [
    "case_id","date_received","first_name","last_name","phone","ref_source","marketer",
    "notes_count","follow_up_date","follow_count","workflow","status","status_date",
    "track_count","agent",
    "last_change_at","last_change_field","last_change_from","last_change_to","last_change_by",
  ] as const;
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc((r as Record<string, unknown>)[h])).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `intake-cases-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}