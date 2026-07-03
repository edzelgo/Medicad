import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

const demographicsSchema = z.object({
  case_type: z.enum(["medicaid", "caregiver"]).default("medicaid"),
  first_name: z.string().trim().min(1).max(100),
  middle_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  last_name: z.string().trim().min(1).max(100),
  dob: z.string().optional().nullable().or(z.literal("")),
  ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  phone_cell: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  phone_home: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  phone_other: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  address1: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  apartment: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  city: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  county: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  state: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  zip: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  veteran_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  marital_status: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  spouse_first_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_last_name: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  spouse_dob: z.string().optional().nullable().or(z.literal("")),
  spouse_ssn: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  responsible_party_name: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  responsible_party_phone: z.string().trim().max(40).optional().nullable().or(z.literal("")),
  responsible_party_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  meets_asset_requirements: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  months_until_spend_down: z.number().int().optional().nullable(),
  transferred_resources_60mo: z.boolean().optional().nullable(),
  transfer_amount: z.number().optional().nullable(),
  brochure_provided: z.array(z.string()).optional(),
});

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function genCaseNumber() {
  // Human-readable case number; not guessable/sequential on purpose.
  return `C-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase()}`;
}

const createCaseSchema = demographicsSchema.extend({
  workflow: z.string().trim().min(1),
  ref_source: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  marketer: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  date_received: z.string().optional().nullable().or(z.literal("")),
});

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createCaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { workflow, ref_source, marketer, date_received, ...demo } = data;

    const casePayload = clean(demo);
    casePayload.case_number = genCaseNumber();
    const { data: caseRow, error: caseErr } = await context.supabase
      .from("cases").insert(casePayload as never).select("id, case_number").single();
    if (caseErr) throw new Error(caseErr.message);

    const trackPayload = clean({ ref_source, marketer, date_received });
    trackPayload.case_id = caseRow.id;
    trackPayload.workflow = workflow;
    trackPayload.status = "Workflow Created";
    trackPayload.status_date = new Date().toISOString().slice(0, 10);
    const { data: trackRow, error: trackErr } = await context.supabase
      .from("case_tracks").insert(trackPayload as never).select("id").single();
    if (trackErr) throw new Error(trackErr.message);

    return { case_id: caseRow.id, case_number: caseRow.case_number, track_id: trackRow.id };
  });

export const getCaseDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: caseRow, error: caseErr } = await context.supabase
      .from("cases").select("*").eq("id", data.id).maybeSingle();
    if (caseErr) throw new Error(caseErr.message);
    if (!caseRow) throw new Error("Case not found");

    const { data: tracks, error: tracksErr } = await context.supabase
      .from("case_tracks").select("*").eq("case_id", data.id)
      .order("created_at", { ascending: true });
    if (tracksErr) throw new Error(tracksErr.message);

    const trackIds = (tracks ?? []).map((t) => t.id);
    const { data: events, error: eventsErr } = trackIds.length
      ? await context.supabase
          .from("intake_case_events").select("*")
          .in("case_id", trackIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [], error: null };
    if (eventsErr) throw new Error(eventsErr.message);

    return { case: caseRow, tracks: tracks ?? [], events: events ?? [] };
  });

export const updateCaseDemographics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: demographicsSchema.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const patch = clean(data.patch);
    const { error } = await context.supabase.from("cases").update(patch as never).eq("id", data.id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });

const addTrackSchema = z.object({
  case_id: z.string().uuid(),
  workflow: z.string().trim().min(1),
  ref_source: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  marketer: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  date_received: z.string().optional().nullable().or(z.literal("")),
});

export const addCaseTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addTrackSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const payload = clean({
      ref_source: data.ref_source, marketer: data.marketer, date_received: data.date_received,
    });
    payload.case_id = data.case_id;
    payload.workflow = data.workflow;
    payload.status = "Workflow Created";
    payload.status_date = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await context.supabase
      .from("case_tracks").insert(payload as never).select("id").single();
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { track_id: row.id };
  });

export const deleteCaseTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await assertStaff(context);
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("case_tracks").delete().eq("id", data.id);
    if (error) { console.error("[db]", error.message); throw new Error("Operation failed. Please try again."); }
    return { ok: true };
  });
