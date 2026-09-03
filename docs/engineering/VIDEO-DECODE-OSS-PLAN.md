# Video decode with free / cheap tools — research + plan

**Question (Rahul):** can we use free open-source tools — **ffmpeg, PySceneDetect, Tesseract** — to break an
ad video into parts, read on-screen text, and listen to audio, at ~$0 software cost on a small server? And
**Deepgram** (batch, $200 free ≈ hundreds of hours) to transcribe the speech?

**Short answer: YES.** All the software is free and mature. It needs one small always-cheap server (not Vercel).
And it is a **major cost lever**: today we pay a Gemini video call for the *whole* read; these tools do the
mechanical breakdown for near-$0, so the paid AI step gets smaller or disappears.

---

## 1. What we already have (so we extend, not duplicate)

`lib/creative/deep-decode.ts` + `deep-analysis.ts` (chat e9) already read a video **once** per top-spending
creative by sending the whole video to **Gemini**, which returns a semantic label: sceneType, setting,
palette, mood, subject, funnelStage, motionSummary. That is the **meaning** read — one paid AI call, capped to
top-10, one-time free.

What Rahul is describing is the **mechanical** read that sits *before* that:

| Layer | What it answers | Tool | Today |
|---|---|---|---|
| Mechanical | Where are the cuts? What text is on screen? What is said? | ffmpeg + PySceneDetect + OCR + Deepgram | ❌ not built |
| Semantic | What does this creative MEAN / what stage of funnel? | Gemini (or a cheap text LLM fed the facts above) | ✅ built (paid, video-in) |

The two are complementary. The mechanical layer makes the semantic layer **cheaper and more grounded**
(we hand the model facts instead of a 20 MB video).

---

## 2. The tools — all free, all mature

| Tool | Job | Licence / cost | Notes |
|---|---|---|---|
| **ffmpeg** | Decode the video; pull keyframes; extract the audio track; downscale | LGPL/GPL, **$0** | The workhorse. Also gives duration, fps, loudness. |
| **PySceneDetect** | "Break into parts" — detect shot/scene cuts with timestamps | BSD-3, **$0** | Reliable on hard cuts. A single-shot UGC video = 1 part (still fine: hook = first 3 s). |
| **Tesseract** | On-screen text (OCR) | Apache-2.0, **$0** | Light (10 MB, CPU, ~0.8 s). **Weak on stylised/moving ad text** — see caveat. |
| **Deepgram (batch, Nova-3)** | Speech → text with timestamps | **$200 free credit, no card, no expiry**; then **$0.0043/min** (~$0.26/hr) | ~46,000 free minutes ≈ **~775 hours batch** ≈ tens of thousands of 30 s ads before we pay a cent. |
| **Whisper / faster-whisper** (optional $0 fallback) | Speech → text | MIT, **$0** | Truly free, runs on the same server, but CPU-heavy/slow. Use as the keyless fallback if no Deepgram key. |

**OCR honesty (the one weak link):** Tesseract is great for clean printed text but poor on ad text that is
coloured, stylised, moving, or over video. Free, more-accurate alternatives for *scene* text:
- **EasyOCR** — good on screenshots/labels/scene text, middle weight.
- **PaddleOCR** — most accurate (≈0.93 vs Tesseract 0.89 vs EasyOCR 0.85 avg confidence in independent tests),
  but heavier and wants a GPU for throughput.
- **Recommendation:** ship **Tesseract** first (keeps the server tiny + $0), and if on-screen text quality is
  not good enough on real ads, swap in **EasyOCR** (still $0, CPU-OK). Reserve PaddleOCR for later if we ever
  add a GPU.

---

## 3. Where it runs — the "small server"

**Not Vercel.** Our app is serverless (Next.js on Vercel): no persistent ffmpeg/Python binaries, tight size
and time limits. So the "small server" is real and necessary.

**Recommended host: Fly.io, scale-to-zero.** It stops the machine when idle (`auto_stop_machines`), wakes on
the next job in ~0.3–2 s, and a stopped machine costs only its disk. Smallest instance ≈ **$2/mo** if left on,
cents/job if scaled to zero. (Railway is also fine and pay-as-you-go; Render's free tier sleeps after 15 min
with 30–60 s cold starts.)

**It plugs into infra we already have:**
- The **durable job queue** chat-82 built (`lib/queue-postgres.ts` + `0027_jobs.sql` + the drain worker) —
  the app enqueues a "decode this creative" job; the Fly worker claims it, runs the pipeline, writes back.
