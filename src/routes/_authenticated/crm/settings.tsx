import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listCrmOptions, addCrmOption, removeCrmOption,
  OPTION_CATEGORIES, OPTION_CATEGORY_LABEL, type OptionCategory,
} from "@/lib/settings.functions";
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
    </div>
  );
}
