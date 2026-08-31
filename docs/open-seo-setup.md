# open-seo Setup Runbook (separate self-hosted service)

**What this is:** A runbook for standing up **open-seo** as a SEPARATE, self-hosted
service that supports AdBrain's SEO work (keyword research, rank tracking, site
audits, AI-visibility tracking).

**Scope boundary (read first):**
- open-seo is **NOT a dependency of the AdBrain repo**. Do **not** `npm install`
  it, add it to `package.json`, vendor its code, or run it from inside
  `adbrain-mvp/`.
- It runs in its **own directory / own container**, on its **own port**. AdBrain
  talks to it (if at all) only over the network or via the Claude Code MCP tools
  it exposes in a session. This doc lives in `adbrain-mvp/docs/` purely as
  operator notes.

---

## 1. What open-seo is

- Open-source, self-hosted alternative to enterprise SEO suites like **Semrush**
  and **Ahrefs** ("an SEO tool for the people", pay-as-you-go, you control the
  infra).
- Ships an **MCP server** so an AI agent (Claude Code, etc.) can call SEO tools
  directly, plus a set of reusable **agent skills**.
- Core workflows: keyword research, rank tracking, competitor insights,
  backlinks analysis, site audits, and AI-visibility tracking.
- Repo: https://github.com/every-app/open-seo
- Hosted option (if you don't want to self-host): https://openseo.so

---

## 2. What needs a paid key vs. what's free

| Piece | Cost |
| --- | --- |
| open-seo software (self-hosted via Docker) | **Free** (open source) |
| DataForSEO API key (the actual SEO data) | **Paid, bring-your-own**, pay-as-you-go. $1 free credit on signup; **minimum top-up $50** |
| Cloudflare deploy path (alternative to Docker) | **Free plan works** |
| Hosted openseo.so (skip self-hosting) | **Free trial**, then **$10/month** + DataForSEO usage with a **28% markup** per request |
| Agent skills (`npx skills add ...`) | **Free** (just files; still need MCP + DataForSEO for real data) |

Bottom line: the tool is free, but **it cannot return real SEO data without a
funded DataForSEO account**. That is the one unavoidable paid dependency.

---

## 3. Get a DataForSEO API key (required, do this first)

Source: https://github.com/every-app/open-seo/blob/main/docs/DATAFORSEO_API_KEY.md

1. Go to the DataForSEO **API Access** portal and create an account.
2. Request credentials ("Send by email").
3. Copy the **Base64** credential. It is your `email:password` base64-encoded.
   That single string is what open-seo wants.
4. New accounts get **$1 free credit** to test. To do real work, top up
   (minimum **$50**). You pay DataForSEO directly.

This value goes into the env var **`DATAFORSEO_API_KEY`** in the next step.

> Note: entering/funding this account is a paid action — the operator (Rahul)
> does the signup and payment. Do not automate the purchase.

---

## 4. Self-host with Docker (recommended path for a personal/testing service)

Source: https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_DOCKER.md

Run these **outside** the AdBrain repo (e.g. `~/open-seo`, not `~/adbrain-mvp`):

```bash
# 1. Clone into its OWN directory (NOT inside adbrain-mvp)
git clone https://github.com/every-app/open-seo.git ~/open-seo
cd ~/open-seo

# 2. Create the env file
cp .env.example .env

# 3. Edit .env and set your DataForSEO credential:
#    DATAFORSEO_API_KEY=<the base64 email:password string from step 3>
#    (PORT defaults to 3001; OPEN_SEO_IMAGE defaults to
#     ghcr.io/every-app/open-seo:latest)

# 4. Start it
docker compose up -d
```

- App comes up at **http://localhost:3001** (first build can take 1-2 minutes).
- In Docker mode it runs `AUTH_MODE=local_noauth` — **no auth**, single local
  admin (`admin@localhost`). This is already set in the compose file.
- **Security:** because there's no auth, only expose it behind your own
  auth-protected reverse proxy, tunnel, or a private network. Do not put
  `localhost:3001` directly on the public internet. Use `ALLOWED_HOST` if you
  front it with a reverse proxy.

Key env vars: `DATAFORSEO_API_KEY` (required), `PORT` (default 3001),
`ALLOWED_HOST` (reverse-proxy host), `OPEN_SEO_IMAGE`.

> Alternative deploy: a Cloudflare path exists for team/multi-device,
> internet-facing use and works on the free plan. See
> https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_CLOUDFLARE.md

---

## 5. Connect the MCP server to Claude Code

This is what makes keyword research, rank tracking, site audit, and AI-visibility
tracking show up as **tools inside a Claude Code session**.

Source: https://openseo.so/docs/mcp

**A. Pointing at your self-hosted instance** — use your own instance's `/mcp`
endpoint as the URL (the same command pattern, swapping the host):

```bash
claude mcp add --transport http --scope user openseo http://localhost:3001/mcp
```

> The docs give the exact command for the hosted endpoint (below). The
> self-hosted URL is your own instance origin + `/mcp`. If `http://localhost:3001/mcp`
> is rejected, check the running container's routes / the SELF_HOSTING docs for
> the exact MCP path before assuming it's wrong.

**B. Pointing at the hosted service instead** (if you skip self-hosting):

```bash
claude mcp add --transport http --scope user openseo https://app.openseo.so/mcp
# then approve the OpenSEO login when prompted
```

Headless / no-browser environments — create an API key in the app under
**Settings -> API keys**, then:

```bash
claude mcp add --transport http --scope user openseo https://app.openseo.so/mcp \
  --header "Authorization: Bearer oseo_YOUR_KEY"
```

Once added, verify with `claude mcp list` (or `/mcp` in an interactive session).
Tools exposed include: keyword research (volume / difficulty / CPC), live Google
organic SERP fetch, rank tracking / position monitoring, competitive keyword
intelligence, backlink & referring-domain data, Google Search Console
performance + URL inspection, local business / Google Business Profile auditing,
and domain research.

---

## 6. Optional: add just the agent skills (lightweight path)

If you only want the reusable SEO **skills** (prompts/workflows) and not to manage
the whole service yourself, install the skills package. They're free files, but
still need the MCP configured (step 5) + a funded DataForSEO key to return real
data.

Source: https://openseo.so/docs/skills/setup

```bash
# Interactive picker
npx skills add every-app/open-seo

# All skills, Claude Code specifically
npx skills add every-app/open-seo --skill '*' --agent claude-code

# A single named skill (example shown in the repo README)
npx skills add every-app/open-seo --skill simple-issue-description
```

The nine skills: SEO Project Setup, SEO Coach, SEO Audit, Keyword Research,
Keyword Clustering, Competitive Landscape, Competitor Analysis, Local SEO,
Link Prospecting. Skills install to `~/.claude/skills/` (Claude Code) — again,
outside the AdBrain repo.

---

## 7. Recommended order for a non-expert

1. Create + fund a DataForSEO account, copy the Base64 key (Section 3).
2. `git clone` open-seo into its **own** folder, `cp .env.example .env`, paste
   the key, `docker compose up -d` (Section 4).
3. Open http://localhost:3001, confirm it loads.
4. `claude mcp add ... http://localhost:3001/mcp`, then `claude mcp list` to
   confirm the tools appear (Section 5).
5. (Optional) `npx skills add every-app/open-seo` for the guided workflows
   (Section 6).
6. Use it from Claude Code sessions to support AdBrain's SEO work — but keep it a
   separate service; never fold it into the adbrain-mvp repo.

---

## Sources

- Repo README: https://github.com/every-app/open-seo
- Docker self-hosting: https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_DOCKER.md
- Cloudflare self-hosting: https://github.com/every-app/open-seo/blob/main/docs/SELF_HOSTING_CLOUDFLARE.md
- DataForSEO key: https://github.com/every-app/open-seo/blob/main/docs/DATAFORSEO_API_KEY.md
- MCP setup: https://openseo.so/docs/mcp
- Agent skills setup: https://openseo.so/docs/skills/setup
- Hosted service / pricing: https://openseo.so  ·  https://openseo.so/pricing
