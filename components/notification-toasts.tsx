"use client";

import { Bell, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NotificationBody } from "@/components/notification-body";

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

export function NotificationToasts() {
  const initialized = useRef(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);

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
          setToast(latest);
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

  if (!toast) return null;

  return (
    <div className="notification-toast" role="status" aria-live="polite">
      <div className="notification-toast-icon">
        <Bell className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{toast.title}</p>
        <div className="line-clamp-3">
          <NotificationBody item={toast} compact />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link className="btn min-h-8 px-3 text-xs" href="/novedades" onClick={() => setToast(null)}>
            Ver novedades
          </Link>
          <button className="btn secondary min-h-8 px-3 text-xs" onClick={() => setToast(null)} type="button">
            Cerrar
          </button>
        </div>
      </div>
      <button aria-label="Cerrar notificacion" className="notification-toast-close" onClick={() => setToast(null)} type="button">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
