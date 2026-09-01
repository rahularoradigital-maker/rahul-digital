import { ImageResponse } from "next/og";

// Apple touch icon (180x180) - the AdScale "A" mark on the brand blue, matching the share cards + sidebar mark.
// Next adds <link rel="apple-touch-icon"> from this file, completing the favicon set alongside /icon.svg.
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          color: "white",
          fontSize: 116,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: 40,
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
