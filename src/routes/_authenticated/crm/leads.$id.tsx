import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getLead, updateLead, deleteLead, addActivity, myRoles } from "@/lib/crm.functions";
import { convertLeadToCase } from "@/lib/cases.functions";
import { useCrmOptions } from "@/hooks/use-crm-options";
import { IntakeForm } from "@/components/crm/intake-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/leads/$id")({
  component: LeadDetail,
});

const STAGES = ["new","intake","screening","application","submitted","approved","denied","closed"] as const;

function LeadDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getLead);
  const upd = useServerFn(updateLead);
  const del = useServerFn(deleteLead);
  const add = useServerFn(addActivity);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["crm", "lead", id], queryFn: () => get({ data: { id } }) });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const convert = useServerFn(convertLeadToCase);
  const { options } = useCrmOptions();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertType, setConvertType] = useState<"medicaid" | "caregiver">("medicaid");
  const [convertWorkflow, setConvertWorkflow] = useState("");
  const [converting, setConverting] = useState(false);

  if (!data) return <div>Loading…</div>;
  const { lead, activities } = data;
  const convertWorkflows = convertType === "caregiver" ? options.cg_workflow : options.medicaid_workflow;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">{lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Lead"}</h1>
          <p className="text-sm text-muted-foreground">{lead.email ?? ""} {lead.phone ? `• ${lead.phone}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border border-input rounded-md px-3 py-2 text-sm bg-background" value={lead.stage} onChange={async (e) => {
            await upd({ data: { id, patch: { stage: e.target.value as typeof STAGES[number] } } });
            qc.invalidateQueries({ queryKey: ["crm"] });
            toast.success("Stage updated");
          }}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="outline" onClick={() => setConvertOpen(true)}>Convert to case</Button>
          {roles?.isAdmin && (
            <Button variant="destructive" onClick={async () => {
              if (!confirm("Delete this lead?")) return;
              await del({ data: { id } }); toast.success("Deleted"); navigate({ to: "/crm/leads" });
            }}>Delete</Button>
          )}
        </div>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert lead to case</DialogTitle>
            <DialogDescription>
              Creates a full case with an initial workflow track and closes this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["medicaid", "caregiver"] as const).map((t) => (
                <button type="button" key={t}
                  onClick={() => { setConvertType(t); setConvertWorkflow(""); }}
                  className={`px-3 py-1.5 rounded-md text-sm border capitalize ${convertType === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                  {t}
                </button>
              ))}
            </div>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={convertWorkflow}
              onChange={(e) => setConvertWorkflow(e.target.value)}
            >
              <option value="">Select workflow…</option>
              {convertWorkflows.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <Button
              className="w-full"
              disabled={!convertWorkflow || converting}
              onClick={async () => {
                setConverting(true);
                try {
                  const res = await convert({ data: { lead_id: id, workflow: convertWorkflow, case_type: convertType } });
                  toast.success(`Case #${res.case_number} created`);
                  qc.invalidateQueries({ queryKey: ["crm"] });
                  navigate({ to: "/crm/cases/$id", params: { id: res.case_id } });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Conversion failed");
                } finally {
                  setConverting(false);
                }
              }}
            >
              {converting ? "Converting…" : "Create case"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold mb-3">Activity</h2>
        <div className="flex gap-2 mb-4">
          <Textarea rows={2} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button disabled={!note.trim() || busy} onClick={async () => {
            setBusy(true);
            try { await add({ data: { lead_id: id, content: note.trim() } }); setNote(""); qc.invalidateQueries({ queryKey: ["crm", "lead", id] }); } finally { setBusy(false); }
          }}>Add</Button>
        </div>
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="text-sm border-l-2 border-primary pl-3">
              <div>{a.content}</div>
              <div className="text-xs text-muted-foreground">{a.type} • {new Date(a.created_at).toLocaleString()}</div>
            </li>
          ))}
          {!activities.length && <li className="text-sm text-muted-foreground">No activity.</li>}
        </ul>
      </div>

      <IntakeForm
        submitLabel="Save changes"
        initial={{
          first_name: lead.first_name ?? "",
          last_name: lead.last_name ?? "",
          middle_initial: lead.middle_initial ?? undefined,
          email: lead.email ?? undefined, phone: lead.phone ?? undefined,
          address: lead.address ?? undefined, state: lead.state ?? undefined, zip: lead.zip ?? undefined,
          dob: lead.dob ?? undefined, ssn: lead.ssn ?? undefined, source: lead.source ?? undefined,
          referral_status: lead.referral_status ?? undefined, veteran_status: lead.veteran_status ?? undefined,
          marital_status: lead.marital_status ?? undefined,
          spouse_first_name: lead.spouse_first_name ?? undefined, spouse_last_name: lead.spouse_last_name ?? undefined,
          spouse_dob: lead.spouse_dob ?? undefined, spouse_ssn: lead.spouse_ssn ?? undefined,
          has_lri: !!lead.has_lri, lri_first_name: lead.lri_first_name ?? undefined, lri_last_name: lead.lri_last_name ?? undefined,
          lri_phone: lead.lri_phone ?? undefined, lri_email: lead.lri_email ?? undefined, lri_status: lead.lri_status ?? undefined,
          spend_down_completed: lead.spend_down_completed ?? undefined,
          transferred_resources_60mo: lead.transferred_resources_60mo ?? undefined,
          transfer_amount: lead.transfer_amount ?? undefined,
          retroactive_required: lead.retroactive_required ?? undefined,
          date_first_coverage: lead.date_first_coverage ?? undefined,
          estimated_spend_down_remaining: lead.estimated_spend_down_remaining ?? undefined,
          brochure_provided: lead.brochure_provided ?? [],
          household_size: lead.household_size ?? undefined,
          monthly_income: lead.monthly_income ?? undefined,
          notes: lead.notes ?? undefined,
        }}
        onSubmit={async (v) => {
          await upd({ data: { id, patch: v as never } });
          qc.invalidateQueries({ queryKey: ["crm", "lead", id] });
          toast.success("Lead saved");
        }}
      />
    </div>
  );
}
