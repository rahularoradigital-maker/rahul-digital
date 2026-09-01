"use client";
import { OBJ_LABEL } from "./ObjectiveMeta";

// Per-card objective filter (client-side): narrows a cockpit card's rows to ONE campaign objective so a buyer
// can rectify objective-by-objective, independent of the global topbar filter. Rendered only when the card has
// more than one objective present (nothing to filter otherwise). The data is already on the client, so this is
// a pure local narrowing - no server round-trip, no new query (charter §83: no added cost).
export function ObjectiveCardSelect({ objectives, value, onChange }: { objectives: string[]; value: string; onChange: (v: string) => void }) {
  if (objectives.length <= 1) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filter this card by campaign objective"
      className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink)]"
    >
      <option value="all">All objectives</option>
      {objectives.map((o) => (
        <option key={o} value={o}>
          {OBJ_LABEL[o] ?? o}
        </option>
      ))}
    </select>
  );
}
