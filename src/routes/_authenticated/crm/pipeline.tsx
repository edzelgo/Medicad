import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listLeads, updateLead } from "@/lib/crm.functions";
import { adminListAgents } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/pipeline")({
  component: Pipeline,
});

const STAGES = ["new","intake","screening","application","submitted","approved","denied","closed"] as const;

function Pipeline() {
  const fn = useServerFn(listLeads);
  const upd = useServerFn(updateLead);
  const agentsFn = useServerFn(adminListAgents);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["crm", "leads", "pipeline"],
    queryFn: () => fn({ data: { page: 1, pageSize: 200 } }),
  });
  const { data: agents } = useQuery({ queryKey: ["admin", "agents"], queryFn: () => agentsFn() });
  const leads = data?.rows ?? [];
  const agentName = useMemo(
    () => new Map((agents ?? []).map((a) => [a.id, a.full_name ?? a.id.slice(0, 8)])),
    [agents],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The single lead pipeline. Drag a card to change stage (the client is notified) or assign an agent.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {STAGES.map((s) => {
          const cards = leads.filter((l) => l.stage === s);
          return (
            <div key={s}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (!id) return;
                await upd({ data: { id, patch: { stage: s } } });
                qc.invalidateQueries({ queryKey: ["crm"] });
                toast.success(`Moved to ${s}`);
              }}
              className="bg-muted/40 rounded-lg p-2 min-h-[300px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs uppercase font-semibold text-muted-foreground">{s}</div>
                <span className="text-xs tabular-nums text-muted-foreground">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.map((l) => (
                  <div key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                    className="rounded-md bg-card border border-border p-2 text-sm cursor-grab active:cursor-grabbing shadow-sm space-y-2">
                    <div className="font-medium truncate">{l.full_name || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.email ?? l.phone ?? ""}</div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-0.5">Agent</label>
                      <select
                        value={l.assigned_to ?? ""}
                        onChange={async (e) => {
                          await upd({ data: { id: l.id, patch: { assigned_to: e.target.value || null } } });
                          qc.invalidateQueries({ queryKey: ["crm"] });
                          toast.success(e.target.value ? `Assigned to ${agentName.get(e.target.value) ?? "agent"}` : "Unassigned");
                        }}
                        className="w-full text-xs rounded border border-border bg-background px-1.5 py-1"
                      >
                        <option value="">— unassigned —</option>
                        {(agents ?? []).map((a) => (
                          <option key={a.id} value={a.id}>{a.full_name ?? a.id.slice(0, 8)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {!cards.length && <div className="text-xs text-muted-foreground text-center py-6 italic">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
