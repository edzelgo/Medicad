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
          toast.success("Lead created");
          navigate({ to: "/crm/leads/$id", params: { id: (row as { id: string }).id } });
        } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
      }} />
    </div>
  );
}
