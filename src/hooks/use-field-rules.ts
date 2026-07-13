import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFieldRules } from "@/lib/field-rules.functions";
import type { FieldRule } from "@/lib/field-rules";

/** Active intake field rules, DB-backed when the field_rules table exists.
 *  Returns [] (form behaves normally) otherwise and while loading. */
export function useFieldRules(): FieldRule[] {
  const fn = useServerFn(listFieldRules);
  const { data } = useQuery({
    queryKey: ["crm", "field-rules"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
  return data?.rules ?? [];
}
