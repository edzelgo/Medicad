import { createFileRoute } from "@tanstack/react-router";
import { WORKFLOW_OPTIONS, STATUS_OPTIONS } from "@/lib/intake-dashboard.functions";
import {
  CG_WORKFLOW_OPTIONS, CG_STATUS_OPTIONS, REFERRAL_TYPE_OPTIONS, REFERRAL_SOURCE_TYPE_OPTIONS,
  VETERAN_STATUS_OPTIONS, MARITAL_STATUS_OPTIONS, BROCHURE_PROVIDED_OPTIONS, MEDICAID_ASSET_REQUIREMENT_OPTIONS,
} from "@/lib/intake-options";

export const Route = createFileRoute("/_authenticated/crm/settings")({
  component: Settings,
});

const GROUPS: { title: string; options: readonly string[] }[] = [
  { title: "Medicaid workflow tracks", options: WORKFLOW_OPTIONS },
  { title: "Medicaid statuses", options: STATUS_OPTIONS },
  { title: "Caregiver (CG) workflow tracks", options: CG_WORKFLOW_OPTIONS },
  { title: "Caregiver (CG) statuses", options: CG_STATUS_OPTIONS },
  { title: "Referral type", options: REFERRAL_TYPE_OPTIONS },
  { title: "Referral source type", options: REFERRAL_SOURCE_TYPE_OPTIONS },
  { title: "Veteran status", options: VETERAN_STATUS_OPTIONS },
  { title: "Marital status", options: MARITAL_STATUS_OPTIONS },
  { title: "Brochure provided", options: BROCHURE_PROVIDED_OPTIONS },
  { title: "Meets Medicaid asset requirements", options: MEDICAID_ASSET_REQUIREMENT_OPTIONS },
];

function Settings() {
  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dropdown options are configured in code (<code className="text-xs">src/lib/intake-options.ts</code> and{" "}
          <code className="text-xs">src/lib/intake-dashboard.functions.ts</code>) rather than through a self-service
          admin UI. This page is a read-only reference — ask a developer to add or change an option.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2">{g.title}</h2>
            <ul className="text-sm text-muted-foreground space-y-1">
              {g.options.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
