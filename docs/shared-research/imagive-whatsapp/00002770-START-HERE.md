# How to put this online — the simple version

No technical knowledge needed. Think of it like opening a shop.

---

## The idea in one picture

Right now the tool lives on your laptop, like a shop built inside your garage.
To put it "live", we move it to a **rented shop space on the internet** so your team can visit it
from anywhere, using a web address and a password.

The rented space costs about **$7 a month**.

---

## What YOU do (about 20 minutes, no coding)

### Step 1 — Get 3 things
Open these three websites and sign up. Each one gives you a long code (a "key"). Copy each into a
note — you'll paste them in Step 3.

| Website | What it's for | What you'll copy |
|---|---|---|
| **console.anthropic.com** | The AI brain that checks if a creator's advice is true | An "API key" |
| **apify.com** | The tool that reads posts from X and LinkedIn | An "API token" |
| **render.com** | The rented shop space on the internet | Nothing — just an account |

### Step 2 — Make up a team password
Write down a password for your team, at least 12 characters. Example: `YaminMedia2026!Team`
Everyone who uses the tool will type this to get in. Nobody without it can see anything.

### Step 3 — Hand it to a tech person (15 minutes of their time)
Give them:
- The file **`ad-intelligence-knowledge-v2.zip`** (in your Downloads folder)
- The 2 keys from Step 1
- The password from Step 2
- This sentence: *"Please deploy this to Render using the included render.yaml blueprint, set the
  environment variables, and confirm `node server/src/pentest.js <url>` prints PASS."*

That's all they need. Everything else is already built and tested.

### Step 4 — You get a web address
They'll send you something like `https://ad-intelligence.onrender.com`.
Open it → you'll see a login page → type your password → the tool appears.
Share the address and password with your team. **Send the password separately**, not in the same email.

---

## "Is everything saved?" — yes, three ways

1. **It saves itself instantly.** Every creator you add, every rule you approve, every decision —
   written down the moment it happens. Turning the computer off doesn't lose it.
2. **It keeps 14 days of daily copies.** A fresh backup every day, automatically. If something is
   deleted by mistake, yesterday's version is still there.
3. **You can take a copy any time.** Go to **Memory Layer** in the tool → **Export .md**. That's your
   approved playbook as a document you can keep in Google Drive, print, or email.

Ask your tech person to also switch on Render's automatic backups — one click on their side.

---

## What happens once it's live (you do nothing)

- Every day, on its own, it reads new posts from your 50 creators.
- It throws away the junk (personal stories, sales posts, off-topic chatter).
- It turns the useful posts into clear rules.
- The AI double-checks each rule. Only ones it's 90%+ sure about reach your media team.
- Your team clicks Approve or Reject.
- Approved ones are saved forever in the **Memory Layer**, ready to use whenever you want.

---

## What it costs each month

| Item | Cost |
|---|---|
| Shop space (Render) | ~$7 |
| Reading X/LinkedIn posts (Apify) | ~$24 |
| The AI brain (Anthropic) | ~$30–80 |
| **Total** | **~$60–110 / month** |

---

## If something looks wrong

- **Page won't load** → tell your tech person "the Render service may be asleep, please check it."
- **No new content appearing** → the keys may have expired; ask them to check the Render logs.
- **Forgot the password** → they can change it in Render settings in one minute.

---

## One thing to be clear about with your team

There is **one shared password for everyone** — like one key to the office, which is right for an
internal team. It is *not* individual accounts where each person signs up with their own email.
If you later want that, it's a separate piece of work — tell whoever builds it that you need
"multi-user accounts", and point them at `docs/ADR-001-production-architecture.md`.
