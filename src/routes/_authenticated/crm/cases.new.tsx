import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CaseForm, type NewCaseValues } from "@/components/crm/case-form";
import { createCase } from "@/lib/cases.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/cases/new")({
  component: NewCase,
});

function NewCase() {
  const create = useServerFn(createCase);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="font-serif text-2xl">Add New Case</h1>
      <CaseForm
        mode="create"
        submitLabel="Add Case"
        onSubmit={async (v) => {
          setBusy(true);
          try {
            const row = await create({ data: v as NewCaseValues });
            toast.success(`Case ${row.case_number} created`);
            navigate({ to: "/crm/cases/$id", params: { id: row.case_id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
        busy={busy}
      />
    </div>
  );
}
