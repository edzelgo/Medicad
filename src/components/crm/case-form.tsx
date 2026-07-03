import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WORKFLOW_OPTIONS } from "@/lib/intake-dashboard.functions";
import {
  CG_WORKFLOW_OPTIONS, VETERAN_STATUS_OPTIONS, MARITAL_STATUS_OPTIONS,
  MEDICAID_ASSET_REQUIREMENT_OPTIONS, BROCHURE_PROVIDED_OPTIONS, REFERRAL_SOURCE_TYPE_OPTIONS,
} from "@/lib/intake-options";

export type CaseFormValues = {
  case_type: "medicaid" | "caregiver";
  first_name: string; middle_name?: string; last_name: string;
  dob?: string; ssn?: string;
  phone_cell?: string; phone_home?: string; phone_other?: string;
  address1?: string; apartment?: string; city?: string; county?: string; state?: string; zip?: string;
  veteran_status?: string; marital_status?: string;
  spouse_first_name?: string; spouse_last_name?: string; spouse_dob?: string; spouse_ssn?: string;
  responsible_party_name?: string; responsible_party_phone?: string; responsible_party_email?: string;
  meets_asset_requirements?: string; months_until_spend_down?: number;
  transferred_resources_60mo?: boolean; transfer_amount?: number; brochure_provided?: string[];
};

export type NewCaseValues = CaseFormValues & {
  workflow: string; ref_source?: string; marketer?: string; date_received?: string;
};

