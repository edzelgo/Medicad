import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLeads, updateLead } from "@/lib/crm.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/pipeline")({
  component: Pipeline,
});

const STAGES = ["new","intake","screening","application","submitted","approved","denied","closed"] as const;

function Pipeline() {
  const fn = useServerFn(listLeads);
  const upd = useServerFn(updateLead);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["crm", "leads", "pipeline"],
    queryFn: () => fn({ data: { page: 1, pageSize: 200 } }),
  });
  const leads = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">Pipeline</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {STAGES.map((s) => (
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
            <div className="text-xs uppercase font-semibold text-muted-foreground mb-2 px-1">{s}</div>
            <div className="space-y-2">
              {leads.filter((l) => l.stage === s).map((l) => (
                <div key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                  className="rounded-md bg-card border border-border p-2 text-sm cursor-grab active:cursor-grabbing shadow-sm">
                  <div className="font-medium truncate">{l.full_name || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.email ?? l.phone ?? ""}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
