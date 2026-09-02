import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

// SEO (Phase-0 audit): inherited the root title/canonical and was indexable. Never index a password flow.
export const metadata: Metadata = { title: "Choose a new password - AdScale", robots: { index: false, follow: true } };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
