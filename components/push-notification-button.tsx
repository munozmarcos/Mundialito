"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/notification-sw.js");
}

export function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isSupported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(isSupported);
    if (isSupported) setPermission(Notification.permission);
  }, []);

  async function subscribeDevice() {
    const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
    if (!keyRes.ok) return;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;

    const registration = await registerWorker();
    if (!registration) return;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });
  }

  useEffect(() => {
    if (!supported || permission !== "granted") return;
    void subscribeDevice();
  }, [supported, permission]);

  async function enableNotifications() {
    if (!supported || busy) return;
    setBusy(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;
      await subscribeDevice();
    } finally {
      setBusy(false);
    }
  }

  if (!supported || permission === "granted") return null;

  return (
    <button
      aria-label={permission === "denied" ? "Notificaciones bloqueadas" : "Activar notificaciones"}
      className="btn secondary header-icon-btn min-h-9 px-3"
      disabled={busy || permission === "denied"}
      onClick={enableNotifications}
      title={permission === "denied" ? "Notificaciones bloqueadas en el navegador" : "Activar notificaciones"}
      type="button"
    >
      {permission === "denied" ? <BellOff className="header-action-icon header-action-icon-large" /> : <Bell className="header-action-icon header-action-icon-large" />}
    </button>
  );
}
