// Tiny inline trend line for one metric's day-wise values: no axes, no labels, just the shape + an
// endpoint dot. Pure SVG, so it renders in BOTH server and client components. A day with no value
// (null ratio) is a gap in the line, never a fabricated 0. Shared by the Media KPI grid and the
// cockpit funnel card so there is one sparkline implementation, not two.
export function Sparkline({ values, height = 30 }: { values: (number | null)[]; height?: number }) {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const W = 120;
  const H = height;
  const pad = 2;
  if (nums.length === 0) return <div style={{ height }} aria-hidden="true" />;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const n = values.length;
  const xAt = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2));
  const yAt = (v: number) => pad + (H - pad * 2) - ((v - min) / range) * (H - pad * 2);

  let d = "";
  let pen = false;
  let lastPt: { x: number; y: number } | null = null;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    const x = xAt(i);
    const y = yAt(v as number);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    pen = true;
    lastPt = { x, y };
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" className="block">
      <path d={d.trim()} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r="2" fill="var(--accent)" />}
    </svg>
  );
}
