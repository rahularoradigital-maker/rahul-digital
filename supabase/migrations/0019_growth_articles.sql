-- Scout's content engine: articles it writes from recurring demand signals. Drafts are owner-only; a PUBLISHED
-- article renders publicly at /blog/<slug>. AI-written, so it stays a DRAFT until you one-tap publish (a wrong
-- public article hurts the brand - the tap is the guardrail). Read server-side via the service role; RLS
-- deny-by-default (the public /blog route reads published rows through the server, never the client).

create table if not exists public.growth_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  topic text,
  dek text,                          -- one-line summary / subtitle
  body_md text not null,             -- the article, markdown
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists growth_articles_slug_uidx on public.growth_articles(slug);
create index if not exists growth_articles_status_idx on public.growth_articles(status, published_at desc nulls last);

alter table public.growth_articles enable row level security;
-- no policy => only the service-role client reads/writes; the /blog route reads published rows server-side.
