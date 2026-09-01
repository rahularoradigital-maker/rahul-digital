import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Cookie Policy | AdScale", description: "How AdScale uses cookies." };

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" updated="30 August 2026">
      <section>
        <h2 className="text-xl font-medium">What we use</h2>
        <p className="mt-2">AdScale uses only the cookies it needs to work. The main one is your login session cookie, which keeps you signed in securely. Without it, the app cannot know who you are.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">What we do not use</h2>
        <p className="mt-2">We do not use advertising or cross-site tracking cookies on the product. If we add analytics in future, we will update this page and, where required, ask for your consent first.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Managing cookies</h2>
        <p className="mt-2">You can clear or block cookies in your browser settings. Blocking the session cookie will sign you out of AdScale.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Contact</h2>
        <p className="mt-2">Questions? Email <a className="text-[var(--accent)] hover:underline" href="mailto:privacy@adscaledigital.co">privacy@adscaledigital.co</a>.</p>
      </section>
    </LegalPage>
  );
}
