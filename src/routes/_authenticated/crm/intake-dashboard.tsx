import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listIntakeCases,
  updateIntakeCase,
  listIntakeCaseEvents,
  WORKFLOW_OPTIONS,
  STATUS_OPTIONS,
  type IntakeCase,
  type IntakeCaseEvent,
} from "@/lib/intake-dashboard.functions";
import { Input } from "@/components/ui/input";
import { Filter, FileText, Loader2, X, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/intake-dashboard")({
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
  const fn = useServerFn(listIntakeCases);
  const updateFn = useServerFn(updateIntakeCase);
  const eventsFn = useServerFn(listIntakeCaseEvents);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["intake-cases"], queryFn: () => fn() });
  const [query, setQuery] = useState("");
  const [agent, setAgent] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
      const previous = qc.getQueryData<IntakeCase[]>(["intake-cases"]);
      qc.setQueryData<IntakeCase[]>(["intake-cases"], (prev) =>
        (prev ?? []).map((c) =>
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
      );
      return { previous };
    },
    onSuccess: (row) => {
      qc.setQueryData<IntakeCase[]>(["intake-cases"], (prev) =>
        (prev ?? []).map((c) => (c.id === row.id ? row : c)),
      );
      qc.invalidateQueries({ queryKey: ["intake-case-events", row.id] });
      toast.success("Case updated");
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["intake-cases"], ctx.previous);
      toast.error(`Update failed: ${e.message}`, { duration: 6000 });
    },
    onSettled: () => setPendingId(null),
  });

  const selected = useMemo(
    () => data.find((c) => c.id === selectedId) ?? null,
    [data, selectedId],
  );

  const agents = useMemo(() => {
    const s = new Set<string>();
    data.forEach((c) => c.agent && s.add(c.agent));
    return ["All", ...Array.from(s).sort()];
  }, [data]);

  const workflowGroups = useMemo(() => {
    const groups: Record<string, Record<string, number>> = {};
    data.forEach((c) => {
      const wf = c.workflow || "Unassigned";
      const st = c.status || "—";
      groups[wf] = groups[wf] ?? {};
      groups[wf][st] = (groups[wf][st] ?? 0) + 1;
    });
    return groups;
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return data.filter((c) => {
      if (agent !== "All" && c.agent !== agent) return false;
      if (workflowFilter && c.workflow !== workflowFilter) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (dateFrom && (!c.date_received || c.date_received < dateFrom)) return false;
      if (dateTo && (!c.date_received || c.date_received > dateTo)) return false;
      if (!q) return true;
      return (
        (c.first_name ?? "").toLowerCase().includes(q) ||
        (c.last_name ?? "").toLowerCase().includes(q) ||
        (c.case_id ?? "").toLowerCase().includes(q) ||
        (c.status ?? "").toLowerCase().includes(q) ||
        (c.workflow ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, agent, workflowFilter, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters =
    !!query || agent !== "All" || !!workflowFilter ||
    statusFilter !== "All" || !!dateFrom || !!dateTo;

  const resetFilters = () => {
    setQuery(""); setAgent("All"); setWorkflowFilter(null);
    setStatusFilter("All"); setDateFrom(""); setDateTo("");
  };

  const total = data.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl">Agent Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview & stats — {total} active cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWorkflowFilter(null)}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
          >
            All Cases
          </button>
        </div>
      </div>

      {/* Workflow stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(workflowGroups).map(([wf, statuses]) => {
          const count = Object.values(statuses).reduce((a, b) => a + b, 0);
          const active = workflowFilter === wf;
          return (
            <button
              key={wf}
              onClick={() => setWorkflowFilter(active ? null : wf)}
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
          <div className="text-3xl font-bold mt-1 text-primary">{total}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 self-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Search name, case #, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Status</div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Agent</div>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {agents.map((a) => <option key={a} value={a}>{a === "All" ? "All Agents" : a}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Received from</div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[150px]" />
        </label>
        <label className="text-[11px] text-muted-foreground space-y-1">
          <div>Received to</div>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[150px]" />
        </label>
        {workflowFilter && (
          <button
            onClick={() => setWorkflowFilter(null)}
            className="text-xs px-2 py-1 rounded bg-primary/10 text-primary inline-flex items-center gap-1"
          >
            Workflow: {workflowFilter} <X className="h-3 w-3" />
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
          {filtered.length} of {total}
        </span>
      </div>

      {/* Cases table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide">
              <tr>
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
              {filtered.map((c: IntakeCase) => (
                <tr
                  key={c.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedId(c.id)}
                >
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
                    <select
                      value={c.workflow ?? ""}
                      disabled={pendingId === c.id}
                      onChange={(e) =>
                        mutation.mutate({ id: c.id, workflow: e.target.value || null })
                      }
                      className={`text-[11px] px-1.5 py-1 rounded border bg-transparent ${
                        WORKFLOW_COLORS[c.workflow ?? ""] ?? "border-border"
                      }`}
                    >
                      <option value="">—</option>
                      {WORKFLOW_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={c.status ?? ""}
                      disabled={pendingId === c.id}
                      onChange={(e) =>
                        mutation.mutate({ id: c.id, status: e.target.value || null })
                      }
                      className="text-xs px-1.5 py-1 rounded border border-border bg-transparent font-semibold"
                    >
                      <option value="">—</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
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
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground text-sm">
                    No cases match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.last_name}, {selected.first_name}
                </DialogTitle>
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
                    <select
                      value={selected.workflow ?? ""}
                      disabled={pendingId === selected.id}
                      onChange={(e) =>
                        mutation.mutate({ id: selected.id, workflow: e.target.value || null })
                      }
                      className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">—</option>
                      {WORKFLOW_OPTIONS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">Status</span>
                    <select
                      value={selected.status ?? ""}
                      disabled={pendingId === selected.id}
                      onChange={(e) =>
                        mutation.mutate({ id: selected.id, status: e.target.value || null })
                      }
                      className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">—</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
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
  caseId,
  eventsFn,
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
            <li
              key={ev.id}
              className="text-xs border-l-2 border-primary/40 pl-3 py-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold capitalize">
                  {ev.field.replace("_", " ")}
                </span>
                <span className="text-muted-foreground">
                  {new Date(ev.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5">
                <span className="text-muted-foreground line-through">
                  {ev.old_value ?? "—"}
                </span>{" "}
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