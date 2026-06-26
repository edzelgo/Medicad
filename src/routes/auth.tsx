import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Shield, UserPlus, Users } from "lucide-react";

type PortalRole = "agent" | "referral" | "client";
const roleSchema = z.enum(["agent", "referral", "client"]);

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: (roleSchema.safeParse(s.role).success ? (s.role as PortalRole) : "client") as PortalRole,
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/portal" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Medicaid Success" },
      { name: "description", content: "Sign in or create your Medicaid Success portal account." },
    ],
  }),
  component: AuthPage,
});

const roleMeta = {
  agent: { label: "Agent", icon: Shield, blurb: "Licensed producers and brokers." },
  referral: { label: "Referral Partner", icon: UserPlus, blurb: "Hospitals, clinics, community organizations." },
  client: { label: "Client", icon: Users, blurb: "Medicaid applicants and family members." },
} as const;

function AuthPage() {
  const search = Route.useSearch();
  const role = search.role as PortalRole;
  const navigate = useNavigate();
  const Icon = roleMeta[role].icon;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left visual */}
      <aside className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-primary text-primary-foreground">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-primary-foreground hover:text-primary-foreground/90">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div>
          <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center mb-8">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <h1 className="font-serif text-5xl leading-tight">
            {roleMeta[role].label} Portal.
            <br />
            <span className="text-accent italic">Securely.</span>
          </h1>
          <p className="mt-6 text-base text-primary-foreground/90 max-w-md">{roleMeta[role].blurb} Sign in to your private workspace — upload documents, track status, and see what your specialist is working on.</p>
        </div>
        <p className="text-xs text-primary-foreground/70 font-serif italic">Medicaid Success · Onboarding made dignified.</p>
      </aside>

      {/* Right form */}
      <main className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>

          {/* Role chooser */}
          <div className="flex gap-2 mb-8">
            {(["agent", "referral", "client"] as const).map((r) => {
              const RIcon = roleMeta[r].icon;
              const active = r === role;
              return (
                <Link
                  key={r}
                  to="/auth"
                  search={{ role: r }}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  <RIcon className="h-3.5 w-3.5" /> {roleMeta[r].label}
                </Link>
              );
            })}
          </div>

          <h2 className="font-serif text-3xl">{roleMeta[role].label} access</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your portal or create a new account.</p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin"><SignInForm onDone={() => navigate({ to: "/portal" })} /></TabsContent>
            <TabsContent value="signup"><SignUpForm role={role} onDone={() => navigate({ to: "/portal" })} /></TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px bg-border flex-1" /> OR <div className="h-px bg-border flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/portal" });
              if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
            }}
          >
            Continue with Google
          </Button>
        </div>
      </main>
    </div>
  );
}

const credSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Minimum 8 characters").max(128),
});

function SignInForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4 mt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = credSchema.safeParse({ email, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        setLoading(false);
        if (error) { toast.error(error.message); return; }
        toast.success("Welcome back.");
        onDone();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

const signUpSchema = credSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
});

function SignUpForm({ role, onDone }: { role: "agent" | "referral" | "client"; onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4 mt-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = signUpSchema.safeParse({ fullName, email, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setLoading(true);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal`,
            data: { full_name: parsed.data.fullName, role },
          },
        });
        setLoading(false);
        if (error) { toast.error(error.message); return; }
        toast.success("Account created. Welcome to Medicaid Success.");
        onDone();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email2">Email</Label>
        <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password2">Password</Label>
        <Input id="password2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account…" : `Create ${role} account`}</Button>
    </form>
  );
}