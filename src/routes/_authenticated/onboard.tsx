import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { IntakeForm, type IntakeValues } from "@/components/crm/intake-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardClient, myOnboardAccess } from "@/lib/onboarding.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboard")({
  beforeLoad: async () => {
    const res = await myOnboardAccess();
    if (!res.allowed) throw redirect({ to: "/portal" });
    return { onboarderRole: res.role };
  },
  component: OnboardPage,
});

function OnboardPage() {
  const { onboarderRole } = Route.useRouteContext();
  const submit = useServerFn(onboardClient);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {onboarderRole === "referral" ? "Referral partner" : "Staff"} intake
            </div>
            <h1 className="font-serif text-2xl">Facility Intake</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Submit a new resident referral. Fields match the Facility Intake spec.
            </p>
          </div>
          <Link
            to={onboarderRole === "referral" ? "/referrals" : onboarderRole === "admin" || onboarderRole === "agent" ? "/crm/leads" : "/portal"}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {onboarderRole === "referral" ? "My referrals" : "Back"}
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Client portal invite (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
              Send this client a portal invite email
            </label>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Client or representative email</Label>
              <Input
                type="email"
                disabled={!invite}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            When enabled, the recipient gets a magic-link email to set a password and access the client onboarding portal.
            The intake is always saved regardless.
          </p>
        </div>

        <IntakeForm
          submitLabel={invite ? "Submit intake & send invite" : "Submit intake"}
          busy={busy}
          onSubmit={async (v: IntakeValues) => {
            if (invite && !inviteEmail) { toast.error("Enter an invite email or uncheck the invite option"); return; }
            setBusy(true);
            try {
              const res = await submit({
                data: { ...v, invite_client: invite, client_email: invite ? inviteEmail : "" } as never,
              });
              if (res.invite.sent) toast.success(`Intake saved · invite sent to ${res.invite.email}`);
              else if (invite) toast.error(`Intake saved, but invite failed: ${res.invite.error}`);
              else toast.success("Intake saved");
              if (onboarderRole === "admin" || onboarderRole === "agent") {
                navigate({ to: "/crm/leads/$id", params: { id: res.lead_id } });
              } else {
                navigate({ to: "/referrals" });
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to submit intake");
            } finally {
              setBusy(false);
            }
          }}
        />
      </main>
    </div>
  );
}