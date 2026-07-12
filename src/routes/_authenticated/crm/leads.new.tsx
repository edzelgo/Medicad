import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { IntakeForm } from "@/components/crm/intake-form";
import { createLead } from "@/lib/crm.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/leads/new")({
  component: NewLead,
});

function NewLead() {
  const create = useServerFn(createLead);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="font-serif text-2xl">New intake</h1>
      <IntakeForm busy={busy} onSubmit={async (v) => {
        setBusy(true);
        try {
          const row = await create({ data: v as never });
          const dupes = (row as { possibleDuplicates?: unknown[] }).possibleDuplicates ?? [];
          if (dupes.length) {
            toast.warning(`Lead created — ${dupes.length} possible duplicate(s) found. Check the lead's activity log.`, { duration: 8000 });
          } else {
            toast.success("Lead created");
          }
          navigate({ to: "/crm/leads/$id", params: { id: (row as { id: string }).id } });
        } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
      }} />
    </div>
  );
}
