import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { IntakeForm, type IntakeValues } from "@/components/crm/intake-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { onboardClient, myOnboardAccess } from "@/lib/onboarding.functions";
import { adminInviteUser } from "@/lib/admin-users.functions";
import { UserPlus, Users } from "lucide-react";
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
  // beforeLoad redirects when access isn't allowed, so the role is always set here.
  const onboarderRole = (Route.useRouteContext().onboarderRole ?? "agent") as "admin" | "agent" | "referral";
  const isAdmin = onboarderRole === "admin";
  const [tab, setTab] = useState<"client" | "team">("client");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {onboarderRole === "referral" ? "Referral partner" : "Staff"} onboarding
            </div>
            <h1 className="font-serif text-2xl">Onboard</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isAdmin
                ? "Add a new client intake, or invite a team member to the CRM."
                : "Submit a new resident referral. Fields match the Facility Intake spec."}
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
        {isAdmin && (
          <div className="flex gap-1 border-b border-border">
            {([
              ["client", "Onboard a client", UserPlus],
              ["team", "Onboard a team member", Users],
            ] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3 py-2 text-sm border-b-2 -mb-px inline-flex items-center gap-1.5 ${
                  tab === key ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        )}

        {(!isAdmin || tab === "client") && <ClientOnboard onboarderRole={onboarderRole} />}
        {isAdmin && tab === "team" && <TeamOnboard />}
      </main>
    </div>
  );
}

function ClientOnboard({ onboarderRole }: { onboarderRole: "admin" | "agent" | "referral" }) {
  const submit = useServerFn(onboardClient);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  return (
    <div className="space-y-6">
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
    </div>
  );
}

const TEAM_ROLES = [
  { role: "agent", blurb: "Full CRM access — manage leads, cases, and clients." },
  { role: "referral", blurb: "Referral partner — submits referrals and sees their status." },
  { role: "marketer", blurb: "Marketing role for source/campaign tracking." },
  { role: "admin", blurb: "Full access including user management and settings." },
] as const;

function TeamOnboard() {
  const invite = useServerFn(adminInviteUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof TEAM_ROLES)[number]["role"]>("agent");
  const [busy, setBusy] = useState(false);

  return (
    <div className="max-w-xl rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold mb-1">Invite a team member</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Sends a magic-link email so they can set a password. The role is granted immediately — no waiting for approval.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await invite({ data: { email: email.trim(), role, full_name: fullName.trim() || undefined } });
            toast.success(`Invite sent to ${email.trim()} as ${role}`);
            setEmail(""); setFullName(""); setRole("agent");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Invite failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">Email *</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Role *</Label>
          <div className="space-y-2">
            {TEAM_ROLES.map((r) => (
              <label key={r.role}
                className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer ${role === r.role ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                <input type="radio" name="role" className="mt-1" checked={role === r.role} onChange={() => setRole(r.role)} />
                <span>
                  <span className="text-sm font-medium capitalize">{r.role}</span>
                  <span className="block text-xs text-muted-foreground">{r.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
          <UserPlus className="h-4 w-4 mr-2" /> {busy ? "Sending…" : "Send invite"}
        </Button>
      </form>
    </div>
  );
}
