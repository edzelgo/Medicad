import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listCrmOptions, addCrmOption, removeCrmOption,
  OPTION_CATEGORIES, OPTION_CATEGORY_LABEL, type OptionCategory,
} from "@/lib/settings.functions";
import {
  listWorkflowStatusSets, addWorkflowStatus, removeWorkflowStatus,
  listWorkflowRequirements, addWorkflowRequirement, removeWorkflowRequirement,
  listTransitionRules, addTransitionRule, removeTransitionRule,
  RULE_TYPES, RULE_TYPE_LABEL, type RuleType,
} from "@/lib/workflow-config.functions";
import { listFieldRules, addFieldRule, removeFieldRule } from "@/lib/field-rules.functions";
import {
  CONTROLLABLE_FIELDS, CONDITION_FIELDS, OPERATORS, OPERATOR_LABEL, FIELD_ACTIONS,
  type Operator, type FieldAction,
} from "@/lib/field-rules";
import { myRoles } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/settings")({
  component: Settings,
});

function Settings() {
  const listFn = useServerFn(listCrmOptions);
  const addFn = useServerFn(addCrmOption);
  const removeFn = useServerFn(removeCrmOption);
  const me = useServerFn(myRoles);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm", "options"], queryFn: () => listFn() });
  const { data: roles } = useQuery({ queryKey: ["crm", "me"], queryFn: () => me() });
  const isAdmin = !!roles?.isAdmin;
  const editable = !!data?.editable && isAdmin;
  const workflows = [...(data?.options.medicaid_workflow ?? []), ...(data?.options.cg_workflow ?? [])];
  const [drafts, setDrafts] = useState<Partial<Record<OptionCategory, string>>>({});
  const [busyCat, setBusyCat] = useState<OptionCategory | null>(null);

  const mutate = async (action: () => Promise<unknown>, cat: OptionCategory) => {
    setBusyCat(cat);
    try {
      await action();
      qc.invalidateQueries({ queryKey: ["crm", "options"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyCat(null);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl">Settings</h1>
        {editable ? (
          <p className="text-sm text-muted-foreground mt-1">
            Add or remove dropdown options below. Changes apply immediately across the intake dashboard,
            case forms, and reports. Removing an option hides it from dropdowns — existing cases keep their value.
          </p>
        ) : data && !data.editable ? (
          <p className="text-sm text-muted-foreground mt-1">
            Options are read-only until the <code className="text-xs">workflow_options</code> migration is applied
            (sync migrations via Lovable). The lists below are the built-in defaults.
          </p>
        ) : !isAdmin ? (
          <p className="text-sm text-muted-foreground mt-1">Only admins can edit options.</p>
        ) : null}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {OPTION_CATEGORIES.map((cat) => {
          const options = data?.options[cat] ?? [];
          const busy = busyCat === cat;
          return (
            <div key={cat} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold mb-2">{OPTION_CATEGORY_LABEL[cat]}</h2>
              <ul className="text-sm space-y-1">
                {options.map((o) => (
                  <li key={o} className="flex items-center justify-between gap-2 group">
                    <span className="text-muted-foreground">{o}</span>
                    {editable && (
                      <button
                        aria-label={`Remove ${o}`}
                        disabled={busy}
                        onClick={() => mutate(() => removeFn({ data: { category: cat, label: o } }), cat)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
                {!options.length && <li className="text-muted-foreground text-xs">No options.</li>}
              </ul>
              {editable && (
                <form
                  className="flex gap-2 mt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const label = (drafts[cat] ?? "").trim();
                    if (!label) return;
                    mutate(async () => {
                      await addFn({ data: { category: cat, label } });
                      setDrafts((d) => ({ ...d, [cat]: "" }));
                      toast.success(`Added "${label}"`);
                    }, cat);
                  }}
                >
                  <Input
                    placeholder="Add option…"
                    value={drafts[cat] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [cat]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={busy || !(drafts[cat] ?? "").trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <PerWorkflowConfig
        title="Per-workflow status sets"
        hint="Give a specific workflow its own ordered status list. Workflows without a custom set use the shared statuses above."
        workflows={workflows}
        listFn={listWorkflowStatusSets}
        addFn={addWorkflowStatus}
        removeFn={removeWorkflowStatus}
        pick={(d) => d.sets}
        queryKey="workflow-status-sets"
        isAdmin={isAdmin}
      />

      <PerWorkflowConfig
        title="Per-workflow document requirements"
        hint="Define the documents required for each workflow. These appear as a checklist on every case running that workflow."
        workflows={workflows}
        listFn={listWorkflowRequirements}
        addFn={addWorkflowRequirement}
        removeFn={removeWorkflowRequirement}
        pick={(d) => d.reqs}
        queryKey="workflow-requirements"
        isAdmin={isAdmin}
      />

      <TransitionRulesConfig
        workflows={workflows}
        statusesForWorkflow={(wf) =>
          (data?.options.cg_workflow ?? []).includes(wf)
            ? (data?.options.cg_status ?? [])
            : (data?.options.medicaid_status ?? [])
        }
        isAdmin={isAdmin}
      />

      <FieldRulesConfig isAdmin={isAdmin} />
    </div>
  );
}

function FieldRulesConfig({ isAdmin }: { isAdmin: boolean }) {
  const list = useServerFn(listFieldRules);
  const add = useServerFn(addFieldRule);
  const remove = useServerFn(removeFieldRule);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm", "field-rules"], queryFn: () => list() });
  const [field, setField] = useState<string>(CONTROLLABLE_FIELDS[0].key);
  const [action, setAction] = useState<FieldAction>("show");
  const [conditionField, setConditionField] = useState<string>(CONDITION_FIELDS[0].key);
  const [operator, setOperator] = useState<Operator>("equals");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const editable = !!data?.editable && isAdmin;
  const rules = data?.rules ?? [];
  const needsValue = operator !== "truthy" && operator !== "falsy";
  const labelFor = (key: string, catalog: readonly { key: string; label: string }[]) =>
    catalog.find((c) => c.key === key)?.label ?? key;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); qc.invalidateQueries({ queryKey: ["crm", "field-rules"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 max-w-2xl">
      <h2 className="text-sm font-semibold">Conditional intake fields</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
        Show or require an intake field based on another answer — e.g. require “Spouse SSN” when marital status is Married,
        or show the transfer amount only when resources were transferred.
      </p>
      {data && !data.editable && (
        <p className="text-xs text-muted-foreground">Available once the field-rules migration is applied via Lovable.</p>
      )}

      <ul className="text-sm space-y-1 mb-3">
        {rules.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-2 group">
            <span className="text-muted-foreground">
              <span className="uppercase text-[10px] font-semibold text-foreground mr-1">{r.action}</span>
              “{labelFor(r.field, CONTROLLABLE_FIELDS)}” when “{labelFor(r.condition_field, CONDITION_FIELDS)}” {OPERATOR_LABEL[r.operator]}{r.condition_value ? ` “${r.condition_value}”` : ""}
            </span>
            {editable && (
              <button aria-label="Remove rule" disabled={busy}
                onClick={() => run(() => remove({ data: r }))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {!rules.length && <li className="text-muted-foreground text-xs">No conditional rules yet.</li>}
      </ul>

      {editable && (
        <form className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (needsValue && !value.trim()) { toast.error("Enter a value to compare"); return; }
            run(async () => {
              await add({ data: { field, action, condition_field: conditionField, operator, condition_value: needsValue ? value.trim() : null } });
              setValue("");
              toast.success("Rule added");
            });
          }}>
          <select className="h-8 rounded-md border border-input bg-background px-2" value={action} onChange={(e) => setAction(e.target.value as FieldAction)}>
            {FIELD_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="h-8 rounded-md border border-input bg-background px-2" value={field} onChange={(e) => setField(e.target.value)}>
            {CONTROLLABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <span className="text-muted-foreground">when</span>
          <select className="h-8 rounded-md border border-input bg-background px-2" value={conditionField} onChange={(e) => setConditionField(e.target.value)}>
            {CONDITION_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select className="h-8 rounded-md border border-input bg-background px-2" value={operator} onChange={(e) => setOperator(e.target.value as Operator)}>
            {OPERATORS.map((o) => <option key={o} value={o}>{OPERATOR_LABEL[o]}</option>)}
          </select>
          {needsValue && <Input className="h-8 w-40" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />}
          <Button type="submit" size="sm" variant="outline" disabled={busy}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
        </form>
      )}
    </div>
  );
}

function TransitionRulesConfig({
  workflows, statusesForWorkflow, isAdmin,
}: {
  workflows: string[];
  statusesForWorkflow: (wf: string) => string[];
  isAdmin: boolean;
}) {
  const list = useServerFn(listTransitionRules);
  const add = useServerFn(addTransitionRule);
  const remove = useServerFn(removeTransitionRule);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm", "transition-rules"], queryFn: () => list() });
  const [workflow, setWorkflow] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("reason_required");
  const [busy, setBusy] = useState(false);

  const editable = !!data?.editable && isAdmin;
  const active = workflow || workflows[0] || "";
  const statuses = active ? statusesForWorkflow(active) : [];
  const rules = (data?.rules ?? []).filter((r) => r.workflow === active);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); qc.invalidateQueries({ queryKey: ["crm", "transition-rules"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 max-w-2xl">
      <h2 className="text-sm font-semibold">Stage transition rules</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
        Gate status changes: require a reason or a complete checklist to enter a status, or enforce step order.
        Rules are checked when staff change a case's status.
      </p>
      {data && !data.editable && (
        <p className="text-xs text-muted-foreground">Available once the transition-rules migration is applied via Lovable.</p>
      )}
      <div className="flex items-center gap-2 mb-3">
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[220px]"
          value={active} onChange={(e) => { setWorkflow(e.target.value); setTargetStatus(""); }}>
          {workflows.map((w) => <option key={w} value={w}>{w}</option>)}
          {!workflows.length && <option value="">No workflows defined</option>}
        </select>
      </div>

      <ul className="text-sm space-y-1 mb-3">
        {rules.map((r) => (
          <li key={`${r.target_status}-${r.rule_type}`} className="flex items-center justify-between gap-2 group">
            <span className="text-muted-foreground">
              {RULE_TYPE_LABEL[r.rule_type as RuleType]}
              {r.rule_type !== "no_skip" && r.target_status !== "*" && <span className="text-foreground"> → “{r.target_status}”</span>}
            </span>
            {editable && (
              <button aria-label="Remove rule" disabled={busy}
                onClick={() => run(() => remove({ data: { workflow: active, target_status: r.target_status, rule_type: r.rule_type as RuleType } }))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {!rules.length && <li className="text-muted-foreground text-xs">No rules for this workflow.</li>}
      </ul>

      {editable && active && (
        <form className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ruleType !== "no_skip" && !targetStatus) { toast.error("Pick a target status"); return; }
            run(async () => {
              await add({ data: { workflow: active, target_status: ruleType === "no_skip" ? "*" : targetStatus, rule_type: ruleType } });
              setTargetStatus("");
              toast.success("Rule added");
            });
          }}>
          <select className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={ruleType} onChange={(e) => setRuleType(e.target.value as RuleType)}>
            {RULE_TYPES.map((rt) => <option key={rt} value={rt}>{RULE_TYPE_LABEL[rt]}</option>)}
          </select>
          {ruleType !== "no_skip" && (
            <select className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
              <option value="">Target status…</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add rule
          </Button>
        </form>
      )}
    </div>
  );
}

function PerWorkflowConfig({
  title, hint, workflows, listFn, addFn, removeFn, pick, queryKey, isAdmin,
}: {
  title: string;
  hint: string;
  workflows: string[];
  listFn: () => Promise<any>;
  addFn: (a: { data: { workflow: string; label: string } }) => Promise<unknown>;
  removeFn: (a: { data: { workflow: string; label: string } }) => Promise<unknown>;
  pick: (d: any) => Record<string, string[]>;
  queryKey: string;
  isAdmin: boolean;
}) {
  const list = useServerFn(listFn as any);
  const add = useServerFn(addFn as any);
  const remove = useServerFn(removeFn as any);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm", queryKey], queryFn: () => list() });
  const [workflow, setWorkflow] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const map = data ? pick(data) : {};
  const editable = !!data?.editable && isAdmin;
  const active = workflow || workflows[0] || "";
  const items = map[active] ?? [];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); qc.invalidateQueries({ queryKey: ["crm", queryKey] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 max-w-2xl">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">{hint}</p>
      {data && !data.editable && (
        <p className="text-xs text-muted-foreground">Available once the workflow-engine migration is applied via Lovable.</p>
      )}
      <div className="flex items-center gap-2 mb-3">
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[240px]"
          value={active} onChange={(e) => setWorkflow(e.target.value)}>
          {workflows.map((w) => <option key={w} value={w}>{w}</option>)}
          {!workflows.length && <option value="">No workflows defined</option>}
        </select>
        <span className="text-xs text-muted-foreground">{items.length} item(s)</span>
      </div>
      <ul className="text-sm space-y-1">
        {items.map((it) => (
          <li key={it} className="flex items-center justify-between gap-2 group">
            <span className="text-muted-foreground">{it}</span>
            {editable && (
              <button aria-label={`Remove ${it}`} disabled={busy}
                onClick={() => run(() => remove({ data: { workflow: active, label: it } }))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="text-muted-foreground text-xs">Nothing configured for this workflow.</li>}
      </ul>
      {editable && active && (
        <form className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const label = draft.trim();
            if (!label) return;
            run(async () => { await add({ data: { workflow: active, label } }); setDraft(""); toast.success(`Added "${label}"`); });
          }}>
          <Input placeholder="Add…" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 text-sm" />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !draft.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
    </div>
  );
}
