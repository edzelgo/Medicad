import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/auth/staff";
import { z } from "zod";

export type CommunicationEntry = {
  id: string;
  created_at: string;
  channel: string;
  kind: string;
  recipient: string;
  subject: string | null;
  body_preview: string | null;
  success: boolean;
  error: string | null;
};

/**
 * Communication history for a lead (Group C #34/#37). Returns [] gracefully
 * when the communications_log table doesn't exist yet (migration pending).
 */
export const listLeadCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CommunicationEntry[]> => {
    await assertStaff(context);
    const { data: rows, error } = await (context.supabase.from as (t: string) => any)("communications_log")
      .select("id, created_at, channel, kind, recipient, subject, body_preview, success, error")
      .eq("lead_id", data.lead_id)
      .order("created_at", { ascending: false })
      .limit(100) as { data: CommunicationEntry[] | null; error: { message: string } | null };
    if (error) return []; // table missing or not readable — no history to show
    return rows ?? [];
  });
