import React from "react";

// Minimal, safe markdown -> React renderer for Scout's articles (owner-approved content). Handles headings,
// paragraphs, bullet lists, bold, and links. Renders to React elements only - no raw HTML is ever injected,
// so there is no XSS path. Deliberately small - we control the input shape (the article prompt).

function inline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(\*\*([^*]+)\*\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    if (m[1]) nodes.push(<a key={`${keyBase}-l${i}`} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">{m[2]}</a>);
    else if (m[4]) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[5]}</strong>);
    last = idx + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ md }: { md: string }) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flushList = (k: number) => {
    if (list.length) {
      out.push(<ul key={`ul-${k}`} className="my-3 list-disc space-y-1 pl-5">{list}</ul>);
      list = [];
    }
  };
  lines.forEach((raw, k) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { flushList(k); out.push(<h3 key={k} className="mt-6 mb-2 text-[16px] font-semibold">{inline(line.replace(/^###\s+/, ""), `h3-${k}`)}</h3>); return; }
    if (/^##\s+/.test(line)) { flushList(k); out.push(<h2 key={k} className="mt-8 mb-2 text-[19px] font-semibold">{inline(line.replace(/^##\s+/, ""), `h2-${k}`)}</h2>); return; }
    if (/^#\s+/.test(line)) { flushList(k); out.push(<h2 key={k} className="mt-8 mb-2 text-[19px] font-semibold">{inline(line.replace(/^#\s+/, ""), `h1-${k}`)}</h2>); return; }
    if (/^[-*]\s+/.test(line)) { list.push(<li key={k} className="text-[15px] leading-relaxed">{inline(line.replace(/^[-*]\s+/, ""), `li-${k}`)}</li>); return; }
    if (line.trim() === "") { flushList(k); return; }
    flushList(k);
    out.push(<p key={k} className="my-3 text-[15px] leading-relaxed text-[var(--ink)]">{inline(line, `p-${k}`)}</p>);
  });
  flushList(lines.length);
  return <>{out}</>;
}
