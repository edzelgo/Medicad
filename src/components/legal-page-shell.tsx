import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import logoAsset from "@/assets/logo.png.asset.json";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-background sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center" aria-label="Medicaid Success — Home">
            <img
              src={logoAsset.url}
              alt="Medicaid Success"
              className="h-10 w-auto"
            />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
          <h1 className="font-serif text-4xl lg:text-5xl text-primary mb-4">{title}</h1>
          <p className="text-sm text-muted-foreground mb-10">
            This page is maintained by Medicaid Success to answer common questions about our
            onboarding portal, services, and data practices. It is not legal advice and does not
            create an attorney-client relationship.
          </p>
          <div className="prose prose-blue max-w-none text-foreground">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-foreground">
          <span>© {new Date().getFullYear()} Medicaid Success. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-primary transition">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="hover:text-primary transition">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
