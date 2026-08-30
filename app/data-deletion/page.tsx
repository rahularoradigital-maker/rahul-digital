import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Data Deletion & Export | AdBrain", description: "How to delete or export your AdBrain data." };

export default function DataDeletionPage() {
  return (
    <LegalPage title="Data deletion and export" updated="30 August 2026">
      <section>
        <h2 className="text-xl font-medium">Disconnect an ad account</h2>
        <p className="mt-2">You can disconnect any connected Meta ad account from Settings at any time. When you disconnect, we stop syncing new data and remove the stored access token.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Delete your account and data</h2>
        <p className="mt-2">To permanently delete your AdBrain account and all associated data, email <a className="text-[var(--accent)] hover:underline" href="mailto:privacy@adbrain.ai?subject=Delete%20my%20AdBrain%20data">privacy@adbrain.ai</a> from your account email. We will confirm and complete the deletion within 30 days, and remove your organisation&apos;s data unless another member still needs it.</p>
      </section>
      <section>
        <h2 className="text-xl font-medium">Export your data</h2>
        <p className="mt-2">Want a copy of your data before you go? Ask in the same email and we will provide an export of your account and analysis data.</p>
      </section>
    </LegalPage>
  );
}
