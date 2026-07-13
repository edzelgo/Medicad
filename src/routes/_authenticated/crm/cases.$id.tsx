import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCaseDetail, updateCaseDemographics, addCaseTrack } from "@/lib/cases.functions";
import { updateIntakeCase } from "@/lib/intake-dashboard.functions";
import { getCaseChecklist, toggleCaseRequirement } from "@/lib/workflow-config.functions";
import { CaseForm, type CaseFormValues } from "@/components/crm/case-form";
import { useCrmOptions } from "@/hooks/use-crm-options";
import { isTerminalStatus } from "@/lib/workflow-progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Plus, CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/cases/$id")({
  component: CaseDetail,
});

function CaseDetail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getCaseDetail);
  const updateDemoFn = useServerFn(updateCaseDemographics);
  const addTrackFn = useServerFn(addCaseTrack);
  const updateTrackFn = useServerFn(updateIntakeCase);
  const checklistFn = useServerFn(getCaseChecklist);
  const toggleReqFn = useServerFn(toggleCaseRequirement);
  const qc = useQueryClient();
  const queryKey = ["crm", "case", id] as const;
  const { data } = useQuery({ queryKey, queryFn: () => getFn({ data: { id } }) });
  const { data: checklist } = useQuery({
    queryKey: ["crm", "case", id, "checklist"],
    queryFn: () => checklistFn({ data: { case_id: id } }),
  });
  const [savingDemo, setSavingDemo] = useState(false);
  const [addingTrack, setAddingTrack] = useState(false);
  const [newTrackWorkflow, setNewTrackWorkflow] = useState("");
  const { options, statusesFor } = useCrmOptions();

  if (!data) return <div>Loading…</div>;
  const { case: c, tracks, events } = data;
  const workflowOptions = c.case_type === "caregiver" ? options.cg_workflow : options.medicaid_workflow;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">{c.last_name}, {c.first_name}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            Case #{c.case_number} · <span className="capitalize">{c.case_type}</span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Workflows</h2>
        <div className="space-y-3">
          {tracks.map((t) => {
            const terminal = isTerminalStatus(t.status);
            return (
            <div key={t.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{t.workflow ?? "—"}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {t.status_date ? `Updated ${t.status_date}` : null}{t.agent ? ` · Agent: ${t.agent}` : ""}
                  </div>
                  {terminal && (
                    <Button size="sm" variant="outline" className="h-7"
                      onClick={async () => {
                        const reason = window.prompt("Reopen / file appeal — reason (e.g. requesting Fair Hearing):", "Appeal filed");
                        if (reason === null) return;
                        const active = statusesFor(t.workflow, c.case_type).find((s) => /hearing|pending|corrective|gathering/i.test(s))
                          ?? statusesFor(t.workflow, c.case_type)[0];
                        await updateTrackFn({ data: { id: t.id, status: active, status_reason: reason.trim() || "Reopened" } });
                        qc.invalidateQueries({ queryKey });
                        toast.success(`Reopened → ${active}`);
                      }}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reopen / appeal
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={t.status ?? ""}
                  onChange={async (e) => {
                    await updateTrackFn({ data: { id: t.id, status: e.target.value || null } });
                    qc.invalidateQueries({ queryKey });
                    toast.success("Status updated");
                  }}
                >
                  <option value="">Status —</option>
                  {statusesFor(t.workflow, c.case_type).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  placeholder="Agent"
                  defaultValue={t.agent ?? ""}
                  onBlur={async (e) => {
                    if (e.target.value === (t.agent ?? "")) return;
                    await updateTrackFn({ data: { id: t.id, agent: e.target.value || null } });
                    qc.invalidateQueries({ queryKey });
                    toast.success("Agent updated");
                  }}
                />
                <div className="text-xs text-muted-foreground self-center">
                  Ref: {t.ref_source ?? "—"} · Marketer: {t.marketer ?? "—"}
                </div>
              </div>
            </div>
            );
          })}
          {!tracks.length && <div className="text-sm text-muted-foreground">No workflows assigned.</div>}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          {addingTrack ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={newTrackWorkflow} onValueChange={setNewTrackWorkflow}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Choose a workflow…" /></SelectTrigger>
                <SelectContent>
                  {workflowOptions.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!newTrackWorkflow}
                onClick={async () => {
                  await addTrackFn({ data: { case_id: id, workflow: newTrackWorkflow } });
                  setAddingTrack(false);
                  setNewTrackWorkflow("");
                  qc.invalidateQueries({ queryKey });
                  toast.success("Workflow added");
                }}
              >
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingTrack(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddingTrack(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add workflow track
            </Button>
          )}
        </div>
      </div>

      {checklist?.available && checklist.workflows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Document checklist</h2>
          <div className="space-y-4">
            {checklist.workflows.map((wf) => (
              <div key={wf.workflow}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-medium">{wf.workflow}</div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {wf.satisfied}/{wf.total} · {Math.round((wf.satisfied / Math.max(1, wf.total)) * 100)}%
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full bg-primary" style={{ width: `${Math.round((wf.satisfied / Math.max(1, wf.total)) * 100)}%` }} />
                </div>
                <ul className="space-y-1">
                  {wf.items.map((it) => (
                    <li key={it.label}>
                      <button
                        className="flex items-center gap-2 text-sm text-left hover:text-primary"
                        onClick={async () => {
                          try {
                            await toggleReqFn({ data: { case_id: id, requirement_label: it.label, satisfied: !it.satisfied } });
                            qc.invalidateQueries({ queryKey: ["crm", "case", id, "checklist"] });
                          } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                        }}
                      >
                        {it.satisfied
                          ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className={it.satisfied ? "line-through text-muted-foreground" : ""}>{it.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Requirement lists are configured per workflow in Settings.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Main Info</h2>
        <CaseForm
          mode="edit"
          submitLabel="Save changes"
          busy={savingDemo}
          initial={{
            case_type: c.case_type as "medicaid" | "caregiver",
            first_name: c.first_name ?? "", middle_name: c.middle_name ?? undefined, last_name: c.last_name ?? "",
            dob: c.dob ?? undefined, ssn: c.ssn ?? undefined,
            phone_cell: c.phone_cell ?? undefined, phone_home: c.phone_home ?? undefined, phone_other: c.phone_other ?? undefined,
            address1: c.address1 ?? undefined, apartment: c.apartment ?? undefined, city: c.city ?? undefined,
            county: c.county ?? undefined, state: c.state ?? undefined, zip: c.zip ?? undefined,
            veteran_status: c.veteran_status ?? undefined, marital_status: c.marital_status ?? undefined,
            spouse_first_name: c.spouse_first_name ?? undefined, spouse_last_name: c.spouse_last_name ?? undefined,
            spouse_dob: c.spouse_dob ?? undefined, spouse_ssn: c.spouse_ssn ?? undefined,
            responsible_party_name: c.responsible_party_name ?? undefined,
            responsible_party_phone: c.responsible_party_phone ?? undefined,
            responsible_party_email: c.responsible_party_email ?? undefined,
            meets_asset_requirements: c.meets_asset_requirements ?? undefined,
            months_until_spend_down: c.months_until_spend_down ?? undefined,
            transferred_resources_60mo: c.transferred_resources_60mo ?? undefined,
            transfer_amount: c.transfer_amount ?? undefined,
            brochure_provided: c.brochure_provided ?? [],
          }}
          onSubmit={async (v) => {
            setSavingDemo(true);
            try {
              await updateDemoFn({ data: { id, patch: v as CaseFormValues } });
              qc.invalidateQueries({ queryKey });
              toast.success("Case saved");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed");
            } finally {
              setSavingDemo(false);
            }
          }}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          <History className="h-3.5 w-3.5" /> Activity timeline
        </div>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">No changes recorded yet.</div>
        ) : (
          <ol className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {events.map((ev) => (
              <li key={ev.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold capitalize">{ev.field.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-0.5">
                  <span className="text-muted-foreground line-through">{ev.old_value ?? "—"}</span>{" "}
                  → <span className="font-medium">{ev.new_value ?? "—"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">by {ev.actor_email ?? "system"}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
