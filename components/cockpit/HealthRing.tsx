// Account Health as a radial ring (0-100). The ring fill is the real
// accountHealth.score; nothing else. r=54 -> circumference ~= 339.
const R = 54;
const CIRC = 2 * Math.PI * R;

function band(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 65) return "Fair";
  if (score >= 50) return "Watch";
  return "At risk";
}

function ringColor(score: number): string {
  if (score >= 80) return "var(--good-ink)";
  if (score >= 65) return "var(--accent)";
  if (score >= 50) return "var(--warn-ink)";
  return "var(--bad-ink)";
}

export function HealthRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRC * (1 - clamped / 100);
  return (
    <div className="text-center">
      <div className="relative mx-auto h-[150px] w-[150px]">
        <svg width="150" height="150" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-alt)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={ringColor(clamped)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-semibold tracking-tight tabular-nums leading-none">{clamped}</span>
          <span className="mt-1 text-xs text-[var(--ink-muted)]">/ 100 · {band(clamped)}</span>
        </div>
      </div>
    </div>
  );
}
