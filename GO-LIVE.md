# AdBrain — Go Live (GitHub + Vercel + Google sign-in + your domain)

This is the runbook to take AdBrain from your laptop to a public website your
users can sign into with Google. Everything here uses **free tiers**.

You do the account/click steps (they need your logins and billing) — I cannot do
those for you. I have already done all the code. Follow in order; it is copy-paste.

**Order:** GitHub → Vercel → Supabase base setup → **Google sign-in** → **your domain**.

Prerequisite: finish steps 1 and 2 of `SETUP.md` first (create the Supabase
project, run the `0001` migration, put the keys in `.env.local`). Come back here.

---

## A. Put the code on GitHub (free)

I set up git and committed everything to the `main` branch. You just need to make
an empty repo and let me push, OR run the two commands yourself.

1. Go to https://github.com/new. Repository name: `adbrain` (or anything).
   Set it to **Private**. Do **not** add a README, .gitignore, or license
   (the repo already has them). Click **Create repository**.
2. GitHub shows a URL like `https://github.com/YOURNAME/adbrain.git`. Send it to
   me and I will push, or run these two commands yourself from the project folder:

```bash
git remote add origin https://github.com/YOURNAME/adbrain.git
git push -u origin main
```

> Your secrets are safe: `.env.local` is git-ignored and is NOT uploaded.

## B. Deploy on Vercel (free)

1. Go to https://vercel.com and **Sign in with GitHub**.
2. **Add New → Project → Import** the `adbrain` repo.
3. Before clicking Deploy, open **Environment Variables** and add the four values
   from your `.env.local` (same names, same values):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
4. Click **Deploy**. In ~1 minute you get a live URL like
   `https://adbrain-xxxx.vercel.app`. Keep this URL — you need it below.

> Every future `git push` to `main` auto-deploys. Rollback is one click in Vercel
> (promote the previous deployment).

---

## C. Sign in with Google — the setup

"Sign in with Google" is built into the app already. To switch it on you connect
two dashboards: **Google Cloud** (issues the credentials) and **Supabase** (uses
them). The button needs **no** extra environment variable.

> The one thing people get wrong: Google's redirect URI must point at **Supabase**,
> not at your app. Supabase then hands the user back to your app. Use the exact URL
> Supabase gives you in step C2 — do not type your own domain here.

### C1. Get the Supabase callback URL

1. In Supabase: **Authentication → Providers → Google**.
2. Copy the **Callback URL (for OAuth)** it shows. It looks like:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   Leave this tab open.

### C2. Create Google OAuth credentials (free)

1. Go to https://console.cloud.google.com. Create a project (top bar → New
   Project), name it `AdBrain`, and select it.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name `AdBrain`, your email for support + developer contact. Save.
   - Scopes: add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
     Save.
   - While testing, either add your own Gmail under **Test users**, or click
     **Publish app** to let anyone sign in. (Publishing an app that only requests
     email/profile needs no Google verification.)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**. Name `AdBrain Web`.
   - **Authorized redirect URIs → Add URI**: paste the Supabase callback URL
     from C1 (`https://<ref>.supabase.co/auth/v1/callback`).
   - Create. Copy the **Client ID** and **Client secret**.

### C3. Turn it on in Supabase

1. Back in Supabase **Authentication → Providers → Google**: toggle **Enabled**,
   paste the **Client ID** and **Client secret**, and **Save**.

### C4. Tell Supabase which sites may sign in

1. Supabase **Authentication → URL Configuration**:
   - **Site URL**: your production URL. Use your Vercel URL for now
     (`https://adbrain-xxxx.vercel.app`); change it to your domain after part D.
   - **Redirect URLs** — click Add for each:
     - `http://localhost:3000/**`  (local development)
     - `https://adbrain-xxxx.vercel.app/**`  (your Vercel URL)
     - `https://yourdomain.com/**`  (add after part D)
   - Save.

### C5. Test it

Open your live URL → **/login** → click **Log in with Google**. You should bounce
to Google, pick your account, and land on `/app` signed in. Do the same on
**/signup**. If it fails, it is almost always a Redirect-URL mismatch in C1/C4.

---

## D. Connect your domain (free on Vercel)

1. Vercel → your project → **Settings → Domains → Add**. Type your domain
   (e.g. `adbrain.com` and `www.adbrain.com`).
2. Vercel shows DNS records to add. At your domain registrar (where you bought it),
   add those records — usually either:
   - an **A record** `@ → 76.76.21.21` and a **CNAME** `www → cname.vercel-dns.com`, or
   - point the domain's **nameservers** to Vercel (Vercel tells you which).
3. Wait for Vercel to show **Valid** (minutes to a couple of hours).
4. Update Supabase **Authentication → URL Configuration**:
   - **Site URL** → `https://yourdomain.com`
   - Add `https://yourdomain.com/**` to **Redirect URLs** (if not already).
5. Re-test Google sign-in on `https://yourdomain.com`.

---

## What you have after this

- The app live on **your domain**, over HTTPS, on free tiers.
- **Sign in / sign up with Google**, plus the existing email + password.
- Auto-deploy on every `git push` to `main`, with one-click rollback.

## Cost reality (free-tier ceilings, so there are no surprises)

- **Vercel Hobby**: free, fine for launch. Commercial/heavy traffic eventually
  wants the Pro plan.
- **Supabase Free**: 1 project, 500 MB database, 50k monthly active users on auth,
  pauses after ~1 week of zero activity. Enough to launch and get first users.
- **Anthropic**: usage-based (not free) — this is the AI, the one real running cost.
- The 10k-users/day scale plan (`docs/adr/ADR-0004`) is a later step, not needed to
  go live. Launch on free tiers first.
