import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of Service | AdScale", description: "The terms that govern your use of AdScale." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="30 August 2026">
      <section>
        <h2 className="text-xl font-medium">Agreement</h2>
        <p className="mt-2">By using AdScale, you agree to these terms on behalf of yourself and your organisation. If you do not agree, do not use the service.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Your account</h2>
        <p className="mt-2">You are responsible for keeping your login secure and for the activity under your account. You must have the right to connect any ad account you link to AdScale.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Acceptable use</h2>
        <p className="mt-2">Use AdScale lawfully. Do not attempt to access other organisations&apos; data, disrupt the service, or reverse engineer it.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">The service</h2>
        <p className="mt-2">AdScale provides analysis and recommendations to support your decisions. It does not guarantee any specific advertising outcome. You remain responsible for the changes you make to your campaigns.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Availability and changes</h2>
        <p className="mt-2">We work to keep AdScale available and accurate, but we may update features and these terms over time. We will post material changes here.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Contact</h2>
        <p className="mt-2">Questions about these terms? Email <a className="text-[var(--accent)] hover:underline" href="mailto:legal@adscaledigital.co">legal@adscaledigital.co</a>.</p>
      </section>
    </LegalPage>
  );
}
