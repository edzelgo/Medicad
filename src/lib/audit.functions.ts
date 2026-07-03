import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const ACTIONS = [
  "login",
  "logout",
  "document.upload",
  "document.delete",
  "document.download",
  "packet.compress",
] as const;

const auditSchema = z.object({
  action: z.enum(ACTIONS),
  resource: z.string().max(512).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const recordAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => auditSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const ua = getRequestHeader("user-agent") ?? null;

    const { error } = await supabase.from("audit_logs").insert({
      user_id: userId,
      actor_email: (claims as { email?: string })?.email ?? null,
      action: data.action,
      resource: data.resource ?? null,
      metadata: data.metadata ?? {},
      ip_address: ip,
      user_agent: ua,
    });
    if (error) {
      // Never leak raw DB errors, but never block the caller either.
      console.error("[audit]", error.message);
      return { ok: false };
    }
    return { ok: true };
  });

export type AuditAction = (typeof ACTIONS)[number];