import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { IntakeForm, type IntakeValues } from "@/components/crm/intake-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { onboardClient } from "@/lib/onboarding.functions";
import { adminCreateTeamMember } from "@/lib/admin-users.functions";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

/** Shown once after an account is created with a temporary password. */
function CredentialsBox({
  email, password, placeholder, subject, onDone, doneLabel,
}: {
  email: string; password: string; placeholder: boolean; subject: string;
  onDone: () => void; doneLabel: string;
}) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-5 space-y-3">
      <h3 className="text-sm font-semibold">{subject} created</h3>
      <p className="text-xs text-muted-foreground">
        Share these credentials — the password is shown only once.
        {placeholder && " No email was provided, so a placeholder username was generated (they can't receive email at this address)."}
      </p>
      <div className="rounded-md border border-border bg-card p-3 text-sm font-mono space-y-1 break-all">
        <div><span className="text-muted-foreground">Login:</span> {email}</div>
        <div><span className="text-muted-foreground">Password:</span> {password}</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => {
          navigator.clipboard?.writeText(`Login: ${email}\nPassword: ${password}`);
          toast.success("Copied");
        }}>Copy</Button>
        <Button size="sm" onClick={onDone}>{doneLabel}</Button>
      </div>
    </div>
  );
}

type AccountMode = "none" | "invite" | "password";

/**
 * Client intake + optional account creation.
 * `onFinished` overrides the default navigation (used when embedded in a dialog).
 */
export function ClientOnboardForm({
  onboarderRole, onFinished,
}: {
  onboarderRole: "admin" | "agent" | "referral";
  onFinished?: (leadId: string) => void;
}) {
  const submit = useServerFn(onboardClient);
  const navigate = useNavigate();
  const isAdmin = onboarderRole === "admin";
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AccountMode>("none");
  const [email, setEmail] = useState("");
  const [creds, setCreds] = useState<{ email: string; password: string; leadId: string; placeholder: boolean } | null>(null);

  const emailNeeded = mode === "invite";
  const emailShown = mode === "invite" || mode === "password";

  const finish = (leadId: string) => {
    if (onFinished) { onFinished(leadId); return; }
    if (onboarderRole === "referral") navigate({ to: "/referrals" });
    else navigate({ to: "/crm/leads/$id", params: { id: leadId } });
  };

  if (creds) {
    return (
      <CredentialsBox
        email={creds.email} password={creds.password} placeholder={creds.placeholder}
        subject="Client login" doneLabel={onFinished ? "Done" : "Open lead"}
        onDone={() => finish(creds.leadId)}
      />
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
            const res = await submit({ data: { ...v, account_mode: mode, client_email: emailShown ? email : "" } as never });
            const acc = res.account;
            if (acc.mode === "password") {
              if (acc.created && acc.tempPassword) {
                toast.success("Intake saved · client login created");
                setCreds({ email: acc.email!, password: acc.tempPassword, leadId: res.lead_id, placeholder: !!acc.placeholder });
                return; // stay so the credentials can be copied
              }
              toast.error(`Intake saved, but login not created: ${acc.error}`);
            } else if (acc.mode === "invite") {
              if (acc.sent) toast.success(`Intake saved · invite sent to ${acc.email}`);
              else toast.error(`Intake saved, but invite failed: ${acc.error}`);
            } else {
              toast.success("Intake saved");
            }
            finish(res.lead_id);
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

const TEAM_ROLE_INFO = [
  { role: "agent", blurb: "Full CRM access — manage leads, cases, and clients." },
  { role: "referral", blurb: "Referral partner — submits referrals and sees their status." },
  { role: "marketer", blurb: "Marketing role for source/campaign tracking." },
  { role: "admin", blurb: "Full access including user management and settings." },
] as const;

/** Admin types in a team member's details and either invites them or creates
 *  their login outright (email optional). */
export function TeamOnboardForm({ onFinished }: { onFinished?: () => void }) {
  const create = useServerFn(adminCreateTeamMember);
  const [mode, setMode] = useState<"password" | "invite">("password");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<(typeof TEAM_ROLE_INFO)[number]["role"]>("agent");
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string; placeholder: boolean } | null>(null);

  const reset = () => { setEmail(""); setFullName(""); setPhone(""); setRole("agent"); setCreds(null); };

  if (creds) {
    return (
      <CredentialsBox
        email={creds.email} password={creds.password} placeholder={creds.placeholder}
        subject="Team member login" doneLabel="Done"
        onDone={() => { reset(); onFinished?.(); }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold mb-1">Add a team member</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Enter their details and either email an invite, or create their login now and hand them the password.
        The role is granted immediately — no approval wait.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (mode === "invite" && !email.trim()) { toast.error("An email is required to send an invite"); return; }
          setBusy(true);
          try {
            const res = await create({ data: {
              mode, role,
              email: email.trim() || undefined,
              full_name: fullName.trim() || undefined,
              phone: phone.trim() || undefined,
            } });
            const acc = res.account;
            if (acc.mode === "password" && acc.tempPassword) {
              toast.success(`${role} account created`);
              setCreds({ email: acc.email, password: acc.tempPassword, placeholder: !!acc.placeholder });
              return; // stay so the credentials can be copied
            }
            toast.success(`Invite sent to ${acc.email} as ${role}`);
            reset();
            onFinished?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-2">
          {([
            ["password", "Create their login now with a temporary password (email optional)"],
            ["invite", "Email them a magic-link invite (email required)"],
          ] as const).map(([key, label]) => (
            <label key={key}
              className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer ${mode === key ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
              <input type="radio" name="team_mode" className="mt-1" checked={mode === key} onChange={() => setMode(key)} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Full name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Email {mode === "invite" ? "*" : "(optional)"}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Role *</Label>
          <div className="space-y-2">
            {TEAM_ROLE_INFO.map((r) => (
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

        <Button type="submit" className="w-full" disabled={busy}>
          <UserPlus className="h-4 w-4 mr-2" />
          {busy ? "Saving…" : mode === "invite" ? "Send invite" : "Create login"}
        </Button>
      </form>
    </div>
  );
}
