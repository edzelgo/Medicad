import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const schema = z.object({
  full_name: z.string().trim().max(200).optional(),
  first_name: z.string().trim().max(100).optional(),
  last_name: z.string().trim().max(100).optional(),
  middle_initial: z.string().trim().max(5).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  state: z.string().trim().max(50).optional(),
  zip: z.string().trim().max(20).optional(),
  dob: z.string().optional(),
  inquiryType: z.string().trim().max(100).optional(),
  smsConsent: z.boolean().optional(),
  message: z.string().trim().max(5000).optional(),
  referral_status: z.string().trim().max(100).optional(),
  veteran_status: z.string().trim().max(50).optional(),
  marital_status: z.string().trim().max(50).optional(),
  household_size: z.number().int().optional(),
  monthly_income: z.number().optional(),
  notes: z.string().max(10000).optional(),
  source: z.string().trim().max(120).optional(),
}).refine((d) => d.full_name || (d.first_name && d.last_name) || d.email, {
  message: "Provide a name or email",
});

export const Route = createFileRoute("/api/public/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const data = schema.parse(body);
          let first = data.first_name;
          let last = data.last_name;
          if (!first && data.full_name) {
            const parts = data.full_name.trim().split(/\s+/);
            first = parts[0];
            last = parts.slice(1).join(" ") || undefined;
          }
          const notesParts: string[] = [];
          if (data.inquiryType) notesParts.push(`Inquiry: ${data.inquiryType}`);
          if (data.smsConsent !== undefined) notesParts.push(`SMS consent: ${data.smsConsent ? "yes" : "no"}`);
          if (data.message) notesParts.push(`Message: ${data.message}`);
          if (data.notes) notesParts.push(data.notes);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const insertPayload: Record<string, unknown> = {
            full_name: data.full_name ?? [first, last].filter(Boolean).join(" "),
            first_name: first ?? null,
            last_name: last ?? null,
            middle_initial: data.middle_initial ?? null,
            email: data.email ?? null,
            phone: data.phone ?? null,
            address: data.address ?? null,
            state: data.state ?? null,
            zip: data.zip ?? null,
            dob: data.dob || null,
            inquiry_type: data.inquiryType ?? null,
            sms_consent: !!data.smsConsent,
            message: data.message ?? null,
            referral_status: data.referral_status ?? null,
            veteran_status: data.veteran_status ?? null,
            marital_status: data.marital_status ?? null,
            household_size: data.household_size ?? null,
            monthly_income: data.monthly_income ?? null,
            notes: notesParts.length ? notesParts.join("\n") : null,
            stage: "new",
            source: data.source ?? "medicaidsuccess.com",
          };
          const { data: row, error } = await supabaseAdmin.from("leads").insert(insertPayload).select("id").single();
          if (error) throw error; // audit-ok:raw-error — caught below and converted to a generic 400 response
          return new Response(JSON.stringify({ ok: true, id: row.id }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[public/leads]", err);
          return new Response(JSON.stringify({ ok: false, error: "Invalid request. Please check your input." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});