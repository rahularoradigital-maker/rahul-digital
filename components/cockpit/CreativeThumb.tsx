"use client";
import { useState } from "react";

// Small REAL creative thumbnail for a leaderboard row. On hover it shows an enlarged preview pinned
// next to the thumbnail with position: fixed, so the leaderboard card's overflow:hidden (and the rows
// container's overflow) never clips it. Meta CDN images are signed, cross-origin URLs, so: no
// next/image (its domain allowlist can't cover signed fbcdn hosts), referrerPolicy="no-referrer" (fbcdn
// rejects a referrer), loading="lazy". If the signed URL fails, the whole thumb renders nothing, so a
// dead link never leaves a broken-image box. The caller only mounts this when thumbUrl is present, so
// there is never a placeholder image.
export function CreativeThumb({ src, alt }: { src: string; alt: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        // Vertically centre the ~280px preview on the thumb, clamped into the viewport so a top or
        // bottom row never pushes it off-screen; pin it just to the right of the thumbnail.
        const top = Math.min(Math.max(r.top + r.height / 2, 148), window.innerHeight - 148);
        setPos({ top, left: r.right + 8 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-9 w-9 rounded-md border border-[var(--hairline)] bg-[var(--surface-alt)] object-cover"
      />
      {pos && (
        <div
          className="pointer-events-none fixed z-50 -translate-y-1/2"
          style={{ top: pos.top, left: pos.left }}
        >
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            className="h-64 w-64 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] object-contain shadow-xl"
          />
        </div>
      )}
    </div>
  );
}
