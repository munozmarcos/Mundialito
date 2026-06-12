"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: "admin" | "points" | "closing" | "closed" | "participant";
  point_players?: { name: string; points: number }[];
  match?: {
    home_team: string;
    away_team: string;
    home_country_code?: string | null;
    away_country_code?: string | null;
    home_goals?: number | null;
    away_goals?: number | null;
  };
};

const storageKey = "mundialito-last-notification";

function notificationKey(item: NotificationItem) {
  return `${item.created_at}:${item.id}`;
}

function isNewer(item: NotificationItem, previous: string | null) {
  if (!previous) return false;
  return notificationKey(item) > previous;
}

function systemNotificationBody(item: NotificationItem) {
  if (item.point_players?.length) {
    const groups = new Map<number, string[]>();
    for (const player of item.point_players) groups.set(player.points, [...(groups.get(player.points) ?? []), player.name]);
    return [...groups.entries()]
      .sort(([left], [right]) => right - left)
      .map(([points, names]) => `${points} Pts ${names.join(", ")}`)
      .join(" · ");
  }

  if (item.match) {
    const score = item.match.home_goals != null && item.match.away_goals != null ? ` ${item.match.home_goals}-${item.match.away_goals}` : " vs";
    return `${item.match.home_team}${score} ${item.match.away_team}${item.body ? ` · ${item.body}` : ""}`;
  }

  return item.body || "Nueva novedad del Mundialito.";
}

async function registerNotificationWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/notification-sw.js");
    return registration;
  } catch {
    return null;
  }
}

async function showSystemNotification(item: NotificationItem) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = await registerNotificationWorker();
  const options: NotificationOptions = {
    body: systemNotificationBody(item),
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: item.id,
    data: { url: "/novedades" }
  };

  if (registration?.showNotification) {
    await registration.showNotification(item.title, options);
    return;
  }

  new Notification(item.title, options);
}

export function NotificationToasts() {
  const initialized = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const [, setLastSystemNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/notifications/latest", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const latest = (data.notifications ?? [])[0] as NotificationItem | undefined;
        if (!latest || !active) return;

        const latestKey = notificationKey(latest);
        const seen = window.localStorage.getItem(storageKey);
        if (!initialized.current) {
          initialized.current = true;
          if (!seen) window.localStorage.setItem(storageKey, latestKey);
          return;
        }

        if (isNewer(latest, seen)) {
          window.localStorage.setItem(storageKey, latestKey);
          setLastSystemNotification(latest);
          void showSystemNotification(latest);
        }
      } catch {
        // Notification polling is best-effort.
      }
    }

    void poll();
    const interval = window.setInterval(poll, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
