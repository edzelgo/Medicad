import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/components/legal-page-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Medicaid Success" },
      { name: "description", content: "Privacy Policy for the Medicaid Success onboarding portal and long-term care Medicaid planning services." },
      { property: "og:title", content: "Privacy Policy — Medicaid Success" },
      { property: "og:description", content: "Privacy Policy for the Medicaid Success onboarding portal and long-term care Medicaid planning services." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://medicaid-sucess-onboarding.lovable.app/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://medicaid-sucess-onboarding.lovable.app/privacy" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">1. About this policy</h2>
        <p>
          This Privacy Policy describes how Medicaid Success collects, uses, stores, and protects
          information when you use our website, client portal, agent portal, referral portal, or
          contact us for long-term care Medicaid planning services. This page is maintained by
          Medicaid Success as app-owned content and may be updated as our practices evolve.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">2. Information we collect</h2>
        <p className="mb-3">We collect information that you provide directly to us, including:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Contact information such as name, email address, phone number, and mailing address.</li>
          <li>Information about the person seeking Medicaid care, including health and care needs.</li>
          <li>Financial and asset information needed for Medicaid eligibility analysis.</li>
          <li>Documents uploaded through the client portal, such as identification, bank
            statements, medical records, and asset verification.</li>
          <li>Account login credentials managed through our authentication provider.</li>
          <li>Communications you send us, including form submissions, emails, and SMS replies.</li>
        </ul>
        <p className="mt-3">
          We also collect technical information automatically, such as browser type, IP address,
          and pages visited, to keep the site secure and improve performance.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">3. How we use your information</h2>
        <p className="mb-3">We use the information we collect to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide long-term care Medicaid planning services and manage your case.</li>
          <li>Communicate with you by email, phone, or SMS about your inquiry or case.</li>
          <li>Verify your identity and maintain secure access to your portal account.</li>
          <li>Process documents, coordinate with state Medicaid agencies, and support referrals.</li>
          <li>Improve our website and services and comply with legal obligations.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">4. How we share your information</h2>
        <p className="mb-3">
          We do not sell your personal information. We may share information with:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Service providers who help us operate the website, store data, and send communications.</li>
          <li>State Medicaid agencies and authorized parties, as necessary to assist with your application.</li>
          <li>Referral partners, nursing homes, PACE organizations, or home care providers when you
            have chosen to work with them through our services.</li>
          <li>Law enforcement or regulators when required by law or to protect our rights.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">5. Data retention</h2>
        <p>
          We keep your information for as long as needed to provide our services, manage your case,
          and comply with legal and professional obligations. Generally, we retain case-related
          records for five years after a case closes or an account becomes inactive, unless a
          longer period is required by law.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">6. SMS text messaging</h2>
        <p>
          If you provide your phone number and consent to SMS messages, we may send you text
          messages about your inquiry or case. Message frequency may vary. Message and data rates
          may apply. Reply STOP to opt out at any time, or reply HELP for assistance. Consent to
          receive SMS messages is not a condition of using our services or submitting an inquiry.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">7. Your choices and rights</h2>
        <p className="mb-3">
          You may update your account information or request that we correct inaccurate information
          by contacting us. You may also opt out of marketing emails by following the unsubscribe
          link in any message. To request deletion of your account or case data, subject to our
          legal retention obligations, please contact us at the email address below.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">8. Security</h2>
        <p>
          We use industry-standard security measures, including encryption in transit, access
          controls, and authenticated accounts, to protect your information. No online service
          can guarantee absolute security, but we work to keep your data safe and limit access to
          authorized staff and partners who need it to perform their jobs.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">9. Children's privacy</h2>
        <p>
          Our Services are not directed to children under 13. We do not knowingly collect personal
          information from children under 13. If you believe we have collected such information,
          please contact us immediately so we can delete it.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-2xl text-primary mb-3">10. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The latest version will always be
          posted on this page with an updated effective date. We encourage you to review this page
          periodically.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-2xl text-primary mb-3">11. Contact us</h2>
        <p>
          For questions about this Privacy Policy or to exercise your privacy rights, please contact
          us at{" "}
          <a href="mailto:Mike@medicaidsuccess.com" className="text-primary hover:underline">
            Mike@medicaidsuccess.com
          </a>{" "}
          or call 888-615-6144.
        </p>
      </section>
    </LegalPageShell>
  );
}
