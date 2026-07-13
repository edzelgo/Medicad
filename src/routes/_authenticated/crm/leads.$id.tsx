import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getLead, updateLead, deleteLead, addActivity, myRoles, setLeadPriority, LEAD_PRIORITIES, listLeadDuplicates, mergeLead, getLeadClientProgress } from "@/lib/crm.functions";
import { convertLeadToCase } from "@/lib/cases.functions";
import { listLeadCommunications } from "@/lib/communications.functions";
import { listReferralOrgs, setLeadReferralOrg } from "@/lib/referrals.functions";
import { listLeadCalls, logCall, startCall, CALL_OUTCOMES, CALL_OUTCOME_LABEL } from "@/lib/calls.functions";
import { useCrmOptions } from "@/hooks/use-crm-options";
import { computeLeadScore } from "@/lib/lead-scoring";
import { IntakeForm } from "@/components/crm/intake-form";
import { Mail, MessageSquare, Phone, PhoneCall } from "lucide-react";
import { toast } from "sonner";

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 border-red-300",
  high: "bg-amber-100 text-amber-800 border-amber-300",
  normal: "bg-secondary text-secondary-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
};
const BAND_STYLE: Record<string, string> = {
  hot: "bg-red-100 text-red-800",
  warm: "bg-amber-100 text-amber-800",
  cold: "bg-sky-100 text-sky-800",
};

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
  const setPriority = useServerFn(setLeadPriority);
  const commsFn = useServerFn(listLeadCommunications);
  const orgsFn = useServerFn(listReferralOrgs);
  const setOrgFn = useServerFn(setLeadReferralOrg);
  const dupFn = useServerFn(listLeadDuplicates);
  const merge = useServerFn(mergeLead);
  const { data: comms } = useQuery({
    queryKey: ["crm", "lead", id, "comms"],
    queryFn: () => commsFn({ data: { lead_id: id } }),
  });
  const { data: orgData } = useQuery({ queryKey: ["crm", "referral-orgs"], queryFn: () => orgsFn() });
  const { data: dupes } = useQuery({
    queryKey: ["crm", "lead", id, "dupes"],
    queryFn: () => dupFn({ data: { id } }),
  });
  const clientProgressFn = useServerFn(getLeadClientProgress);
  const { data: clientLink } = useQuery({
    queryKey: ["crm", "lead", id, "client"],
    queryFn: () => clientProgressFn({ data: { id } }),
  });
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
  const priority = (lead as { priority?: string }).priority ?? "normal";
  const referralOrgId = (lead as { referral_org_id?: string | null }).referral_org_id ?? "";
  const scored = computeLeadScore(lead as never);
  const orgs = orgData?.orgs ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">{lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Lead"}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.email ?? ""}
            {lead.phone && (
              <> • <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={`border rounded-md px-3 py-2 text-sm capitalize ${PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.normal}`}
            value={priority}
            onChange={async (e) => {
              try {
                await setPriority({ data: { id, priority: e.target.value as typeof LEAD_PRIORITIES[number] } });
                qc.invalidateQueries({ queryKey: ["crm", "lead", id] });
                qc.invalidateQueries({ queryKey: ["crm", "leads"] });
                toast.success("Priority updated");
              } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
            }}
          >
            {LEAD_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
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

      {/* Referral partner assignment */}
      {orgs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Referral partner</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[220px]"
            value={referralOrgId}
            onChange={async (e) => {
              try {
                await setOrgFn({ data: { lead_id: id, referral_org_id: e.target.value || null } });
                qc.invalidateQueries({ queryKey: ["crm", "lead", id] });
                toast.success("Referral partner updated");
              } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
            }}
          >
            <option value="">— None —</option>
            {orgs.filter((o) => o.active || o.id === referralOrgId).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Linked client portal account (pipeline unification) */}
      {clientLink?.linked && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-medium">Client portal account linked</span>
              <span className="text-muted-foreground"> · {clientLink.email ?? "no email"}</span>
            </div>
            <div className="text-xs tabular-nums text-muted-foreground">
              Documents {clientLink.progress.satisfied}/{clientLink.progress.total} · {clientLink.progress.percent}%
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
            <div className="h-full bg-primary" style={{ width: `${clientLink.progress.percent}%` }} />
          </div>
          {clientLink.progress.missing.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Missing: {clientLink.progress.missing.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Possible duplicates / merge (admin) */}
      {roles?.isAdmin && (dupes ?? []).length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <div className="text-sm font-semibold mb-2">
            {dupes!.length} possible duplicate{dupes!.length === 1 ? "" : "s"}
          </div>
          <ul className="space-y-2">
            {dupes!.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link to="/crm/leads/$id" params={{ id: d.id }} className="font-medium hover:underline">
                  {d.full_name || `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || d.id.slice(0, 8)}
                </Link>
                <span className="text-muted-foreground text-xs">{d.email ?? d.phone ?? ""} · {d.stage}</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={async () => {
                  if (!confirm("Merge this duplicate INTO the current lead? This deletes the duplicate and moves its activity here. This cannot be undone.")) return;
                  try {
                    const res = await merge({ data: { primary_id: id, duplicate_id: d.id } });
                    toast.success(`Merged${res.backfilled ? ` · ${res.backfilled} field(s) filled` : ""}`);
                    qc.invalidateQueries({ queryKey: ["crm", "lead", id] });
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Merge failed"); }
                }}>Merge into this lead</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Lead score */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Lead score</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${BAND_STYLE[scored.band]}`}>
              {scored.band} · {scored.score}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
            <div className="h-full bg-primary" style={{ width: `${scored.score}%` }} />
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {scored.factors.map((f) => (
              <li key={f.label} className="flex justify-between gap-2">
                <span>{f.label}</span><span className="tabular-nums text-foreground">+{f.points}</span>
              </li>
            ))}
            {!scored.factors.length && <li>Not enough data to score yet.</li>}
          </ul>
        </div>

        {/* Communication history */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Communications</h2>
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {(comms ?? []).map((c) => (
              <li key={c.id} className="text-xs border-l-2 border-primary/40 pl-3">
                <div className="flex items-center gap-1.5 font-medium">
                  {c.channel === "sms" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  {c.subject ?? c.kind}
                  {!c.success && <span className="text-red-600">(failed)</span>}
                </div>
                <div className="text-muted-foreground">{c.recipient} • {new Date(c.created_at).toLocaleString()}</div>
              </li>
            ))}
            {!(comms ?? []).length && (
              <li className="text-xs text-muted-foreground">
                No messages sent yet. Emails/SMS appear here after a stage change or assignment.
              </li>
            )}
          </ul>
        </div>
      </div>

      <CallsPanel leadId={id} phone={lead.phone ?? null} />

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

function CallsPanel({ leadId, phone }: { leadId: string; phone: string | null }) {
  const listFn = useServerFn(listLeadCalls);
  const logFn = useServerFn(logCall);
  const startFn = useServerFn(startCall);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["crm", "lead", leadId, "calls"],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });
  const [outcome, setOutcome] = useState<(typeof CALL_OUTCOMES)[number]>("connected");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const calls = data?.calls ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["crm", "lead", leadId, "calls"] });
    qc.invalidateQueries({ queryKey: ["crm", "lead", leadId] });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-semibold">Calls</h2>
        <div className="flex items-center gap-2">
          {phone && (
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              <Phone className="h-3.5 w-3.5" /> Dial {phone}
            </a>
          )}
          {data?.twilioAvailable && phone && (
            <Button size="sm" disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                await startFn({ data: { lead_id: leadId } });
                toast.success("Calling… your phone will ring, then connect to the lead.");
                refresh();
              } catch (e) { toast.error(e instanceof Error ? e.message : "Call failed"); } finally { setBusy(false); }
            }}>
              <PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Call via Twilio
            </Button>
          )}
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2 mb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await logFn({ data: { lead_id: leadId, direction: "outbound", outcome, notes: notes || undefined } });
            setNotes("");
            toast.success("Call logged");
            refresh();
          } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
        }}
      >
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{CALL_OUTCOME_LABEL[o]}</option>)}
        </select>
        <input className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-[180px]"
          placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" size="sm" variant="outline" disabled={busy}>Log call</Button>
      </form>

      <ul className="space-y-2">
        {calls.map((c) => (
          <li key={c.id} className="text-sm border-l-2 border-primary/40 pl-3">
            <div className="flex items-center gap-1.5 font-medium">
              <PhoneCall className="h-3 w-3" />
              {c.direction === "inbound" ? "Inbound" : "Outbound"}
              {c.outcome ? ` — ${CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome}` : ""}
              {c.provider === "twilio" && <span className="text-xs text-muted-foreground">(Twilio)</span>}
            </div>
            {c.notes && <div className="text-muted-foreground">{c.notes}</div>}
            <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
          </li>
        ))}
        {!calls.length && <li className="text-sm text-muted-foreground">No calls logged yet.</li>}
      </ul>
    </div>
  );
}
