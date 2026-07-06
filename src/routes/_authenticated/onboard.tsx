import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CaseForm, type NewCaseValues } from "@/components/crm/case-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { onboardClient, myOnboardAccess } from "@/lib/onboarding.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboard")({
  beforeLoad: async () => {
    const res = await myOnboardAccess();
    if (!res.allowed) throw redirect({ to: "/portal" });
    return { role: res.role };
  },
  component: OnboardPage,
});

function OnboardPage() {
  const { role } = Route.useRouteContext();
  const submit = useServerFn(onboardClient);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {role === "referral" ? "Referral partner" : "Staff"} onboarding
            </div>
            <h1 className="font-serif text-2xl">Onboard a new client</h1>
          </div>
          <Link to="/portal" className="text-sm text-muted-foreground hover:text-foreground">Back to portal</Link>
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
              <Label className="text-xs text-muted-foreground">Client email</Label>
              <Input
                type="email"
                disabled={!invite}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            When enabled, the client gets an email to set a password and access their onboarding portal.
            Their case is always created regardless.
          </p>
        </div>

        <CaseForm
          mode="create"
          submitLabel={invite ? "Create case & send invite" : "Create case"}
          busy={busy}
          onSubmit={async (v) => {
            const values = v as NewCaseValues;
            if (invite && !email) { toast.error("Enter the client's email or uncheck invite"); return; }
            setBusy(true);
            try {
              const res = await submit({
                data: { ...values, invite_client: invite, client_email: invite ? email : "" } as never,
              });
              if (res.invite.sent) toast.success(`Case ${res.case_number} created · invite sent to ${res.invite.email}`);
              else if (invite) toast.error(`Case ${res.case_number} created, but invite failed: ${res.invite.error}`);
              else toast.success(`Case ${res.case_number} created`);
              if (role === "admin" || role === "agent") {
                navigate({ to: "/crm/cases/$id", params: { id: res.case_id } });
              } else {
                navigate({ to: "/portal" });
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        />
      </main>
    </div>
  );
}