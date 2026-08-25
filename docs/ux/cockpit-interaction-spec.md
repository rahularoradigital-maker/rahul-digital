# Cockpit Interaction Spec — Connect → Decide → Apply (inclusive by default)

Covers the spine flow: connect an ad account, pull data, act on the "Do this today"
queue, and apply. Designed across keyboard / pointer+touch / voice-control from the
start. Extends `DESIGN.md §7` (a11y floor) and enforces D12 / principle #6 (money
actions need explicit confirmation).

Voice note: "voice" here = works with OS voice-control (macOS Voice Control, Android
Voice Access), which activates controls by their accessible name. So every control has a
clear, visible, spoken-able name. We are not building a bespoke voice assistant in v1.

---

## 1. Flow diagram (interaction points marked ◆)

```
[No account] ◆Connect Meta ─OAuth→ [Meta] ─back→ [Pulling… ▮▮▯ live status]
      │ ◆Connect Google (optional)                         │
      ▼                                                     ▼
[Cockpit]
  ◆Window 7/14/30   ◆Objectives (multi)   ◆Section nav
        │
        ▼
  Do this today (per recommendation row):
     ◆Show the working → [Drawer: ◆Close/Esc]
     ◆Approve   ◆Deny   ◆Snooze        →  after: ◆Undo
        │
        ▼
  Bottom bar: ◆Review and apply → [Confirm dialog: ◆type CONFIRM, ◆Apply, ◆Cancel]
        │
        ▼
  Applied → logged to Change history (live-region announced)
```

## 2. Input method matrix (task × input)

| # | Interaction | Keyboard | Pointer / Touch | Voice-control |
|---|---|---|---|---|
| 1 | Connect Meta / Google | Tab to it, Enter/Space | button ≥44px, ≥8px gap | "Click Connect Meta" |
| 2 | Data-pull status | (not an action) live region read on focus of page | — | status is announced, not clicked |
| 3 | Window 7/14/30 | Tab to group, ←/→ between, Space selects | pills ≥44px tall, ≥8px gap | "Click 14 days" |
| 4 | Objectives (multi) | Tab, Space toggles each | pills ≥44px, ≥8px gap | "Click Purchases" |
| 5 | Section nav | Tab through links; Enter jumps + moves focus to section | ≥44px targets; horizontal scroll strip on mobile | "Click Do this" |
| 6 | Show the working | Enter/Space opens drawer | pill ≥44px | "Click working" |
| 7 | Drawer close | Esc, or Tab to × + Enter | × ≥44px | "Click close" |
| 8 | Approve | focus row, Enter, or shortcut **A** | button ≥44px, thumb zone on mobile | "Click Approve" |
| 9 | Deny | Enter, or shortcut **D** | ≥44px | "Click Deny" |
| 10 | Snooze | Enter, or shortcut **S** | ≥44px | "Click Snooze" |
| 11 | Undo | Tab to Undo, Enter | ≥44px | "Click Undo" |
| 12 | Review and apply | Tab to bottom bar, Enter | ≥44px, fixed bottom | "Click Review and apply" |
| 13 | Type CONFIRM + Apply | type in field, Tab to Apply, Enter | field + button ≥44px | "Type CONFIRM" then "Click Apply" |

No interaction is single-modality. Shortcuts A/D/S are accelerators, never the only path.

## 3. Focus order map

Page: skip-link ("Skip to Do this today") → top nav (logo, section links, live status) →
filter bar (window group, objectives group) → cockpit verdict → reads → …sections in DOM
order… → Do this today rows (each: Show-working, Approve, Deny, Snooze) → other sections →
bottom Apply bar (last in tab order but reachable; NOT visually-only).

Modals:
- **Drawer** = `role="dialog" aria-modal="true"`, labelled by its title. On open: focus moves
  to the drawer heading; focus is **trapped**; Esc closes; on close focus **returns** to the
  "working" pill that opened it.
- **Apply confirm** = `role="alertdialog"`, labelled + described (states the money impact).
  Focus moves to the CONFIRM field; trapped; Cancel or Esc returns focus to "Review and apply".
- Dynamic content (new recommendations after a refresh) does NOT steal focus; announced via
  live region instead.

## 4. Target sizes

- All interactive controls: **≥44×44px** touch target (pad small pills to reach it).
- Adjacent targets: **≥8px** spacing (approve/deny/snooze cluster spaced so a thumb can't
  hit the wrong one).
- Mobile primary actions (Approve, Review and apply) sit in the **bottom thumb zone**; the
  fixed Apply bar stays reachable.
- Focus ring: visible, ≥2px, ≥3:1 contrast against the cream background.

## 5. Feedback specification (per interaction)

Every state uses **color + icon + text** together (never color alone).

| Interaction | Visual | Screen-reader announcement | Success / Error / Loading |
|---|---|---|---|
| Connect | button → spinner | "Connecting to Meta" (polite) | success: "Meta connected" ; error: "Meta declined access, reconnect" (assertive) |
| Data pull | progress bar with counts | polite live region: "Syncing, 47 of 50 ads" | done: "Sync complete" ; error: "Sync paused, retrying" |
| Window / Objective select | pill fills ink | "14 days, selected" | instant; on recompute: "Updated" (polite) |
| Show the working | drawer slides in | "Show the working, {title}, dialog" | rows read as label + value; missing: "source unavailable" |
| Approve | row tints green, chip "approved" | "Approved: {outcome}. 1 of 6 approved." (polite) | error: "Could not stage, try again" (assertive); row stays actionable |
| Deny | row tints, chip "denied" | "Denied: {outcome}. Undo available." | undo announced |
| Snooze | row muted | "Snoozed {outcome} until tomorrow" | — |
| Undo | reverts row | "Reverted. {outcome} is back in the queue." | — |
| Review and apply | opens alertdialog | "Review and apply, dialog. This changes your live account." | — |
| Type CONFIRM | Apply button enables only on exact match | "Apply enabled" when matched | — |
| Apply | progress → history entry | "Applied {n} changes" (assertive) ; partial: "Applied 2 of 3. 1 failed: {which}." | never silent; partial failure is spoken and shown |

Live regions: `aria-live="polite"` for sync progress and decision tallies;
`aria-live="assertive"` reserved for errors and the Apply result.

## 6. The one-way door (Apply) — extra inclusive care

Applying pushes money-moving changes, so the confirm is deliberately harder for everyone,
and equally reachable by every input:
- alertdialog names exactly what changes and the money impact, in text.
- Apply stays disabled until the user types the literal word CONFIRM (works via keyboard,
  touch keyboard, and voice dictation).
- No shortcut fires Apply; it is always an explicit, focused action.
- Result (full or partial) is announced assertively and written to Change history.
