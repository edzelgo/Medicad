import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

function tbl(client: unknown, name: string) {
  return ((client as { from: (t: string) => any }).from)(name);
}

function xmlEscape(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export const CALL_OUTCOMES = ["connected", "voicemail", "no_answer", "busy", "wrong_number"] as const;
export const CALL_OUTCOME_LABEL: Record<string, string> = {
  connected: "Connected", voicemail: "Left voicemail", no_answer: "No answer",
  busy: "Busy", wrong_number: "Wrong number",
};

export type CallLog = {
  id: string;
  direction: string;
  outcome: string | null;
  duration_seconds: number | null;
  notes: string | null;
  provider: string;
  created_at: string;
};

/** Call history for a lead, plus whether Twilio click-to-call is available and
 *  the caller's own phone (needed for the bridge). */
export const listLeadCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ calls: CallLog[]; twilioAvailable: boolean; myPhone: string | null }> => {
    await assertStaff(context);
    const notify = await import("@/lib/notify.server");
    const { data: prof } = await context.supabase
      .from("profiles").select("phone").eq("id", context.userId).maybeSingle();
    const { data: rows, error } = await tbl(context.supabase, "call_logs")
      .select("id, direction, outcome, duration_seconds, notes, provider, created_at")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: false })
      .limit(100) as { data: CallLog[] | null; error: any };
    return {
      calls: error ? [] : (rows ?? []),
      twilioAvailable: notify.twilioVoiceConfigured(),
      myPhone: prof?.phone ?? null,
    };
  });

const logSchema = z.object({
  lead_id: z.string().uuid(),
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  outcome: z.enum(CALL_OUTCOMES),
  duration_seconds: z.number().int().min(0).max(86400).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable().or(z.literal("")),
});

/** Manually log a call (used with click-to-dial). Also drops a note on the
 *  lead's activity feed for a single timeline. */
export const logCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => logSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await tbl(context.supabase, "call_logs").insert({
      lead_id: data.lead_id,
      direction: data.direction,
      outcome: data.outcome,
      duration_seconds: data.duration_seconds ?? null,
      notes: data.notes || null,
      provider: "manual",
      created_by: context.userId,
    });
    if (error) {
      if (/does not exist/i.test(error.message)) throw new Error("Call logging isn't available yet — apply the pending migration via Lovable.");
      throw new Error("Failed to log call.");
    }
    await context.supabase.from("activities").insert({
      lead_id: data.lead_id,
      type: "call",
      content: `${data.direction === "inbound" ? "Inbound" : "Outbound"} call — ${CALL_OUTCOME_LABEL[data.outcome]}${data.notes ? `: ${data.notes}` : ""}`,
      created_by: context.userId,
    });
    return { ok: true };
  });

/** Twilio click-to-call: rings the agent's phone, then bridges to the lead.
 *  Uses inline TwiML (no hosted webhook). Env-gated. */
export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const notify = await import("@/lib/notify.server");
    if (!notify.twilioVoiceConfigured()) throw new Error("Twilio calling isn't configured on the server.");

    const { data: lead } = await context.supabase
      .from("leads").select("phone, full_name, first_name, last_name").eq("id", data.lead_id).maybeSingle();
    if (!lead?.phone) throw new Error("This lead has no phone number.");
    const { data: prof } = await context.supabase
      .from("profiles").select("phone").eq("id", context.userId).maybeSingle();
    if (!prof?.phone) throw new Error("Add your own phone number to your profile before using click-to-call.");

    const name = lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "your lead";
    const twiml =
      `<Response><Say>Connecting you to ${xmlEscape(name)}.</Say>` +
      `<Dial callerId="${xmlEscape(notify.twilioFrom())}">${xmlEscape(lead.phone)}</Dial></Response>`;

    const result = await notify.placeCall(prof.phone, twiml);
    if (!result) throw new Error("Could not place the call. Please try again.");

    await tbl(context.supabase, "call_logs").insert({
      lead_id: data.lead_id,
      direction: "outbound",
      provider: "twilio",
      provider_sid: result.sid,
      notes: "Click-to-call initiated",
      created_by: context.userId,
    });
    await context.supabase.from("activities").insert({
      lead_id: data.lead_id, type: "call",
      content: "Outbound click-to-call initiated via Twilio.", created_by: context.userId,
    });
    return { ok: true };
  });
