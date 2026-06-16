import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Shield, Users, UserPlus, FileCheck, Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medicaid Success — Onboarding made dignified" },
      { name: "description", content: "Secure portals for agents, referral partners, and clients to onboard, upload documents, and track every step of the Medicaid application." },
      { property: "og:title", content: "Medicaid Success — Onboarding made dignified" },
      { property: "og:description", content: "Three private portals. One trusted process. Upload, track, and get approved with Medicaid Success." },
    ],
  }),
  component: Index,
});

const portals = [
  {
    role: "agent" as const,
    title: "Agent Portal",
    kicker: "For licensed producers",
    description: "Submit licensing, sign producer agreements, and track every client you've referred — all in one secure workspace.",
    icon: Shield,
    points: ["Producer onboarding checklist", "License & E&O document vault", "Referral pipeline tracking"],
  },
  {
    role: "referral" as const,
    title: "Referral Partner",
    kicker: "For hospitals, clinics & community orgs",
    description: "Refer patients with confidence. Upload partnership documents and receive weekly status updates on every case.",
    icon: UserPlus,
    points: ["Partner agreement uploads", "Patient packet submission", "Weekly case updates"],
  },
  {
    role: "client" as const,
    title: "Client Portal",
    kicker: "For Medicaid applicants",
    description: "Upload your documents once, securely. We handle eligibility, filing, and follow-up with your state agency.",
    icon: Users,
    points: ["Identity & income verification", "Eligibility review", "Application filed for you"],
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 backdrop-blur-sm bg-background/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-[var(--gradient-emerald)] flex items-center justify-center">
              <FileCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg tracking-tight">Medicaid<span className="text-accent">.</span>Success</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#portals" className="hover:text-foreground transition">Portals</a>
            <a href="#process" className="hover:text-foreground transition">Process</a>
            <a href="#trust" className="hover:text-foreground transition">Trust & Privacy</a>
          </nav>
          <Link
            to="/auth"
            search={{ role: "client" as const }}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-95 transition"
          >
            Sign in <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-[0.06]" aria-hidden>
          <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[var(--emerald)] blur-3xl" />
          <div className="absolute top-60 -left-20 h-[420px] w-[420px] rounded-full bg-[var(--gold)] blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-12 lg:pt-28 lg:pb-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground border border-border rounded-full px-3 py-1 bg-card">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Medicaid onboarding · est. 2014
            </span>
            <h1 className="mt-6 font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight">
              Onboarding for Medicaid, <em className="text-accent not-italic">made dignified.</em>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              We guide patients, agents, and referral partners through every form, signature, and follow-up — so applications get filed correctly, the first time. Choose your portal below to begin.
            </p>
          </div>
        </div>
      </section>

      {/* Three login portals */}
      <section id="portals" className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
        <div className="grid lg:grid-cols-3 gap-6">
          {portals.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.role}
                to="/auth"
                search={{ role: p.role }}
                className="group relative flex flex-col rounded-xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-lg bg-[var(--gradient-emerald)] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{p.kicker}</span>
                </div>
                <h3 className="mt-6 font-serif text-2xl">{p.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-[var(--emerald)] shrink-0" />
                      <span className="text-foreground/80">{pt}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7 pt-6 border-t border-border/70 flex items-center justify-between">
                  <span className="text-sm font-medium">Sign in or create account</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Process */}
      <section id="process" className="border-y border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">How it works</span>
              <h2 className="mt-3 font-serif text-4xl max-w-xl">A single, secure process for every account.</h2>
            </div>
            <p className="text-muted-foreground max-w-md">From the moment you sign in, every document, status update, and required action lives in one place — visible to you and your assigned specialist.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
            {[
              { n: "01", t: "Choose your portal", d: "Agent, referral partner, or client — your workspace is tailored to your role." },
              { n: "02", t: "Upload documents", d: "Securely upload up to 200 files. We accept PDFs, images, and scans." },
              { n: "03", t: "We compile & file", d: "One click compresses everything into a single, court-ready PDF packet." },
              { n: "04", t: "Track every check-in", d: "Status timeline + checklist shows exactly what we're doing for you." },
            ].map((s) => (
              <div key={s.n} className="bg-background p-7">
                <div className="font-serif text-accent text-lg">{s.n}</div>
                <h3 className="mt-3 font-serif text-xl">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trust & Privacy</span>
            <h2 className="mt-3 font-serif text-4xl">Your records, treated with the seriousness they deserve.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Every file is encrypted in transit and at rest. Access is scoped to you and the specialist assigned to your case. We never sell data, and we retain only what's required to file your application.
            </p>
            <ul className="mt-8 grid sm:grid-cols-2 gap-4 text-sm">
              {["End-to-end encryption", "Role-based access controls", "Audit trail on every action", "HIPAA-aligned workflows"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Lock className="h-4 w-4 text-accent" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl bg-[var(--gradient-emerald)] p-10 flex flex-col justify-between text-primary-foreground shadow-[var(--shadow-elegant)]">
              <div>
                <FileCheck className="h-8 w-8 text-accent" />
                <p className="mt-8 font-serif text-3xl leading-snug">
                  &ldquo;They turned a stack of paperwork into a single afternoon. My mother had coverage within weeks.&rdquo;
                </p>
              </div>
              <div className="text-sm opacity-80">
                <div className="font-medium text-primary-foreground">Renata C.</div>
                <div>Client, approved Spring 2025</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Medicaid Success. All rights reserved.</span>
          <span className="font-serif italic">Onboarding for Medicaid, made dignified.</span>
        </div>
      </footer>
    </div>
  );
}