- **Fingerprint-once by `content_hash`** (the scale plan's #1 cost rule): decode each unique creative **once**,
  cache the result, and every future daily run reuses it. Creatives are stable day-to-day, so this collapses
  the cost dramatically.
- The same **SSRF guard + size cap** `deep-decode.ts` already uses for pulling a Meta video URL.

```
App (Vercel)                 Queue (Postgres, exists)        Worker (Fly.io, NEW, $0 software)
  enqueue {content_hash,  ->   jobs table (0027)        ->     ffmpeg  -> shots (PySceneDetect)
   video_id}                                                   keyframes -> OCR (Tesseract/EasyOCR)
  <- read cached result   <-   writeback (Supabase)     <-     audio -> Deepgram batch (transcript)
                                                               -> one JSON, keyed by content_hash
```

---

## 4. Cost model (grounded, order-of-magnitude)

| Item | Cost |
|---|---|
| ffmpeg + PySceneDetect + Tesseract/EasyOCR + Whisper | **$0** (open source) |
| Fly.io small worker, scale-to-zero | **~$2–15/mo** depending on volume |
| Deepgram batch transcription | **$0** until ~775 hours of audio, then **$0.0043/min** |
| Gemini video calls **saved** | the win — replace most video-in calls with cheap text-LLM calls on the extracted facts |

Net: for the foreseeable volume this is **effectively free**, and it *reduces* the current paid Gemini bill.

---

## 5. Honest risks (devil's advocate)

- ❌❌❌ **Second runtime to maintain.** Python + native binaries (ffmpeg, tesseract) is a whole new thing to
  build, patch, monitor, and keep secure. The real cost here is **ops**, not software licences. Budget for it.
- **Tesseract on ad text is mediocre.** Plan for EasyOCR as the likely upgrade (still free).
- **Meta video URLs are short-lived + authed.** The worker must not hold our long-lived token; pass a
  short-lived signed job (a fresh source URL, or a scoped token), matching how `deep-decode.ts` already fetches
  `?fields=source` with a Bearer.
- **Scene detection ≠ meaning.** PySceneDetect finds cuts, not story. A talking-head UGC ad may be one shot;
  still useful (we take the first 3 s as the hook), but don't oversell "parts" on single-shot videos.
- **Deepgram is 3rd-party** (not $0 forever). The free tier is generous, but if we scale to millions of minutes
  we either pay or switch to Whisper ($0, more compute). Keep the provider abstracted (like our image
  providers) so it's a config swap, not a rewrite.
- **Privacy:** audio/frames leave our server to Deepgram. Fine for ad creatives (public), but note it.

---

## 6. Phased plan (small, verifiable steps — video/data-layer lane)

- **P0 — decide + provision (Rahul):** approve the approach; create a Fly.io app; add a **Deepgram key** (free
  $200). No code cost.
- **P1 — shots + hook frame (highest value, pure $0):** worker runs **ffmpeg + PySceneDetect** → returns shot
  boundaries + a keyframe per shot + the first-3s hook frame, stored by `content_hash`. Deterministic, free,
  immediately useful ("break into parts" + a real hook thumbnail).
- **P2 — text + speech:** add **Tesseract/EasyOCR** on each shot keyframe (on-screen text) and **Deepgram
  batch** on the audio (spoken script with timestamps). Now every creative has: parts, on-screen copy, and a
  transcript — all cheap.
- **P3 — cheap interpretation + measure:** feed those structured facts to **gemini-flash-lite** (our free-tier
  text model) for the semantic read, and **A/B it against the current Gemini-video read**. Keep video-in only
  where motion truly matters. **Measure the $ saved** before switching the default.

Each phase ships behind the existing queue and fingerprint-once cache; nothing touches the app's hot paths.

---

## 7. Coordination

This is the **video / deep-analysis lane** (chat e9 owns `lib/creative/deep-*`), plus the **data-layer lane**
(worker + queue + rollups). It is **not** the Studio lane. This document is a **plan only** — no code was
written into anyone's files. The worker is a **new service** Rahul must provision (Fly.io app + Deepgram key);
the app-side wiring reuses the durable queue that already exists.

**Bottom line:** Yes, we can do the whole mechanical breakdown for ~$0 software on a ~$2–15/mo server, with
Deepgram effectively free at our volume — and it should *lower* our current AI bill, not raise it.