export function CaseForm({
  initial, mode, onSubmit, submitLabel = "Save", busy,
}: {
  initial?: Partial<NewCaseValues>;
  mode: "create" | "edit";
  onSubmit: (v: NewCaseValues | CaseFormValues) => void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const [v, setV] = useState<NewCaseValues>({
    case_type: "medicaid", first_name: "", last_name: "", workflow: "", brochure_provided: [],
    ...initial,
  } as NewCaseValues);
  const set = <K extends keyof NewCaseValues>(k: K, val: NewCaseValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const workflowOptions = v.case_type === "caregiver" ? CG_WORKFLOW_OPTIONS : WORKFLOW_OPTIONS;

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}>
      <Section title="Case type">
        <div className="flex gap-2">
          {(["medicaid", "caregiver"] as const).map((t) => (
            <button type="button" key={t}
              onClick={() => set("case_type", t)}
              className={`px-3 py-1.5 rounded-md text-sm border capitalize ${v.case_type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Personal Info">
        <Grid>
          <Field label="First name *"><Input required value={v.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Middle name"><Input value={v.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value)} /></Field>
          <Field label="Last name *"><Input required value={v.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
          <Field label="DOB"><Input type="date" value={v.dob ?? ""} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="Social Security #"><Input value={v.ssn ?? ""} onChange={(e) => set("ssn", e.target.value)} /></Field>
          <Field label="Cell phone"><Input value={v.phone_cell ?? ""} onChange={(e) => set("phone_cell", e.target.value)} /></Field>
          <Field label="Home phone"><Input value={v.phone_home ?? ""} onChange={(e) => set("phone_home", e.target.value)} /></Field>
          <Field label="Other phone"><Input value={v.phone_other ?? ""} onChange={(e) => set("phone_other", e.target.value)} /></Field>
        </Grid>
      </Section>

      <Section title="Address">
        <Grid>
          <Field label="Address 1" wide><Input value={v.address1 ?? ""} onChange={(e) => set("address1", e.target.value)} /></Field>
          <Field label="Apartment"><Input value={v.apartment ?? ""} onChange={(e) => set("apartment", e.target.value)} /></Field>
          <Field label="City"><Input value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="County"><Input value={v.county ?? ""} onChange={(e) => set("county", e.target.value)} /></Field>
          <Field label="State"><Input value={v.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="Zip"><Input value={v.zip ?? ""} onChange={(e) => set("zip", e.target.value)} /></Field>
        </Grid>
      </Section>

      <Section title="Household">
        <Grid>
          <Field label="Veteran status">
            <SelectInput value={v.veteran_status} onChange={(x) => set("veteran_status", x)} options={[...VETERAN_STATUS_OPTIONS]} />
          </Field>
          <Field label="Marital status">
            <SelectInput value={v.marital_status} onChange={(x) => set("marital_status", x)} options={[...MARITAL_STATUS_OPTIONS]} />
          </Field>
        </Grid>
        {v.marital_status === "Married" && (
          <Grid>
            <Field label="Spouse first name"><Input value={v.spouse_first_name ?? ""} onChange={(e) => set("spouse_first_name", e.target.value)} /></Field>
            <Field label="Spouse last name"><Input value={v.spouse_last_name ?? ""} onChange={(e) => set("spouse_last_name", e.target.value)} /></Field>
            <Field label="Spouse DOB"><Input type="date" value={v.spouse_dob ?? ""} onChange={(e) => set("spouse_dob", e.target.value)} /></Field>
            <Field label="Spouse SSN"><Input value={v.spouse_ssn ?? ""} onChange={(e) => set("spouse_ssn", e.target.value)} /></Field>
          </Grid>
        )}
        <Grid>
          <Field label="Responsible party name"><Input value={v.responsible_party_name ?? ""} onChange={(e) => set("responsible_party_name", e.target.value)} /></Field>
          <Field label="Responsible party phone"><Input value={v.responsible_party_phone ?? ""} onChange={(e) => set("responsible_party_phone", e.target.value)} /></Field>
          <Field label="Responsible party email"><Input type="email" value={v.responsible_party_email ?? ""} onChange={(e) => set("responsible_party_email", e.target.value)} /></Field>
        </Grid>
      </Section>

      {v.case_type === "medicaid" && (
        <Section title="Other">
          <Grid>
            <Field label="Meets Medicaid asset requirements?">
              <SelectInput value={v.meets_asset_requirements} onChange={(x) => set("meets_asset_requirements", x)} options={[...MEDICAID_ASSET_REQUIREMENT_OPTIONS]} />
            </Field>
            <Field label="Months until spend-down"><Input type="number" value={v.months_until_spend_down ?? ""} onChange={(e) => set("months_until_spend_down", e.target.value ? Number(e.target.value) : undefined)} /></Field>
            <Field label="Transferred resources (60mo)?">
              <SelectInput value={v.transferred_resources_60mo === undefined ? undefined : v.transferred_resources_60mo ? "Yes" : "No"} onChange={(x) => set("transferred_resources_60mo", x === "Yes")} options={["Yes", "No"]} />
            </Field>
            <Field label="Estimated transfer amount"><Input type="number" value={v.transfer_amount ?? ""} onChange={(e) => set("transfer_amount", e.target.value ? Number(e.target.value) : undefined)} /></Field>
          </Grid>
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground">Brochure provided</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {BROCHURE_PROVIDED_OPTIONS.map((b) => {
                const selected = (v.brochure_provided ?? []).includes(b);
                return (
                  <label key={b} className={`px-3 py-1.5 text-sm rounded-md border cursor-pointer ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    <input type="checkbox" className="hidden" checked={selected} onChange={() => {
                      const cur = v.brochure_provided ?? [];
                      set("brochure_provided", selected ? cur.filter((x) => x !== b) : [...cur, b]);
                    }} />
                    {b}
                  </label>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {mode === "create" && (
        <Section title="Case Info">
          <Grid>
            <Field label="Workflow *">
              <SelectInput value={v.workflow} onChange={(x) => set("workflow", x)} options={[...workflowOptions]} />
            </Field>
            <Field label="Referral source type">
              <SelectInput value={v.ref_source} onChange={(x) => set("ref_source", x)} options={[...REFERRAL_SOURCE_TYPE_OPTIONS]} />
            </Field>
            <Field label="Marketer"><Input value={v.marketer ?? ""} onChange={(e) => set("marketer", e.target.value)} /></Field>
            <Field label="Date received"><Input type="date" value={v.date_received ?? ""} onChange={(e) => set("date_received", e.target.value)} /></Field>
          </Grid>
        </Section>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy || (mode === "create" && !v.workflow)}>{busy ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{children}</div>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={`space-y-1 ${wide ? "md:col-span-3" : ""}`}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function SelectInput({ value, onChange, options }: { value?: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}
