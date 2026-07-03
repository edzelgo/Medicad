import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Building2,
  HeartHandshake,
  Home,
  User,
  FileCheck,
  Phone,
  Printer,
  Mail,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  DollarSign,
  Users as UsersIcon,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  HomeIcon,
  Building,
  Stethoscope,
  Plus,
  Minus,
} from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { useStaffStatus } from "@/hooks/use-staff-status";
import { SupportChatbot } from "@/components/support-chatbot";
import { createDebugLogger } from "@/lib/debug-logger";
import heroCouple from "@/assets/hero-elderly-couple.jpg";
import imgNursingHome from "@/assets/service-nursing-home.jpg";
import imgPace from "@/assets/service-pace.jpg";
import imgHomeCare from "@/assets/service-home-care.jpg";
import imgIndividuals from "@/assets/service-individuals.jpg";
import portrait1 from "@/assets/senior-portrait-1.jpg";
import portrait2 from "@/assets/senior-portrait-2.jpg";
import seniorFamily from "@/assets/senior-family.jpg";
import seniorCommunity from "@/assets/senior-community.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medicaid Success — Long-term care Medicaid planning solutions" },
      { name: "description", content: "Medicaid Success offers low-cost, highly effective long-term care Medicaid planning for nursing homes, PACE organizations, home care providers, and individuals." },
      { property: "og:title", content: "Medicaid Success — Long-term care Medicaid planning" },
      { property: "og:description", content: "Solutions for nursing homes, PACE organizations, home care, and individuals navigating long-term care Medicaid." },
    ],
  }),
  component: Index,
});

const services = [
  {
    title: "Nursing Homes",
    brand: "Medicaid Success™",
    description: "A highly effective and low-cost way to manage your facility's Medicaid population.",
    icon: Building2,
    href: "/services/nursing-homes",
    image: imgNursingHome,
    alt: "Nurse helping an elderly woman with paperwork in a nursing home",
  },
  {
    title: "PACE Organizations",
    brand: "Medicaid Success™",
    description: "A low-cost solution for all of your Medicaid application needs.",
    icon: HeartHandshake,
    href: "/services/pace",
    image: imgPace,
    alt: "Elderly man laughing with a caregiver at a PACE day program",
  },
  {
    title: "Home Care",
    brand: "Medicaid Success at Home™",
    description: "Designed to work directly with home care agencies to help prospective clients with full Medicaid eligibility needs.",
    icon: Home,
    href: "/services/home-care",
    image: imgHomeCare,
    alt: "Home care aide assisting an elderly woman in her living room",
  },
  {
    title: "Individuals",
    brand: "Medicaid Success Select™",
    description: "We take over the challenging process of protecting your assets and applying for LTC Medicaid.",
    icon: User,
    href: "/services/individuals",
    image: imgIndividuals,
    alt: "Adult daughter and elderly father reviewing documents together",
  },
];

const whyChoose = [
  { icon: ShieldCheck, title: "Specialized expertise", body: "Our team focuses exclusively on long-term care Medicaid — application, eligibility, and asset protection." },
  { icon: DollarSign, title: "Low cost, high value", body: "Transparent pricing that reduces the administrative burden on your facility or family." },
  { icon: Clock, title: "Fast turnarounds", body: "We move applications through quickly so coverage starts when it's needed." },
  { icon: UsersIcon, title: "Dedicated specialists", body: "Every case is assigned to a specialist who owns it from intake to approval." },
];

const testimonials = [
  {
    quote: "They walked our family through every form and every deadline. Mom's coverage started the month she moved in.",
    name: "Linda T.",
    role: "Daughter of a resident",
    photo: portrait1,
  },
  {
    quote: "After years of running our own Medicaid desk, switching cut our paperwork in half and approvals came faster.",
    name: "Robert M.",
    role: "Nursing home administrator",
    photo: portrait2,
  },
];

