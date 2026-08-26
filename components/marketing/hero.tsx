import { EmailCapture } from "@/components/marketing/email-capture";

export function Hero() {
  return (
    <section id="top" className="pt-20 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="max-w-[820px] text-5xl leading-[1.08] tracking-tight sm:text-6xl md:text-[64px]">
          Every ad decision,
          <br />
          <span className="text-[var(--ink-muted)]">made by AI.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-muted)]">
          AdBrain reads your real Meta ads and tells you what to scale, refresh, or kill, and why.
          Decide what to test and stop at scale, without the guesswork.
        </p>
        <div className="mt-8">
          <EmailCapture />
        </div>
        <p className="mt-3 max-w-[460px] text-xs text-[var(--ink-muted)]">
          By clicking Book a demo, you agree to be contacted for marketing purposes. Review our{" "}
          <span className="underline">Privacy Policy</span>.
        </p>
      </div>
    </section>
  );
}
