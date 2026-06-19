import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
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
} from "lucide-react";
import heroCouple from "@/assets/hero-elderly-couple.jpg";
import imgNursingHome from "@/assets/service-nursing-home.jpg";
import imgPace from "@/assets/service-pace.jpg";
import imgHomeCare from "@/assets/service-home-care.jpg";
import imgIndividuals from "@/assets/service-individuals.jpg";

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

const navItems = [
  { label: "Nursing Homes", href: "#services" },
  { label: "PACE Organizations", href: "#services" },
  { label: "Home Care", href: "#services" },
  { label: "Individuals", href: "#services" },
  { label: "Request a Demo", href: "#contact" },
  { label: "Contact", href: "#contact" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 backdrop-blur-sm bg-background/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-md bg-[var(--gradient-emerald)] flex items-center justify-center">
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
          <Link
            to="/auth"
            search={{ role: "client" as const }}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-95 transition"
          >
            Sign in <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero band */}
      <section className="relative bg-[var(--gradient-emerald)] text-primary-foreground overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, oklch(0.95 0.05 95) 0%, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.78 0.13 86) 0%, transparent 45%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-foreground font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Long-term care Medicaid planning
            </span>
            <h1 className="mt-5 font-serif text-5xl lg:text-7xl leading-[1.02] tracking-tight">
              Medicaid <span className="text-accent font-bold">Success</span>
            </h1>
            <p className="mt-6 text-lg lg:text-xl text-primary-foreground max-w-xl leading-relaxed">
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
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-deep/90 via-emerald-deep/60 to-transparent p-6">
                <p className="font-serif text-xl leading-snug text-primary-foreground">
                  &ldquo;A highly effective, low-cost way to manage long-term care Medicaid.&rdquo;
                </p>
                <p className="mt-2 text-sm text-primary-foreground">Trusted by nursing homes, PACE organizations & home care nationwide.</p>
              </figcaption>
            </figure>
          </div>
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
                  <div className="absolute inset-0 bg-emerald-deep/25" aria-hidden />
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
                  <div className="h-11 w-11 rounded-lg bg-[var(--gradient-emerald)] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="mt-5 font-serif text-xl text-foreground">{w.title}</h3>
                  <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{w.body}</p>
                </div>
              );
            })}
          </div>
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
            <p className="mt-8 text-xs text-foreground/80 italic">
              Medicaid Success is not a free service, nor is it a government agency.
            </p>
          </div>

          <form
            className="rounded-xl border border-border bg-card p-7 shadow-[var(--shadow-card)] space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First Name" type="text" name="firstName" />
              <Field label="Last Name" type="text" name="lastName" />
              <Field label="Email" type="email" name="email" />
              <Field label="Phone" type="tel" name="phone" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Type of Inquiry</label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option>Nursing Home Resident</option>
                <option>Nursing Home Facility</option>
                <option>PACE Organization</option>
                <option>Home Care Provider</option>
                <option>Individual / Family</option>
              </select>
            </div>
            <label className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
              <input type="checkbox" className="mt-0.5" />
              <span>I agree to receive SMS text messages from Medicaid Success regarding my inquiry. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent is not a condition of submission.</span>
            </label>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-95 transition"
            >
              Submit <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-xs text-foreground/80">
              <a href="#" className="underline hover:text-primary">Privacy Policy & SMS Terms of Service</a>
            </p>
          </form>
        </div>
      </section>

      <footer className="border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-foreground/80">
          <span>© {new Date().getFullYear()} Medicaid Success. All rights reserved.</span>
          <span className="font-serif italic">Long-term care Medicaid planning, made simple.</span>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, type, name }: { label: string; type: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
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
