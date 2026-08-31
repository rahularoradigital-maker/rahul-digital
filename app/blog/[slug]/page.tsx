import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug } from "@/lib/growth/articles";
import { Markdown } from "../md";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) return { title: "AdScale Blog" };
  return { title: `${a.title} — AdScale`, description: a.dek ?? undefined };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) notFound();

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/blog" className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]">← All posts</Link>
      <article className="mt-6">
        <h1 className="text-[28px] font-normal leading-tight tracking-tight text-balance">{a.title}</h1>
        {a.dek && <p className="mt-2 text-[16px] text-[var(--ink-muted)]">{a.dek}</p>}
        {a.published_at && <p className="mt-2 text-[12px] text-[var(--ink-muted)]">{a.published_at.slice(0, 10)}</p>}
        <div className="mt-8">
          <Markdown md={a.body_md} />
        </div>
      </article>
    </main>
  );
}
