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

type AccountMode = "none" | "invite" | "password";

function ClientOnboard({ onboarderRole }: { onboarderRole: "admin" | "agent" | "referral" }) {
  const submit = useServerFn(onboardClient);
  const navigate = useNavigate();
  const isAdmin = onboarderRole === "admin";
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AccountMode>("none");
  const [email, setEmail] = useState("");
  const [creds, setCreds] = useState<{ email: string; password: string; leadId: string; placeholder: boolean } | null>(null);

  const emailNeeded = mode === "invite";
  const emailShown = mode === "invite" || mode === "password";

  const goToLead = (leadId: string) => {
    if (onboarderRole === "referral") navigate({ to: "/referrals" });
    else navigate({ to: "/crm/leads/$id", params: { id: leadId } });
  };

  if (creds) {
    return (
      <div className="max-w-xl rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-5 space-y-3">
        <h3 className="text-sm font-semibold">Client login created</h3>
        <p className="text-xs text-muted-foreground">
          Share these credentials with the client — the password is shown only once.
          {creds.placeholder && " No email was provided, so a placeholder username was generated (the client can't receive email at this address)."}
        </p>
        <div className="rounded-md border border-border bg-card p-3 text-sm font-mono space-y-1">
          <div><span className="text-muted-foreground">Login:</span> {creds.email}</div>
          <div><span className="text-muted-foreground">Password:</span> {creds.password}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            navigator.clipboard?.writeText(`Login: ${creds.email}\nPassword: ${creds.password}`);
            toast.success("Copied");
          }}>Copy</Button>
          <Button size="sm" onClick={() => goToLead(creds.leadId)}>Open lead</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Client login</h3>
        {isAdmin ? (
          <div className="space-y-2">
            {([
              ["none", "No login — save the intake only"],
              ["invite", "Email the client a magic-link invite"],
              ["password", "Create a login now with a temporary password (email optional)"],
            ] as const).map(([key, label]) => (
              <label key={key}
                className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer ${mode === key ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                <input type="radio" name="account_mode" className="mt-1" checked={mode === key} onChange={() => setMode(key)} />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mode === "invite"} onChange={(e) => setMode(e.target.checked ? "invite" : "none")} />
            Send this client a portal invite email
          </label>
        )}

        {emailShown && (
          <div className="mt-3 space-y-1 max-w-md">
            <Label className="text-xs text-muted-foreground">
              Client or representative email {emailNeeded ? "*" : "(optional)"}
            </Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {mode === "password"
            ? "Creates a ready-to-use client account (no email sent). You'll get a temporary password to hand to the client. The intake is always saved."
            : "The intake is always saved. An invite emails the client a magic link to set their own password."}
        </p>
      </div>

      <IntakeForm
        submitLabel={mode === "invite" ? "Submit intake & send invite" : mode === "password" ? "Submit intake & create login" : "Submit intake"}
        busy={busy}
        onSubmit={async (v: IntakeValues) => {
          if (mode === "invite" && !email) { toast.error("Enter an email or choose a different option"); return; }
          setBusy(true);
          try {
            const res = await submit({
              data: { ...v, account_mode: mode, client_email: emailShown ? email : "" } as never,
            });
            const acc = res.account;
            if (acc.mode === "password") {
              if (acc.created && acc.tempPassword) {
                toast.success("Intake saved · client login created");
                setCreds({ email: acc.email!, password: acc.tempPassword, leadId: res.lead_id, placeholder: !!acc.placeholder });
                return; // stay so the admin can copy the credentials
              }
              toast.error(`Intake saved, but login not created: ${acc.error}`);
            } else if (acc.mode === "invite") {
              if (acc.sent) toast.success(`Intake saved · invite sent to ${acc.email}`);
              else toast.error(`Intake saved, but invite failed: ${acc.error}`);
            } else {
              toast.success("Intake saved");
            }
            goToLead(res.lead_id);
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
