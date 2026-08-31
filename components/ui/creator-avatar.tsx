"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const initialsOf = (name: string) => name.replace(/[^a-zA-Z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

// Shows the creator's Instagram profile picture, falling back to initials if it is missing, expired, or
// blocked (Instagram CDN URLs are time-limited and can 403). referrerPolicy=no-referrer avoids hotlink 403s.
export function CreatorAvatar({ src, name, size = 44, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const px = { width: size, height: size };
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={px} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span style={px} className={cn("grid shrink-0 place-items-center rounded-full bg-secondary font-semibold text-secondary-foreground", className)}>
      <span style={{ fontSize: size * 0.34 }}>{initialsOf(name)}</span>
    </span>
  );
}
