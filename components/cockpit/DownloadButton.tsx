"use client";

import { Button } from "@/components/ui/button";

// A small reusable "download this text/HTML" button. Client-only (needs a Blob + a synthetic click). Guarded
// so a blocked download is a no-op, never a thrown error.
export function DownloadButton({ content, filename, mime = "text/plain", label = "Download" }: { content: string; filename: string; mime?: string; label?: string }) {
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* download blocked - no-op */
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={download}>
      {label}
    </Button>
  );
}