const featuredTestimonial = {
  quote:
    "My husband's battle with Alzheimer's took a sudden turn for the worse. I needed assistance with the Medicaid application process and help preserving our assets. Thanks to their expertise and perseverance working directly with the state caseworker, my husband was approved for Medicaid and our assets were successfully addressed for financial security. I would highly recommend their services to anyone faced with this difficult situation.",
  name: "Pat W.",
  role: "Spouse, Medicaid Success Select client",
};

const ltcCosts = [
  { icon: HomeIcon, label: "Home Health Aide", price: "$5,148", suffix: "a month" },
  { icon: Building, label: "Assisted Living", price: "$4,500", suffix: "a month" },
  { icon: Stethoscope, label: "Skilled Nursing", price: "$9,043", suffix: "a month" },
];

const painPoints = [
  "Think they have to be poor or spend their life savings to be eligible for LTC Medicaid",
  "Think LTC Medicaid will only pay for a nursing home",
  "Feel that if they don't meet the LTC Medicaid eligibility limits they can't qualify",
  "Have heard the state will take their home",
  "Believe it's too late to save money if their loved one is already getting care",
  "Are exhausted and short on time caring for a loved one",
];

const advantageBullets = [
  "On-site Medicaid eligibility assistance",
  "Get Medicaid applications approved faster",
  "Save staff time and expenses with our low-cost solution",
  "Get more participants approved for Medicaid benefits",
  "Two decades of nationwide Medicaid expertise on your side",
  "Every specialist is a Certified Medicaid Planner™",
  "We handle periodic recertifications so you never have to worry",
];

const faqs = [
  {
    q: "Do I have to be poor to qualify for long-term care Medicaid?",
    a: "No. Eligibility involves more than just income. With proper planning, many people preserve significant assets — including the family home — while still qualifying for LTC Medicaid.",
  },
  {
    q: "Will Medicaid take my house?",
    a: "In most cases, no. The family home is typically protected during the lifetime of the Medicaid recipient, and there are strategies available to protect it from estate recovery as well.",
  },
  {
    q: "Does Medicaid only pay for nursing homes?",
    a: "No. Long-term care Medicaid can cover care at home through home care agencies, through PACE programs, in assisted living (in many states), and in skilled nursing facilities.",
  },
  {
    q: "Is it too late to plan if my loved one is already receiving care?",
    a: "Almost never. There are crisis planning strategies that can still preserve assets and accelerate Medicaid eligibility even after care has begun.",
  },
  {
    q: "How is Medicaid Success different from a regular elder-law attorney?",
    a: "Our specialists do nothing but long-term care Medicaid all day, every day. Every case is handled by a Certified Medicaid Planner™ who manages it from intake through approval — and recertification.",
  },
  {
    q: "Is Medicaid Success a government agency or a free service?",
    a: "No. Medicaid Success is not a government agency, nor is it a free service. We are a private long-term care Medicaid planning firm.",
  },
  {
    q: "How do I get started?",
    a: "Call us at 888-615-6144, email info@medicaidsuccess.com, or fill out the contact form below. A specialist will reach out to discuss your situation.",
  },
];

const navItems = [
  { label: "Nursing Homes", href: "#services" },
  { label: "PACE Organizations", href: "#services" },
  { label: "Home Care", href: "#services" },
  { label: "Individuals", href: "#services" },
  { label: "Why Us", href: "#advantage" },
  { label: "FAQ", href: "#faq" },
  { label: "Request a Demo", href: "#contact" },
  { label: "Contact", href: "#contact" },
];

