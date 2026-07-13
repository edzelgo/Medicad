import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCrmOptions, OPTION_FALLBACKS,
  type CrmOptions, type OptionCategory,
} from "@/lib/settings.functions";
import { listWorkflowStatusSets } from "@/lib/workflow-config.functions";

const FALLBACK: CrmOptions = {
  options: Object.fromEntries(
    (Object.keys(OPTION_FALLBACKS) as OptionCategory[]).map((c) => [c, [...OPTION_FALLBACKS[c]]]),
  ) as Record<OptionCategory, string[]>,
  editable: false,
};

/**
 * Admin-configurable dropdown options, DB-backed when the workflow_options
 * table exists, falling back to the in-code constants otherwise (and while
 * the query is loading).
 *
 * Also exposes per-workflow status sets (B#15): `statusesFor(workflow, caseType)`
 * returns a workflow-specific status list when one is configured, otherwise the
 * shared category status list.
 */
export function useCrmOptions() {
  const fn = useServerFn(listCrmOptions);
  const setsFn = useServerFn(listWorkflowStatusSets);
  const { data } = useQuery({
    queryKey: ["crm", "options"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: statusSets } = useQuery({
    queryKey: ["crm", "workflow-status-sets"],
    queryFn: () => setsFn(),
    staleTime: 5 * 60 * 1000,
  });
  const opts = data ?? FALLBACK;
  const sets = statusSets?.sets ?? {};

  const statusesFor = (workflow: string | null | undefined, caseType: string | null | undefined): string[] => {
    if (workflow && sets[workflow]?.length) return sets[workflow];
    return caseType === "caregiver" ? opts.options.cg_status : opts.options.medicaid_status;
  };

  return { ...opts, workflowStatuses: sets, statusesFor };
}
