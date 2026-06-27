import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListApplicationPipeline,
  adminListAgents,
  adminUpdateApplicationStatus,
  adminAssignAgent,
  APPLICATION_STAGES,
  APPLICATION_STAGE_LABEL,
  type ApplicationStage,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/pipeline")({
  component: AdminPipeline,
});

const STAGE_ACCENT: Record<ApplicationStage, string> = {
  new_lead: "border-l-sky-500",
  documents_pending: "border-l-amber-500",
  under_review: "border-l-indigo-500",
  submitted_to_medicaid: "border-l-violet-500",
  approved: "border-l-emerald-500",
  denied: "border-l-rose-500",
};

function AdminPipeline() {
  const listFn = useServerFn(adminListApplicationPipeline);
  const agentsFn = useServerFn(adminListAgents);
  const updateStatus = useServerFn(adminUpdateApplicationStatus);
  const assignAgent = useServerFn(adminAssignAgent);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "application-pipeline"],
    queryFn: () => listFn(),
  });
  const { data: agents } = useQuery({
    queryKey: ["admin", "agents"],
    queryFn: () => agentsFn(),
  });

  const [dropTarget, setDropTarget] = useState<ApplicationStage | null>(null);

  async function handleDrop(stage: ApplicationStage, profileId: string, currentStage: ApplicationStage) {
    setDropTarget(null);
    if (stage === currentStage) return;
    await updateStatus({ data: { profile_id: profileId, application_status: stage } });
    qc.invalidateQueries({ queryKey: ["admin", "application-pipeline"] });
    toast.success(`Moved to ${APPLICATION_STAGE_LABEL[stage]}`);
  }

  async function handleAssign(profileId: string, agentId: string) {
    await assignAgent({
      data: { profile_id: profileId, agent_id: agentId === "" ? null : agentId },
    });
    qc.invalidateQueries({ queryKey: ["admin", "application-pipeline"] });
    toast.success("Assigned agent updated");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-2xl">Client application pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Drag a card across stages to move the applicant through the Medicaid workflow.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${data?.length ?? 0} applicant(s)`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {APPLICATION_STAGES.map((stage) => {
          const cards = (data ?? []).filter((p) => p.application_status === stage);
          const isOver = dropTarget === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(stage);
              }}
              onDragLeave={() => setDropTarget((t) => (t === stage ? null : t))}
              onDrop={(e) => {
                const raw = e.dataTransfer.getData("application/json");
                if (!raw) return;
                const { id, from } = JSON.parse(raw) as { id: string; from: ApplicationStage };
                handleDrop(stage, id, from);
              }}
              className={`rounded-lg border bg-muted/40 p-2 min-h-[420px] transition-colors ${
                isOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs uppercase font-semibold tracking-wide text-foreground">
                  {APPLICATION_STAGE_LABEL[stage]}
                </div>
                <Badge variant="outline" className="tabular-nums">{cards.length}</Badge>
              </div>
              <div className="space-y-2">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ id: c.id, from: c.application_status }),
                      )
                    }
                    className={`rounded-md bg-card border border-l-4 ${STAGE_ACCENT[stage]} border-border p-3 text-sm cursor-grab active:cursor-grabbing shadow-sm space-y-2`}
                  >
                    <div className="font-medium truncate">{c.full_name ?? "Unnamed client"}</div>
                    <div className="text-xs text-muted-foreground">
                      Added {new Date(c.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-foreground">
                      Stage: <span className="font-medium">{APPLICATION_STAGE_LABEL[stage]}</span>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                        Assigned agent
                      </label>
                      <select
                        value={c.assigned_agent_id ?? ""}
                        onChange={(e) => handleAssign(c.id, e.target.value)}
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
                {!cards.length && (
                  <div className="text-xs text-muted-foreground text-center py-6 italic">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
