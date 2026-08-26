import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <AuthForm
      mode="login"
      title="Log in to AdBrain"
      cta="Log in"
      altText="New here?"
      altHref="/signup"
      altLabel="Create an account"
    />
  );
}
