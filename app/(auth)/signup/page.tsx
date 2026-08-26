import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <AuthForm
      mode="signup"
      title="Create your AdBrain account"
      cta="Sign up"
      altText="Already have an account?"
      altHref="/login"
      altLabel="Log in"
    />
  );
}
