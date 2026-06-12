"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "mundialito-push-prompt-v1";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function subscribeDevice() {
  const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
  if (!keyRes.ok) return false;
  const { publicKey } = await keyRes.json();
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.register("/notification-sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription)
  });
  return res.ok;
}

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function checkPrompt() {
      const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      if (!supported || Notification.permission !== "default") return;
      if (window.localStorage.getItem(storageKey)) return;

      const session = await fetch("/api/auth/session", { cache: "no-store" }).then((res) => res.json()).catch(() => null);
      if (session?.user) setVisible(true);
    }

    void checkPrompt();
  }, []);

  function dismiss() {
    window.localStorage.setItem(storageKey, "dismissed");
    setVisible(false);
  }

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeDevice();
        window.localStorage.setItem(storageKey, "enabled");
        setVisible(false);
        return;
      }
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-xl rounded-xl border border-sky-300/35 bg-field/95 p-4 text-ink shadow-2xl shadow-black/35 backdrop-blur">
      <button
        aria-label="Cerrar aviso de notificaciones"
        className="absolute right-3 top-3 rounded-lg border border-line bg-white/5 p-2 text-ink/70"
        onClick={dismiss}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-10">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-grass/35 bg-grass/15 text-grass">
          <Bell className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black">Activá las notificaciones</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-ink/70">
            Te avisamos cierre de pronósticos, partidos en vivo, resultados y novedades importantes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn primary" disabled={busy} onClick={enable} type="button">
              {busy ? "Activando..." : "Activar"}
            </button>
            <button className="btn secondary" onClick={dismiss} type="button">
              Luego
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
