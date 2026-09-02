import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

// SEO (Phase-0 audit, live-verified): without its own metadata this page inherited the root's title,
// description AND canonical "/" - so Google saw /login as a duplicate of the homepage. Unique title +
// self-canonical.
export const metadata: Metadata = {
  title: "Log in - AdScale",
  description: "Log in to your AdScale account to open your Meta ads cockpit.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <AuthForm
      mode="login"
      title="Log in to AdScale"
      cta="Log in"
      altText="New here?"
      altHref="/signup"
      altLabel="Create an account"
    />
  );
}
