# Ability Spectrum Map — AdBrain Cockpit — 2026-08-25

Ratings: **Works** / **Friction** / **Workaround** / **Fails**. Cells rate the DESIGNED
target (interaction spec + DESIGN a11y floor); "(mockup gap)" flags where the current
`cockpit-v1.html` still fails until the spec is built. Hearing is mostly N/A (no app audio)
except video-ad playback in the leaderboard — noted separately.

Key context: our first segment (non-technical in-house D2C owners) sits toward the
"needs plain language" end of the COGNITIVE spectrum. Cognitive accessibility here is not
an edge case; it is the core user.

## Vision spectrum

| Task | Full | Low vision (magnify) | Screen-reader only |
|---|---|---|---|
| Connect account | Works | Works | Works (labeled buttons) |
| Read verdict + score | Works | Friction — 9-11px labels below floor (mockup gap) | Works — verdict is text; donut needs text alt "57 of 70 green" |
| Scan Reads cards | Works | Friction — tiny mono values (mockup gap) | Friction — sparklines need a text equivalent (value+trend exist) |
| Show-the-working drawer | Works | Works | Works if it's a real dialog with focus mgmt (spec); Fails in mockup (no ARIA) |
| Approve / deny | Works | Works | Works — real buttons + live-region tally (spec); Fails in mockup (no live region) |
| Review & Apply (CONFIRM) | Works | Works | Works — alertdialog + labeled field (spec) |
| Creative leaderboard | Works | Friction | **Fails today** — ad images have no alt/description |
| Change history | Works | Friction (dense rows) | Works (table semantics, if built as a table) |

## Motor spectrum

| Task | Full | Reduced precision | Keyboard only | Switch / voice |
|---|---|---|---|---|
| Connect | Works | Works | Works | Works |
| Approve/deny/snooze | Works | Friction — mockup pills <44px (target 44px in spec) | Works — Tab + A/D/S shortcuts | Works — activate by name |
| Show-the-working | Works | Works | Works — Enter opens, Esc closes | Works |
| Review & Apply | Works | Works | Works | Works — CONFIRM via dictation |
| Section navigation | Works | Friction | Works | Works |

## Cognitive spectrum (the one that matters most here)

| Task | Comfortable w/ complexity | Prefers simplicity | Needs plain language | Needs step-by-step |
|---|---|---|---|---|
| Understand the verdict | Works | Works | Works — one plain sentence | Works |
| Act on "do this today" | Works | Works | Works — clear approve/deny | Friction — no guided first-run |
| Read a Read card | Works | Friction | **Friction/Fails** — jargon: "half life", "8 real options" | Fails |
| Interpret SOV / funnel | Works | Friction | **Fails** — "SOV", weighted grade unexplained | Fails |
| Whole cockpit at once | Works | **Friction** — 9 dense sections | **Fails** — overwhelming | **Fails** |

## Breakpoints (where it shifts to Fails, and who is excluded)
- **Vision:** screen-reader users fail on the **creative leaderboard** (no image descriptions)
  and on **sparklines** without text equivalents. Low-vision hits friction on sub-12.5px labels.
- **Motor:** no hard fail in the designed spec; friction only where the mockup ignores the 44px
  target. Build to spec and this boundary is far right.
- **Cognitive:** the boundary is far LEFT and excludes the most people — jargon-laden sections and
  the 9-section density fail "needs plain language" users, i.e. our actual first segment.

## Highest-ROI fixes (move the boundary, include the most people)
1. **"3 moves today" first view + plain-language recommendations** — moves the COGNITIVE
   boundary right for the largest population AND the target user. Single highest return.
2. **Reuse the AI's own creative analysis as alt text / a one-line summary** for leaderboard
   images and videos. We already generate that text (the Deconstructor), so screen-reader
   support on the leaderboard is nearly free — moves the VISION boundary right at almost no cost.
3. **Text equivalent for every sparkline/donut** — the value + trend already exist as text;
   expose them to screen readers. Cheap SR parity.
4. **Meet the DESIGN a11y floor in the build** — >=12.5px labels, >=4.5:1 contrast, 44px targets,
   semantic headings/landmarks, visible focus, real dialog ARIA. Moves vision + motor + SR from
   "fails/friction" (mockup) to "works" (spec).
5. **Video-ad captions/summary** in the leaderboard (hearing) — the video analysis already yields
   a text read of each ad; surface it so audio is never the only channel.

## Stakeholder one-liner (no jargon)
Our design already works for most people, but it breaks first for two groups: people who need
plain language (which is most of our target D2C owners) and people using a screen reader on the
ad-image sections. The good news: the two cheapest fixes — leading with "3 moves" in plain
words, and reusing the AI's own ad descriptions as image text — include the most people for the
least work.
