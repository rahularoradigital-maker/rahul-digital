// The one-line cockpit verdict: a quantified synthesis of what to do this week, grounded ONLY in the
// real numbers already on the view (money at stake, do-now count, winners, fatiguing). It leads with
// the biggest money lever and the concrete action, so the top of the screen reads as a decision, not
// a header. Honesty first: when there is no urgent leak it says so plainly rather than inventing a
// to-do (no manufactured urgency). Pure + deterministic; fmt is injected so it uses the app's rupee
// formatter without this module importing it.

export type VerdictInputs = {
  atStakeRs: number; // money actively bleeding this window (wasted + at-risk), from view.opportunity
  doNowCount: number; // number of DO_NOW actions in the queue
  winners: number; // ads with a winner verdict
  fatiguing: number; // ads fatiguing / at risk
};

export function cockpitVerdict(m: VerdictInputs, fmt: (n: number) => string): string {
  const parts: string[] = [];
  if (m.atStakeRs > 0) {
    const where = m.doNowCount > 0 ? ` across ${m.doNowCount} do-now ${m.doNowCount === 1 ? "fix" : "fixes"}` : "";
    parts.push(`${fmt(m.atStakeRs)} is bleeding${where} - stop it first`);
  }
  if (m.winners > 0) {
    parts.push(`${m.winners} winner${m.winners === 1 ? "" : "s"} to protect and scale`);
  } else if (m.fatiguing > 0) {
    parts.push(`${m.fatiguing} ad${m.fatiguing === 1 ? "" : "s"} fatiguing - watch closely`);
  }
  if (parts.length === 0) {
    return "No urgent money leaks this window. Hold, gather more data, and test new creative.";
  }
  return `${parts.join("; ")}.`;
}
