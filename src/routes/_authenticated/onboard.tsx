import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ClientOnboardForm, TeamOnboardForm } from "@/components/crm/onboard-forms";
import { myOnboardAccess } from "@/lib/onboarding.functions";
import { UserPlus, Users } from "lucide-react";

const searchSchema = z.object({
  tab: z.enum(["client", "team"]).optional().default("client"),
});

export const Route = createFileRoute("/_authenticated/onboard")({
  validateSearch: (s) => searchSchema.parse(s),
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const isAdmin = onboarderRole === "admin";
  // The URL drives the tab so the CRM's two buttons land straight on the right
  // one. Non-admins only ever get the client form.
  const tab: "client" | "team" = isAdmin ? search.tab : "client";
  const setTab = (t: "client" | "team") => navigate({ search: { tab: t }, replace: true });

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
                ? "Add a new client intake, or add a team member to the CRM."
                : "Submit a new resident referral. Fields match the Facility Intake spec."}
            </p>
          </div>
          <Link
            to={onboarderRole === "referral" ? "/referrals" : onboarderRole === "admin" || onboarderRole === "agent" ? "/crm/onboarding" : "/portal"}
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

        {(!isAdmin || tab === "client") && <ClientOnboardForm onboarderRole={onboarderRole} />}
        {isAdmin && tab === "team" && <div className="max-w-xl"><TeamOnboardForm /></div>}
      </main>
    </div>
  );
}
