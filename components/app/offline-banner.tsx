"use client";

import { useEffect, useState } from "react";

// UX: a quiet banner when the browser goes offline, so a viewer understands why data stopped refreshing
// instead of reading stale numbers as live. Uses the native online/offline events; renders nothing while
// connected. Mounted once in the app shell. role="status" so screen readers announce the state change.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[var(--warn,#b45309)] px-4 py-1.5 text-center text-[13px] font-medium text-white"
    >
      <span aria-hidden="true">●</span>
      You are offline. Numbers on screen may be out of date until your connection returns.
    </div>
  );
}
