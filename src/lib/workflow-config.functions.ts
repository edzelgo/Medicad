import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { STATUS_OPTIONS } from "@/lib/intake-dashboard.functions";
import { CG_STATUS_OPTIONS } from "@/lib/intake-options";
import { z } from "zod";

// New tables aren't in the generated Database types until the next Lovable
// type sync — access them untyped until then.
function tbl(client: unknown, name: string) {
  return ((client as { from: (t: string) => any }).from)(name);
}

// ---------------------------------------------------------------------------
// B#15 — per-workflow status sets
// ---------------------------------------------------------------------------

/** Map of workflow label -> ordered active status labels. Empty when the table
 *  is missing; consumers then fall back to the shared category status list. */
export const listWorkflowStatusSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sets: Record<string, string[]>; editable: boolean }> => {
    await assertStaff(context);
    const { data, error } = await tbl(context.supabase, "workflow_status_sets")
      .select("workflow, label, sort_order, active")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }) as { data: any[] | null; error: any };
    if (error) return { sets: {}, editable: false };
    const sets: Record<string, string[]> = {};
    for (const r of data ?? []) {
      if (!r.active) continue;
      (sets[r.workflow] ??= []).push(r.label);
    }
    return { sets, editable: true };
  });

const wfLabel = z.object({
  workflow: z.string().trim().min(1).max(150),
  label: z.string().trim().min(1).max(150),
});

export const addWorkflowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => wfLabel.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tbl(supabaseAdmin, "workflow_status_sets").upsert(
      { workflow: data.workflow, label: data.label, sort_order: 999, active: true },
      { onConflict: "workflow,label" },
    ) as { error: any };
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Workflow config isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to add status.");
    }
    return { ok: true };
  });

export const removeWorkflowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => wfLabel.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tbl(supabaseAdmin, "workflow_status_sets")
      .update({ active: false }).eq("workflow", data.workflow).eq("label", data.label) as { error: any };
    if (error) throw new Error("Failed to remove status.");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// B#17 — per-workflow document requirement definitions
// ---------------------------------------------------------------------------

export const listWorkflowRequirements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ reqs: Record<string, string[]>; editable: boolean }> => {
    await assertStaff(context);
    const { data, error } = await tbl(context.supabase, "workflow_requirements")
      .select("workflow, label, sort_order, active")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }) as { data: any[] | null; error: any };
    if (error) return { reqs: {}, editable: false };
    const reqs: Record<string, string[]> = {};
    for (const r of data ?? []) {
      if (!r.active) continue;
      (reqs[r.workflow] ??= []).push(r.label);
    }
    return { reqs, editable: true };
  });

export const addWorkflowRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => wfLabel.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tbl(supabaseAdmin, "workflow_requirements").upsert(
      { workflow: data.workflow, label: data.label, sort_order: 999, active: true },
      { onConflict: "workflow,label" },
    ) as { error: any };
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Workflow config isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to add requirement.");
    }
    return { ok: true };
  });

export const removeWorkflowRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => wfLabel.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tbl(supabaseAdmin, "workflow_requirements")
      .update({ active: false }).eq("workflow", data.workflow).eq("label", data.label) as { error: any };
    if (error) throw new Error("Failed to remove requirement.");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// B#17 — per-case checklist (definitions joined with tick-off state)
// ---------------------------------------------------------------------------

export type CaseChecklistItem = { label: string; satisfied: boolean };
export type CaseChecklist = {
  available: boolean;
  workflows: { workflow: string; items: CaseChecklistItem[]; satisfied: number; total: number }[];
};

export const getCaseChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ case_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CaseChecklist> => {
    await assertStaff(context);
    // Distinct workflows on this case's tracks.
    const { data: tracks } = await context.supabase
      .from("case_tracks").select("workflow").eq("case_id", data.case_id);
    const workflows = Array.from(new Set((tracks ?? []).map((t) => t.workflow).filter(Boolean))) as string[];
    if (!workflows.length) return { available: true, workflows: [] };

    const { data: reqRows, error: reqErr } = await tbl(context.supabase, "workflow_requirements")
      .select("workflow, label, active")
      .in("workflow", workflows) as { data: any[] | null; error: any };
    if (reqErr) return { available: false, workflows: [] };

    const { data: checks } = await tbl(context.supabase, "case_requirement_checks")
      .select("requirement_label, satisfied").eq("case_id", data.case_id) as { data: any[] | null };
    const checked = new Map((checks ?? []).map((c) => [c.requirement_label, c.satisfied]));

    const byWorkflow: Record<string, CaseChecklistItem[]> = {};
    for (const r of reqRows ?? []) {
      if (!r.active) continue;
      (byWorkflow[r.workflow] ??= []).push({ label: r.label, satisfied: !!checked.get(r.label) });
    }
    return {
      available: true,
      workflows: workflows
        .filter((w) => byWorkflow[w]?.length)
        .map((w) => {
          const items = byWorkflow[w];
          return { workflow: w, items, satisfied: items.filter((i) => i.satisfied).length, total: items.length };
        }),
    };
  });

export const toggleCaseRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    case_id: z.string().uuid(),
    requirement_label: z.string().trim().min(1).max(150),
    satisfied: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await tbl(context.supabase, "case_requirement_checks").upsert(
      {
        case_id: data.case_id,
        requirement_label: data.requirement_label,
        satisfied: data.satisfied,
        checked_by: context.userId,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "case_id,requirement_label" },
    ) as { error: any };
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Workflow config isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to update checklist.");
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// B#19 — stage transition rules
// ---------------------------------------------------------------------------

