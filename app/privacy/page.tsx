import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy | AdScale", description: "How AdScale collects, uses, and protects your data.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="30 August 2026">
      <section>
        <h2 className="text-xl font-medium">Who we are</h2>
        <p className="mt-2">AdScale is a creative-intelligence platform for advertising agencies and brands. This policy explains what data we collect when you use AdScale, why we collect it, and the choices you have.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">What we collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Account details you give us: your name, work email, and organisation.</li>
          <li>Advertising data you connect: when you link a Meta ad account, we read its ads, spend, and performance metrics to power the product. We do not post to your account or change your campaigns.</li>
          <li>Usage data: how you use AdScale, so we can keep it reliable and improve it.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-medium">How we use it</h2>
        <p className="mt-2">We use your data only to run and improve AdScale: to show you your account, generate recommendations, and support you. We do not sell your data.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">How we protect it</h2>
        <p className="mt-2">Access tokens for connected ad accounts are encrypted at rest and are never sent to your browser. Access is limited to your own organisation. We use industry-standard security controls on our hosting and database.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Your choices</h2>
        <p className="mt-2">You can disconnect an ad account at any time, and you can ask us to delete your account and associated data. See <a className="text-[var(--accent)] hover:underline" href="/data-deletion">Data deletion</a>.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Contact</h2>
        <p className="mt-2">Questions about privacy? Email <a className="text-[var(--accent)] hover:underline" href="mailto:privacy@adscaledigital.co">privacy@adscaledigital.co</a>.</p>
      </section>
    </LegalPage>
  );
}
