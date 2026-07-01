import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listIntakeCases, type IntakeCase } from "@/lib/intake-dashboard.functions";
import { Input } from "@/components/ui/input";
import { Filter, ExternalLink, FileText } from "lucide-react";

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
  const { data = [] } = useQuery({ queryKey: ["intake-cases"], queryFn: () => fn() });
  const [query, setQuery] = useState("");
  const [agent, setAgent] = useState("All");
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null);

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
      if (!q) return true;
      return (
        (c.first_name ?? "").toLowerCase().includes(q) ||
        (c.last_name ?? "").toLowerCase().includes(q) ||
        (c.case_id ?? "").toLowerCase().includes(q) ||
        (c.status ?? "").toLowerCase().includes(q) ||
        (c.workflow ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, agent, workflowFilter]);

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
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, case #, status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {agents.map((a) => <option key={a} value={a}>{a === "All" ? "All Agents" : a}</option>)}
        </select>
        {workflowFilter && (
          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
            Workflow: {workflowFilter} ×
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
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
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-2 font-mono text-xs">{c.case_id}</td>
                  <td className="p-2 whitespace-nowrap">{c.date_received ?? "—"}</td>
                  <td className="p-2 font-medium">{c.last_name}, {c.first_name}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" /> {c.notes_count}
                    </span>
                  </td>
                  <td className="p-2 whitespace-nowrap">{c.follow_up_date ?? "—"}</td>
                  <td className="p-2">
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded border ${WORKFLOW_COLORS[c.workflow ?? ""] ?? "bg-muted"}`}>
                      {c.workflow ?? "—"}
                    </span>
                  </td>
                  <td className="p-2 text-xs font-semibold">{c.status ?? "—"}</td>
                  <td className="p-2 text-xs">{c.agent ?? "—"}</td>
                  <td className="p-2 text-right">
                    <ExternalLink className="h-3.5 w-3.5 inline text-muted-foreground" />
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
    </div>
  );
}