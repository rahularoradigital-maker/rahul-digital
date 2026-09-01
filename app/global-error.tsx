"use client";

// Top-level (root) error boundary. app/app/error.tsx only catches PAGE render errors within
// the /app segment; an error thrown by the /app LAYOUT (e.g. getCurrentUser during shell render)
// or by any other segment escapes it and would show the framework's raw 500. global-error.tsx is
// the last-resort boundary that catches everything, including layout errors, and must render its
// own <html>/<body>. This keeps the whole app recoverable for every visitor.
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f7f7f7", color: "#252525" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center", background: "#fff", border: "1px solid #e4e4e4", borderRadius: 12, padding: 32 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ fontSize: 13, color: "#6b6b6b", margin: "0 0 20px" }}>
              The app hit an unexpected error. Your data is safe. Please try again.
            </p>
            <Button
              variant="default"
              size="sm"
              type="button"
              onClick={() => reset()}
              style={{ background: "#252525", color: "#fff", border: 0, borderRadius: 70, padding: "10px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              Try again
            </Button>
            {error?.digest && <p style={{ marginTop: 16, fontFamily: "monospace", fontSize: 11, color: "#8e8e93" }}>ref: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
