import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const leadSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  inquiryType: z.string().trim().max(100).optional().or(z.literal("")),
  smsConsent: z.boolean().optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.from("leads").insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      inquiry_type: data.inquiryType || null,
      sms_consent: !!data.smsConsent,
      message: data.message || null,
    });
    if (error) {
      console.error("submitLead error", error);
      throw new Error("Could not submit your inquiry. Please try again.");
    }
    return { ok: true as const };
  });