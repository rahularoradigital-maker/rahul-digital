import { AuthForm } from "@/components/auth-form";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <AuthForm
      title="Create your AdBrain account"
      cta="Sign up"
      action={signup}
      altText="Already have an account?"
      altHref="/login"
      altLabel="Log in"
    />
  );
}
