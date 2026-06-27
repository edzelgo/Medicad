import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type IntakeValues = {
  first_name: string; last_name: string; middle_initial?: string;
  email?: string; phone?: string; address?: string; state?: string; zip?: string; dob?: string; ssn?: string;
  source?: string;
  referral_status?: string; veteran_status?: string; marital_status?: string;
  spouse_first_name?: string; spouse_last_name?: string; spouse_dob?: string; spouse_ssn?: string;
  has_lri?: boolean; lri_first_name?: string; lri_last_name?: string; lri_phone?: string; lri_email?: string; lri_status?: string;
  spend_down_completed?: boolean; transferred_resources_60mo?: boolean; transfer_amount?: number;
  retroactive_required?: boolean; date_first_coverage?: string; estimated_spend_down_remaining?: number;
  brochure_provided?: string[]; household_size?: number; monthly_income?: number; notes?: string;
};

const BROCHURES = ["Medicaid Overview", "Spend-Down Guide", "PACE Program", "Home Care", "Nursing Home Planning"];

export function IntakeForm({ initial, onSubmit, submitLabel = "Save intake", busy }: {
  initial?: Partial<IntakeValues>;
  onSubmit: (v: IntakeValues) => void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const [v, setV] = useState<IntakeValues>({
    first_name: "", last_name: "", brochure_provided: [], has_lri: false, ...initial,
  } as IntakeValues);
  const set = <K extends keyof IntakeValues>(k: K, val: IntakeValues[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}
    >
      <Section title="Applicant">
        <Grid>
          <Field label="First name *"><Input required value={v.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Middle"><Input value={v.middle_initial ?? ""} onChange={(e) => set("middle_initial", e.target.value)} /></Field>
          <Field label="Last name *"><Input required value={v.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={v.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="DOB"><Input type="date" value={v.dob ?? ""} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="SSN"><Input value={v.ssn ?? ""} onChange={(e) => set("ssn", e.target.value)} /></Field>
        </Grid>
      </Section>

      <Section title="Address">
        <Grid>
          <Field label="Street" wide><Input value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="State"><Input value={v.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="ZIP"><Input value={v.zip ?? ""} onChange={(e) => set("zip", e.target.value)} /></Field>
        </Grid>
      </Section>

      <Section title="Referral & Status">
        <Grid>
          <Field label="Referral status">
            <SelectInput value={v.referral_status} onChange={(x) => set("referral_status", x)} options={["New", "In progress", "Approved", "Declined"]} />
          </Field>
          <Field label="Veteran status">
            <SelectInput value={v.veteran_status} onChange={(x) => set("veteran_status", x)} options={["No", "Yes", "Spouse of veteran"]} />
          </Field>
          <Field label="Marital status">
            <SelectInput value={v.marital_status} onChange={(x) => set("marital_status", x)} options={["Single", "Married", "Widowed", "Divorced"]} />
          </Field>
          <Field label="Source"><Input value={v.source ?? ""} onChange={(e) => set("source", e.target.value)} /></Field>
        </Grid>
      </Section>

      {v.marital_status === "Married" && (
        <Section title="Spouse">
          <Grid>
            <Field label="Spouse first name"><Input value={v.spouse_first_name ?? ""} onChange={(e) => set("spouse_first_name", e.target.value)} /></Field>
            <Field label="Spouse last name"><Input value={v.spouse_last_name ?? ""} onChange={(e) => set("spouse_last_name", e.target.value)} /></Field>
            <Field label="Spouse DOB"><Input type="date" value={v.spouse_dob ?? ""} onChange={(e) => set("spouse_dob", e.target.value)} /></Field>
            <Field label="Spouse SSN"><Input value={v.spouse_ssn ?? ""} onChange={(e) => set("spouse_ssn", e.target.value)} /></Field>
          </Grid>
        </Section>
      )}

      <Section title="Legally Responsible Individual">
        <div className="flex items-center gap-2 mb-3">
          <Checkbox id="has_lri" checked={!!v.has_lri} onCheckedChange={(c) => set("has_lri", !!c)} />
          <Label htmlFor="has_lri">Has an LRI</Label>
        </div>
        {v.has_lri && (
          <Grid>
            <Field label="LRI first name"><Input value={v.lri_first_name ?? ""} onChange={(e) => set("lri_first_name", e.target.value)} /></Field>
            <Field label="LRI last name"><Input value={v.lri_last_name ?? ""} onChange={(e) => set("lri_last_name", e.target.value)} /></Field>
            <Field label="LRI phone"><Input value={v.lri_phone ?? ""} onChange={(e) => set("lri_phone", e.target.value)} /></Field>
            <Field label="LRI email"><Input type="email" value={v.lri_email ?? ""} onChange={(e) => set("lri_email", e.target.value)} /></Field>
            <Field label="LRI status"><Input value={v.lri_status ?? ""} onChange={(e) => set("lri_status", e.target.value)} /></Field>
          </Grid>
        )}
      </Section>

      <Section title="Financial">
        <Grid>
          <Field label="Spend-down completed">
            <SelectInput value={v.spend_down_completed === undefined ? undefined : v.spend_down_completed ? "Yes" : "No"} onChange={(x) => set("spend_down_completed", x === "Yes")} options={["Yes", "No"]} />
          </Field>
          <Field label="Transferred resources (60mo)">
            <SelectInput value={v.transferred_resources_60mo === undefined ? undefined : v.transferred_resources_60mo ? "Yes" : "No"} onChange={(x) => set("transferred_resources_60mo", x === "Yes")} options={["Yes", "No"]} />
          </Field>
          <Field label="Transfer amount"><Input type="number" value={v.transfer_amount ?? ""} onChange={(e) => set("transfer_amount", e.target.value ? Number(e.target.value) : undefined)} /></Field>
          <Field label="Retroactive required">
            <SelectInput value={v.retroactive_required === undefined ? undefined : v.retroactive_required ? "Yes" : "No"} onChange={(x) => set("retroactive_required", x === "Yes")} options={["Yes", "No"]} />
          </Field>
          <Field label="Date first coverage needed"><Input type="date" value={v.date_first_coverage ?? ""} onChange={(e) => set("date_first_coverage", e.target.value)} /></Field>
          <Field label="Estimated spend-down remaining"><Input type="number" value={v.estimated_spend_down_remaining ?? ""} onChange={(e) => set("estimated_spend_down_remaining", e.target.value ? Number(e.target.value) : undefined)} /></Field>
          <Field label="Household size"><Input type="number" value={v.household_size ?? ""} onChange={(e) => set("household_size", e.target.value ? Number(e.target.value) : undefined)} /></Field>
          <Field label="Monthly income"><Input type="number" value={v.monthly_income ?? ""} onChange={(e) => set("monthly_income", e.target.value ? Number(e.target.value) : undefined)} /></Field>
        </Grid>
      </Section>

      <Section title="Brochures provided">
        <div className="flex flex-wrap gap-3">
          {BROCHURES.map((b) => {
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
      </Section>

      <Section title="Notes">
        <Textarea rows={4} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
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