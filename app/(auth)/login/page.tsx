import { AuthForm } from "@/components/auth-form";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <AuthForm
      title="Log in to AdBrain"
      cta="Log in"
      action={login}
      altText="New here?"
      altHref="/signup"
      altLabel="Create an account"
    />
  );
}