export const RULE_TYPES = ["reason_required", "checklist_complete", "no_skip"] as const;
export type RuleType = (typeof RULE_TYPES)[number];
export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  reason_required: "Require a reason to enter this status",
  checklist_complete: "Require the document checklist to be complete",
  no_skip: "Enforce step order (no skipping ahead)",
};

export type TransitionRule = { workflow: string; target_status: string; rule_type: RuleType };

export const listTransitionRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rules: TransitionRule[]; editable: boolean }> => {
    await assertStaff(context);
    const { data, error } = await tbl(context.supabase, "workflow_transition_rules")
      .select("workflow, target_status, rule_type, active")
      .order("workflow", { ascending: true }) as { data: any[] | null; error: any };
    if (error) return { rules: [], editable: false };
    return {
      rules: (data ?? []).filter((r) => r.active).map((r) => ({
        workflow: r.workflow, target_status: r.target_status, rule_type: r.rule_type,
      })),
      editable: true,
    };
  });

const ruleSchema = z.object({
  workflow: z.string().trim().min(1).max(150),
  target_status: z.string().trim().min(1).max(150),
  rule_type: z.enum(RULE_TYPES),
});

export const addTransitionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ruleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // no_skip is workflow-wide; pin it to '*' regardless of the picked status.
    const target = data.rule_type === "no_skip" ? "*" : data.target_status;
    const { error } = await tbl(supabaseAdmin, "workflow_transition_rules").upsert(
      { workflow: data.workflow, target_status: target, rule_type: data.rule_type, active: true },
      { onConflict: "workflow,target_status,rule_type" },
    ) as { error: any };
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Workflow config isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to add rule.");
    }
    return { ok: true };
  });

export const removeTransitionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ruleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await tbl(supabaseAdmin, "workflow_transition_rules")
      .update({ active: false })
      .eq("workflow", data.workflow).eq("target_status", data.target_status).eq("rule_type", data.rule_type) as { error: any };
    if (error) throw new Error("Failed to remove rule.");
    return { ok: true };
  });

/**
 * Server-only evaluator (not a server fn). Returns { ok:false, message } when a
 * status change violates a configured rule. Fail-open: if the rules table is
 * missing, or data can't be resolved, the transition is allowed.
 */
export async function evaluateTransition(
  supabase: unknown,
  args: {
    workflow: string | null | undefined;
    caseId: string;
    caseType: string | null | undefined;
    currentStatus: string | null | undefined;
    newStatus: string;
    reason: string | null | undefined;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { workflow } = args;
  if (!workflow) return { ok: true };

  const { data: rules, error } = await tbl(supabase, "workflow_transition_rules")
    .select("target_status, rule_type, active")
    .eq("workflow", workflow) as { data: any[] | null; error: any };
  if (error) return { ok: true }; // table missing → no rules
  const active = (rules ?? []).filter((r) => r.active);
  if (!active.length) return { ok: true };

  const applies = (r: any) => r.target_status === args.newStatus || r.target_status === "*";

  for (const r of active.filter(applies)) {
    if (r.rule_type === "reason_required" && r.target_status === args.newStatus) {
      if (!args.reason || !args.reason.trim()) {
        return { ok: false, message: `A reason is required to set status "${args.newStatus}". Open the case and add a reason before changing the status.` };
      }
    }
    if (r.rule_type === "checklist_complete" && r.target_status === args.newStatus) {
      const { data: reqs } = await tbl(supabase, "workflow_requirements")
        .select("label, active").eq("workflow", workflow) as { data: any[] | null };
      const required = (reqs ?? []).filter((x) => x.active).map((x) => x.label);
      if (required.length) {
        const { data: checks } = await tbl(supabase, "case_requirement_checks")
          .select("requirement_label, satisfied").eq("case_id", args.caseId) as { data: any[] | null };
        const done = new Set((checks ?? []).filter((c) => c.satisfied).map((c) => c.requirement_label));
        const missing = required.filter((l) => !done.has(l));
        if (missing.length) {
          return { ok: false, message: `Complete the "${workflow}" document checklist before moving to "${args.newStatus}". Missing: ${missing.join(", ")}.` };
        }
      }
    }
    if (r.rule_type === "no_skip") {
      const { data: sets } = await tbl(supabase, "workflow_status_sets")
        .select("label, active, sort_order").eq("workflow", workflow)
        .order("sort_order", { ascending: true }) as { data: any[] | null };
      const list = (sets ?? []).filter((s) => s.active).map((s) => s.label);
      const ordered = list.length
        ? list
        : [...(args.caseType === "caregiver" ? CG_STATUS_OPTIONS : STATUS_OPTIONS)];
      const from = ordered.indexOf(args.currentStatus ?? "");
      const to = ordered.indexOf(args.newStatus);
      // Only guard forward jumps; backward moves (corrections/reopen) are allowed.
      if (from >= 0 && to >= 0 && to > from + 1) {
        return { ok: false, message: `You can't skip ahead to "${args.newStatus}". Move to "${ordered[from + 1]}" first.` };
      }
    }
  }
  return { ok: true };
}
