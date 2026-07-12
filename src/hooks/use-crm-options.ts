import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCrmOptions, OPTION_FALLBACKS,
  type CrmOptions, type OptionCategory,
} from "@/lib/settings.functions";

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
 */
export function useCrmOptions() {
  const fn = useServerFn(listCrmOptions);
  const { data } = useQuery({
    queryKey: ["crm", "options"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? FALLBACK;
}
