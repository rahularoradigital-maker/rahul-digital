import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

// SEO (Phase-0 audit, live-verified): this page inherited the root's title/description/canonical "/" and
// read to Google as a duplicate of the homepage. Unique title + self-canonical (a real conversion page).
export const metadata: Metadata = {
  title: "Create your account - AdScale",
  description: "Create an AdScale account and connect your Meta ad account to see what to scale, refresh, or pause.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <AuthForm
      mode="signup"
      title="Create your AdScale account"
      cta="Sign up"
      altText="Already have an account?"
      altHref="/login"
      altLabel="Log in"
    />
  );
}
