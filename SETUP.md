# AdBrain — Setup (Phase 0)

The code is built and runs locally. Three things need YOUR accounts. I cannot do
these for you because they require your login and billing details. Follow in order.

Everything is copy-paste. Total time: about 20 minutes.

---

## 0. Run it right now (no keys needed)

The public marketing site works before any setup:

```bash
cd ~/adbrain-mvp
npm run dev
```

Open http://localhost:3000 — you will see the landing page. Login/signup pages
load too, but they cannot sign anyone in until you finish step 1.

---

## 1. Supabase (auth + database) — free

1. Go to https://supabase.com and sign up. Create a new project (any name).
   Pick a region near you and save the database password it asks for.
2. When the project finishes provisioning, open **Project Settings -> API**.
   Copy these three values:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key -> `SUPABASE_SERVICE_ROLE_KEY`
3. Paste them into the file `.env.local` in this project (replace the blanks).
4. Create the database tables: in Supabase, open **SQL Editor -> New query**,
   paste the entire contents of `supabase/migrations/0001_init.sql`, and click **Run**.
   You should see "Success".
5. (Optional, makes testing faster) **Authentication -> Providers -> Email**:
   turn OFF "Confirm email" so you can log in immediately without a confirmation
   email. Turn it back on before real launch.

## 2. Anthropic (the AI) — paid, usage-based

1. Go to https://console.anthropic.com and sign in.
2. Add a payment method (Billing), then open **API Keys -> Create Key**.
3. Copy the key into `.env.local` as `ANTHROPIC_API_KEY`.
4. Verify it works:

```bash
npm run check:claude
```

Expected output: `PASS: Claude replied "pong"`.

## 3. Deploy to the internet (Vercel) — free

Do this once you can log in locally and want a public URL to show people.

1. Push this project to a private GitHub repo (I can help with the commands).
2. Go to https://vercel.com, sign in with GitHub, click **Add New -> Project**,
   and import the repo.
3. In the Vercel project settings, add the same four environment variables from
   your `.env.local` (Settings -> Environment Variables).
4. Click **Deploy**. Vercel gives you a live URL.
5. In Supabase **Authentication -> URL Configuration**, set the Site URL to your
   Vercel URL so email links point to the right place.

---

## What you have after this

- A live marketing site under your own brand.
- Working sign up / log in.
- A database with the full schema (including the Brand Brain `triples` table).
- Claude wired in and proven.

That completes Phase 0. Phase 1 (competitor scan -> AI test plan) builds on top.
