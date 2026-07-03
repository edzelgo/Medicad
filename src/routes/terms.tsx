import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/legal-page-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Medicaid Success" },
      { name: "description", content: "Terms and conditions for using the Medicaid Success onboarding portal and long-term care Medicaid planning services." },
      { property: "og:title", content: "Terms & Conditions — Medicaid Success" },
      { property: "og:description", content: "Terms and conditions for using the Medicaid Success onboarding portal and long-term care Medicaid planning services." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://medicaid-sucess-onboarding.lovable.app/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://medicaid-sucess-onboarding.lovable.app/terms" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPageShell title="Terms & Conditions">
      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">1. Acceptance of terms</h2>
        <p>
          By accessing or using the Medicaid Success website, portals, or services (collectively,
          the "Services"), you agree to be bound by these Terms & Conditions. If you do not agree,
          please do not use the Services.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">2. Who we are</h2>
        <p>
          Medicaid Success is a private long-term care Medicaid planning firm. We help nursing
          homes, PACE organizations, home care providers, agents, referral partners, and
          individuals navigate the long-term care Medicaid application and eligibility process.
          We are not a government agency, and our services are not free.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">3. Not legal, financial, or government advice</h2>
        <p>
          The information provided through our Services is for general guidance and onboarding
          purposes only. It is not legal advice, tax advice, financial planning advice, or a
          guarantee of Medicaid eligibility. Medicaid rules vary by state and change frequently.
          Every case is unique, and eligibility is determined by the appropriate state Medicaid
          agency.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">4. Accounts and acceptable use</h2>
        <p>
          To use the client, agent, or referral portals, you must create an account and provide
          accurate, complete information. You are responsible for keeping your login credentials
          secure and for all activity under your account. You may not use the Services for any
          unlawful purpose, to misrepresent your identity, or to submit false or fraudulent
          information.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">5. Services and fees</h2>
        <p>
          Fees for Medicaid planning services are agreed upon separately between you and Medicaid
          Success before work begins. Pricing shown on the website is for general reference and
          does not constitute an offer or contract. We reserve the right to modify our services and
          pricing at any time.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">6. Intellectual property</h2>
        <p>
          All content on this website, including text, graphics, logos, and software, is owned by
          Medicaid Success or its licensors and is protected by copyright and other intellectual
          property laws. You may not copy, reproduce, distribute, or create derivative works without
          our prior written permission.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">7. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Medicaid Success is not liable for any indirect,
          incidental, consequential, or punitive damages arising from your use of the Services or
          any Medicaid eligibility outcome. Our total liability for any claim relating to the
          Services is limited to the amount you paid us for the specific service giving rise to
          the claim.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">8. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Medicaid Success and its officers, employees,
          and agents from any claims, damages, or expenses arising from your use of the Services,
          your account, or any violation of these Terms.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">9. Governing law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which Medicaid Success is
          headquartered, without regard to conflict-of-law principles. Any dispute will be resolved
          in the courts located in that jurisdiction. Please contact us if you need the specific
          governing state or county.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">10. Changes to these terms</h2>
        <p>
          We may update these Terms from time to time. The latest version will always be posted on
          this page with an updated effective date. Continued use of the Services after changes
          constitutes your acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl text-primary mb-3">11. Contact us</h2>
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:Mike@medicaidsuccess.com" className="text-primary hover:underline">
            Mike@medicaidsuccess.com
          </a>{" "}
          or call 888-615-6144.
        </p>
      </section>
    </LegalPageShell>
  );
}