function AuthEntryLink({
  role,
  className,
  children,
}: {
  role: "agent" | "referral" | "client" | "staff";
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const href = `/auth?role=${encodeURIComponent(role)}`;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const shouldUseNativeNavigation =
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey;

    if (shouldUseNativeNavigation) return;

    event.preventDefault();
    event.stopPropagation();

    log.debug("trusted click captured", {
      role,
      href,
      isTrusted: event.nativeEvent.isTrusted,
      pointerType: (event.nativeEvent as PointerEvent).pointerType ?? "mouse",
    });

    window.setTimeout(() => {
      const startPath = window.location.pathname + window.location.search;
      log.debug("router.navigate start", { from: startPath, to: href });

      Promise.resolve(router.navigate({ to: "/auth", search: { role } }))
        .then(() => {
          log.debug("router.navigate resolved", {
            current: window.location.pathname + window.location.search,
          });
        })
        .catch((error) => {
          log.error("router.navigate failed; falling back to native navigation", error);
          window.location.assign(href);
        });

      window.setTimeout(() => {
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== href && currentPath === startPath) {
          log.warn("navigation did not complete; falling back to native navigation", {
            current: currentPath,
            expected: href,
          });
          window.location.assign(href);
        }
      }, 350);
    }, 0);
  };

  return (
    <a href={href} className={className} onClickCapture={handleClick}>
      {children}
    </a>
  );
}

const log = createDebugLogger("auth-entry");

