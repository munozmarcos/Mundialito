import webPush, { type PushSubscription } from "web-push";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function cleanEnvValue(value?: string | null) {
  return (value ?? "").replace(/^\uFEFF/, "").replace(/^ï»¿/, "").trim();
}

function webPushConfigured() {
  return Boolean(cleanEnvValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && cleanEnvValue(process.env.VAPID_PRIVATE_KEY));
}

function configureWebPush() {
  const publicKey = cleanEnvValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = cleanEnvValue(process.env.VAPID_PRIVATE_KEY);
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails("mailto:gmunozmarcos@gmail.com", publicKey, privateKey);
  return true;
}

export function publicVapidKey() {
  return cleanEnvValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) || null;
}

export async function sendWebPushToAll(payload: WebPushPayload & { dedupeKey?: string }) {
  if (!supabaseAdminConfigured() || !webPushConfigured() || !configureWebPush()) {
    return { sent: 0, failed: 0, skipped: "not-configured" };
  }

  const db = supabaseAdmin();
  if (payload.dedupeKey) {
    const { error } = await db.from("web_push_logs").insert({ id: payload.dedupeKey });
    if (error) return { sent: 0, failed: 0, skipped: "duplicate" };
  }

  const { data, error } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth");
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as PushSubscriptionRow[]) {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth
      }
    };

    try {
      await webPush.sendNotification(subscription, JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/novedades",
        tag: payload.tag ?? payload.dedupeKey ?? "mundialito",
        icon: "/favicon.png",
        badge: "/favicon.png"
      }));
      sent += 1;
    } catch (error: any) {
      failed += 1;
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("id", row.id);
      }
    }
  }

  return { sent, failed };
}
