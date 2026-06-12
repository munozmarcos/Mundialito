"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function NotificationToasts() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function pulseLiveResults() {
      try {
        if (document.visibilityState !== "visible") return;
        const res = await fetch("/api/live/pulse", { method: "POST", cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const updated = Number(data?.data?.updated ?? 0);
        const refreshablePaths = new Set(["/", "/partidos", "/ranking", "/probar", "/novedades"]);
        if (updated > 0 && refreshablePaths.has(pathname)) router.refresh();
      } catch {
        // Live score pulse is best-effort; scheduled jobs remain the main runner.
      }
    }

    void pulseLiveResults();
    const interval = window.setInterval(() => {
      if (active) void pulseLiveResults();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}
