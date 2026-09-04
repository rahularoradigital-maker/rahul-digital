import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Data Deletion & Export | AdScale", description: "How to delete or export your AdScale data.", alternates: { canonical: "/data-deletion" } };

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data deletion and export" updated="30 August 2026">
      <section>
        <h2 className="text-xl font-medium">Disconnect an ad account</h2>
        <p className="mt-2">You can disconnect any connected Meta ad account from Settings at any time. When you disconnect, we stop syncing new data and remove the stored access token.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Delete your account and data</h2>
        <p className="mt-2">You can delete your account yourself from <span className="font-medium">Settings &rarr; Delete account</span>. We keep your data for a 14-day grace period so you can change your mind (just cancel from the same place), then permanently erase it and revoke Meta access. Prefer email? Write to <a className="text-[var(--accent)] hover:underline" href="mailto:privacy@adscaledigital.co?subject=Delete%20my%20AdScale%20data">privacy@adscaledigital.co</a> from your account email and we will complete it within 30 days.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Export your data</h2>
        <p className="mt-2">Download a JSON copy of your account and analysis data any time from <span className="font-medium">Settings &rarr; Export your data</span>. Access tokens and other secrets are never included.</p>
      </section>
    </LegalPage>
  );
}