function Index() {
  const { isStaff } = useStaffStatus();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-background sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-md bg-gradient-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg tracking-tight leading-tight text-foreground">
              Medicaid<br className="hidden sm:inline" />
              <span className="text-primary">Success</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-foreground">
            {navItems.map((n) => (
              <a key={n.label} href={n.href} className="hover:text-primary transition">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isStaff && (
              <Link
                to="/admin/users"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted transition"
              >
                Admin
              </Link>
            )}
            {!isStaff && (
              <AuthEntryLink
                role="staff"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-border text-foreground hover:bg-muted transition"
              >
                Staff sign in
              </AuthEntryLink>
            )}
            <AuthEntryLink
              role="client"
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-95 transition"
            >
              Sign in <ArrowRight className="h-3.5 w-3.5" />
            </AuthEntryLink>
          </div>
        </div>
      </header>

      {/* Hero band */}
      <section className="relative bg-gradient-primary text-primary-foreground overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, oklch(0.94 0.02 250) 0%, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.52 0.15 276) 0%, transparent 45%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold text-primary-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Long-term care Medicaid planning
            </span>
            <h1 className="mt-5 font-serif text-5xl lg:text-7xl leading-[1.02] tracking-tight text-primary-foreground">
              Medicaid <span className="font-bold text-primary-foreground">Success</span>
            </h1>
            <p className="mt-6 text-lg lg:text-xl max-w-xl leading-relaxed text-primary-foreground">
              No matter your long-term care Medicaid planning need, we have a solution for you — for nursing homes, PACE organizations, home care providers, and individuals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:opacity-95 transition"
              >
                Request a Demo <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#services"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10 transition"
              >
                Explore solutions
              </a>
            </div>
          </div>
          <div className="hidden lg:flex justify-end">
            <figure className="relative w-full max-w-md rounded-2xl overflow-hidden border border-primary-foreground/20 shadow-[var(--shadow-elegant)]">
              <img
                src={heroCouple}
                alt="Smiling elderly couple holding hands in a sunlit nursing home"
                width={1024}
                height={1024}
                className="w-full h-full object-cover aspect-square"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/90 via-primary/60 to-transparent p-6">
                <p className="font-serif text-xl leading-snug text-primary-foreground">
                  &ldquo;A highly effective, low-cost way to manage long-term care Medicaid.&rdquo;
                </p>
                <p className="mt-2 text-sm text-primary-foreground">Trusted by nursing homes, PACE organizations & home care nationwide.</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Portal sign-in cards */}
      <section id="portals" className="max-w-7xl mx-auto px-6 lg:px-10 -mt-10 lg:-mt-14 relative z-10">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { role: "client" as const, title: "Client Portal", desc: "Upload your Medicaid documents securely and track your case.", cta: "Client sign in" },
            { role: "agent" as const, title: "Agent Portal", desc: "Submit client packets, manage referrals, and track approvals.", cta: "Agent sign in" },
            { role: "referral" as const, title: "Referral Portal", desc: "For nursing homes, PACE, and home care partners.", cta: "Referral sign in" },
          ].map((p) => (
            <div key={p.role} className="rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] p-7 flex flex-col">
              <h3 className="font-serif text-2xl text-primary">{p.title}</h3>
              <p className="mt-2 text-foreground text-base leading-relaxed flex-1">{p.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <AuthEntryLink
                  role={p.role}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-95 transition"
                >
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </AuthEntryLink>
                <AuthEntryLink
                  role={p.role}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-foreground hover:bg-muted transition"
                >
                  Create account
                </AuthEntryLink>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The Medicaid Success Advantage */}
      <section id="services" className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Our Solutions</span>
          <h2 className="mt-3 font-serif text-4xl lg:text-5xl text-primary">The Medicaid Success Advantage</h2>
          <p className="mt-5 text-foreground text-lg">
            No matter your long-term care Medicaid planning need, we have a solution for you.
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex flex-col items-center text-center group">
                <div className="relative h-44 w-44 rounded-full overflow-hidden shadow-[var(--shadow-card)] ring-4 ring-card transition-transform group-hover:-translate-y-1">
                  <img
                    src={s.image}
                    alt={s.alt}
                    width={1024}
                    height={768}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-primary/25" aria-hidden />
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider">
                    <Icon className="h-3 w-3" strokeWidth={2.5} />
                    {s.brand.replace("™", "")}
                  </div>
                </div>
                <h3 className="mt-7 font-serif text-2xl text-foreground">{s.title}</h3>
                <p className="mt-3 text-base text-foreground leading-relaxed max-w-xs">
                  {s.description}
                </p>
                <a
                  href="#contact"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 underline-offset-4 hover:underline transition"
                >
                  View More <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why Choose */}
      <section className="border-y border-border bg-secondary/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-serif text-4xl text-primary">Why Choose Medicaid Success™?</h2>
            <p className="mt-4 text-foreground">
              A team built for long-term care Medicaid — nothing else. That focus is the difference.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyChoose.map((w) => {
              const Icon = w.icon;
              return (
                <div key={w.title} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className="h-11 w-11 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="mt-5 font-serif text-xl text-foreground">{w.title}</h3>
                  <p className="mt-2 text-sm text-foreground leading-relaxed">{w.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stop the confusion / pain points */}
      <section className="bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Stop the confusion</span>
            <h2 className="mt-3 font-serif text-4xl text-primary">You shouldn't have to do this on your own</h2>
            <p className="mt-4 text-foreground text-lg leading-relaxed">
              Figuring out how to save money and apply for long-term care Medicaid is overwhelming — and the stakes for your loved one's physical, emotional, and financial future are too high to make a mistake. Most families we meet…
            </p>
          </div>
          <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {painPoints.map((p) => (
              <li
                key={p}
                className="flex gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
                <span className="text-foreground leading-snug">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* LTC cost cards */}
      <section className="bg-secondary/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Long-term care is expensive</span>
            <h2 className="mt-3 font-serif text-4xl text-primary">And Medicare doesn't cover it</h2>
            <p className="mt-4 text-foreground">
              National average monthly costs according to the Genworth Cost of Care Survey.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {ltcCosts.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
                  <div className="mx-auto h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h3 className="mt-5 font-serif text-xl text-foreground">{c.label}</h3>
                  <p className="mt-3 font-serif text-4xl text-primary font-bold">{c.price}</p>
                  <p className="mt-1 text-sm text-foreground">{c.suffix}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The Medicaid Success Advantage — detailed bullets + boost/cut */}
      <section id="advantage" className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">What you get</span>
          <h2 className="mt-3 font-serif text-4xl text-primary">The Medicaid Success Advantage</h2>
          <p className="mt-4 text-foreground">
            On-site Medicaid eligibility assistance — built to boost revenue and cut expenses for your facility or family.
          </p>
        </div>
        <ul className="mt-12 grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {advantageBullets.map((b) => (
            <li key={b} className="flex gap-3 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" aria-hidden />
              <span className="text-foreground">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-gradient-primary flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-serif text-2xl text-primary">Boost Revenue</h3>
            </div>
            <ul className="mt-5 space-y-3 text-foreground">
              <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> Outsource your applications to certified specialists</li>
              <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> Get applications approved faster</li>
              <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> Solve eligibility barriers before they cost you money</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-gradient-primary flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-serif text-2xl text-primary">Cut Expenses</h3>
            </div>
            <ul className="mt-5 space-y-3 text-foreground">
              <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> Less work, faster turnaround, more value</li>
              <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> Cut staff expenses</li>
              <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" /> A dedicated Medicaid Eligibility Specialist for every case</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Featured testimonial */}
      <section className="bg-gradient-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">A family story</span>
          <blockquote className="mt-6 font-serif text-2xl lg:text-3xl leading-relaxed text-primary-foreground">
            &ldquo;{featuredTestimonial.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-6 text-sm">
            <span className="font-semibold">{featuredTestimonial.name}</span>
            <span className="opacity-90"> — {featuredTestimonial.role}</span>
          </figcaption>
        </div>
      </section>

      {/* Community band */}
      <section className="relative overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[360px]">
            <img
              src={seniorCommunity}
              alt="Group of seniors laughing together while playing cards in a community room"
              width={1536}
              height={1024}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="bg-gradient-primary text-primary-foreground p-10 lg:p-16 flex items-center">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">Dignity, comfort, community</span>
              <h2 className="mt-3 font-serif text-3xl lg:text-4xl leading-tight">
                The people we serve come first.
              </h2>
              <p className="mt-5 text-base lg:text-lg text-primary-foreground leading-relaxed">
                Behind every Medicaid application is a parent, a grandparent, a neighbor — someone who deserves to age with dignity and the care they need. We handle the paperwork so families can focus on what matters most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Voices we serve</span>
          <h2 className="mt-3 font-serif text-4xl text-primary">Families and facilities trust us</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-8">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] flex flex-col sm:flex-row gap-6 items-start"
            >
              <img
                src={t.photo}
                alt={`Portrait of ${t.name}`}
                width={1024}
                height={1024}
                loading="lazy"
                className="h-24 w-24 rounded-full object-cover ring-4 ring-secondary shrink-0"
              />
              <div>
                <blockquote className="font-serif text-lg leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <span className="text-foreground"> — {t.role}</span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>

        <div className="mt-12 rounded-2xl overflow-hidden border border-border shadow-[var(--shadow-card)] relative">
          <img
            src={seniorFamily}
            alt="Adult daughter hugging her smiling elderly mother in a bright common room"
            width={1536}
            height={1024}
            loading="lazy"
            className="w-full h-72 lg:h-96 object-cover"
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Common questions</span>
          <h2 className="mt-3 font-serif text-4xl text-primary">Frequently asked questions</h2>
          <p className="mt-4 text-foreground">
            Quick answers to the questions families and facilities ask us most often.
          </p>
        </div>
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
        <div className="mt-10 text-center text-foreground">
          Still have questions? Call us at{" "}
          <a href="tel:+18886156144" className="text-primary font-semibold underline underline-offset-4">888-615-6144</a>.
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-14">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-foreground font-semibold">Get in touch</span>
            <h2 className="mt-3 font-serif text-4xl text-primary">Contact Medicaid Success™ Today</h2>
            <p className="mt-4 text-foreground leading-relaxed">
              Speak with a long-term care Medicaid specialist about your facility, organization, or family situation.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary" aria-hidden />
                <span className="font-medium">PHONE:</span>
                <a href="tel:+18886156144" className="hover:text-primary">888-615-6144</a>
              </li>
              <li className="flex items-center gap-3">
                <Printer className="h-4 w-4 text-primary" aria-hidden />
                <span className="font-medium">FAX:</span>
                <span>888-742-4711</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" aria-hidden />
                <a href="mailto:info@medicaidsuccess.com" className="hover:text-primary">info@medicaidsuccess.com</a>
              </li>
            </ul>
            <p className="mt-8 text-xs text-foreground italic">
              Medicaid Success is not a free service, nor is it a government agency.
            </p>
          </div>

          <ContactForm />
        </div>
      </section>

      <footer className="border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-foreground">
          <span>© {new Date().getFullYear()} Medicaid Success. All rights reserved.</span>
          <span className="font-serif italic">Long-term care Medicaid planning, made simple.</span>
        </div>
      </footer>
      <SupportChatbot role="client" />
    </div>
  );
}

function Field({ label, type, name }: { label: string; type: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-semibold text-foreground uppercase tracking-wider">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    inquiryType: "Nursing Home Resident",
    smsConsent: false,
    message: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error("Please fill out your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          phone: form.phone,
          inquiryType: form.inquiryType,
          smsConsent: form.smsConsent,
          message: form.message,
          source: "medicaidsuccess.com",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not submit");
      setSuccess(true);
      toast.success("Thanks! A specialist will be in touch shortly.");
      setForm({ firstName: "", lastName: "", email: "", phone: "", inquiryType: "Nursing Home Resident", smsConsent: false, message: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-card)] text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" aria-hidden />
        <h3 className="font-serif text-2xl text-primary">Thank you!</h3>
        <p className="text-foreground">
          Your inquiry has been received. A long-term care Medicaid specialist will reach out shortly.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md border border-border text-foreground hover:bg-secondary/40 transition"
        >
          Submit another inquiry
        </button>
      </div>
    );
  }

  return (
    <form
      className="rounded-xl border border-border bg-card p-7 shadow-[var(--shadow-card)] space-y-4"
      onSubmit={onSubmit}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="text-xs font-semibold text-foreground uppercase tracking-wider">First Name</label>
          <input id="firstName" name="firstName" type="text" required value={form.firstName} onChange={set("firstName")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label htmlFor="lastName" className="text-xs font-semibold text-foreground uppercase tracking-wider">Last Name</label>
          <input id="lastName" name="lastName" type="text" required value={form.lastName} onChange={set("lastName")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label htmlFor="email" className="text-xs font-semibold text-foreground uppercase tracking-wider">Email</label>
          <input id="email" name="email" type="email" required value={form.email} onChange={set("email")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label htmlFor="phone" className="text-xs font-semibold text-foreground uppercase tracking-wider">Phone</label>
          <input id="phone" name="phone" type="tel" value={form.phone} onChange={set("phone")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
      <div>
        <label htmlFor="inquiryType" className="text-xs font-semibold text-foreground uppercase tracking-wider">Type of Inquiry</label>
        <select id="inquiryType" name="inquiryType" value={form.inquiryType} onChange={set("inquiryType")}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option>Nursing Home Resident</option>
          <option>Nursing Home Facility</option>
          <option>PACE Organization</option>
          <option>Home Care Provider</option>
          <option>Individual / Family</option>
        </select>
      </div>
      <div>
        <label htmlFor="message" className="text-xs font-semibold text-foreground uppercase tracking-wider">How can we help?</label>
        <textarea id="message" name="message" rows={4} value={form.message} onChange={set("message")}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <label className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
        <input type="checkbox" className="mt-0.5" checked={form.smsConsent} onChange={set("smsConsent")} />
        <span>I agree to receive SMS text messages from Medicaid Success regarding my inquiry. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent is not a condition of submission.</span>
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-95 transition disabled:opacity-60"
      >
        {submitting ? "Submitting..." : (<>Submit <ArrowRight className="h-4 w-4" /></>)}
      </button>
      <p className="text-xs text-foreground">
        <a href="#" className="underline hover:text-primary">Privacy Policy & SMS Terms of Service</a>
      </p>
    </form>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-secondary/40 transition"
      >
        <span className="font-serif text-lg text-foreground">{q}</span>
        {open ? (
          <Minus className="h-5 w-5 text-primary shrink-0" aria-hidden />
        ) : (
          <Plus className="h-5 w-5 text-primary shrink-0" aria-hidden />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 text-foreground leading-relaxed">{a}</div>
      )}
    </div>
  );
}
