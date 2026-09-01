# Creative Studio — the complete flow (what's built, what needs your keys)

Live at **rahul-digital.vercel.app → Studio** (`/app/creative-production`). Built this session by the
Creative-Studio chat (`rahul-linkedin-2-04`). Everything below is deployed on `validation-v0-v1`.

## The flow, end to end

1. **Add your store** — paste your website URL (e.g. `boat-lifestyle.com`). If it's Shopify, Studio pulls the
   whole published catalogue automatically — **no login, no API key** (uses the store's public product feed).
   A token is optional (only for unpublished/inventory data).
2. **Pick products** — from the full catalogue:
   - **Search** the whole catalogue by name/type · **category chips** (TWS, Speakers…) · **Load more** (all pages).
   - **✨ Recommended to advertise** — ranked by offer size + ad-readiness, **un-advertised products first**
     (white-space); each says "new — not advertised yet" vs "✓ already advertised". *(Not ad-performance —
     that needs Meta results wired.)*
   - Pick up to **10**; selection **survives a refresh**; **Clear** to reset.
3. **Understand** — for each product, a **"What Studio understood"** card (benefit, problem, persona, USPs,
   proof, read-confidence). Missing data shows **"not stated on the page"** — never invented.
4. **Concepts** — formula-ranked creative ideas per product, with the reason ("why this").
   - **✎ Edit copy** — change headline / CTA / supporting line / offer to your words before generating.
   - **Sizes** — pick which ad ratios to make (1:1, 4:5, 9:16, 1.91:1…); all on by default.
   - **Platform** — Meta or Google.
5. **Generate** — one concept, or **⚡ Generate all** (top concept for every selected product) with the token
   cost shown up front.
6. **Review** — every generated ad in one place, with QA status.
   - **✓ Approve all READY** / **✕ Reject all FAILED** (bulk) · approve/reject/download each.
   - **↧ PNG** per ad · **⬇ Export approved (ZIP)** = all approved PNGs + a `manifest.csv` (product, headline,
     CTA, offer, format, QA), named by an optional **Campaign name** — ready to hand to a media buyer.

## Honest state (per the "verify before claiming" rule)

- **Verified against your live boAt data:** the URL-only fetch (989 products), search (airdopes→173), category
  chips (TWS 207…), load-more (300+300+300+89), recommendations (real soundbars, ₹69,991 saving), product DNA
  (real benefits/USPs). All grounded, no invented numbers.
- **Built + deployed, but need YOUR signed-in click to confirm the pixels:** Generate, PNG download, ZIP
  export, edit-copy-on-the-ad, brand-colour-on-the-ad, bulk approve. I can't log in as you.

## The 2 things that unlock full value

1. **A billed image API key** (OpenAI `gpt-image-1` or Google Gemini image) on the server. Without it,
   Generate makes a **grey placeholder** (the whole flow still works end to end — you just don't get real
   pictures). *Note (from the image-gen chat): `gpt-image-1` needs OpenAI org verification or it 403s → falls
   back to placeholder. Worth a live generation test once a key is in.*
2. **Meta results wired per product** — to make the recommendations rank by *what actually sells* instead of
   offer size. Grounded upgrade, later.

## What it never does
- Never auto-posts to Meta (everything is a draft/export). Never invents a product claim, price, or review.
- Never charges you for an identical re-generation (brief-hash cache).

**Next best step for you:** a 3-minute click-through of the flow above to confirm the browser-side pieces,
then decide on the image key. Everything else is ready.
