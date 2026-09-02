import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

// SEO (Phase-0 audit): inherited the root title/canonical and was indexable. Never index a password flow.
export const metadata: Metadata = { title: "Reset your password - AdScale", robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
