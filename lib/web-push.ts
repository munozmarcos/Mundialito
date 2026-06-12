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
  user_id?: string | null;
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

async function reserveDedupeKey(dedupeKey?: string) {
  if (!dedupeKey) return true;
  const db = supabaseAdmin();
  const { error } = await db.from("web_push_logs").insert({ id: dedupeKey });
  return !error;
}

async function sendWebPushRows(rows: PushSubscriptionRow[], payload: WebPushPayload & { dedupeKey?: string }) {
  const db = supabaseAdmin();
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
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

function pushReady() {
  return supabaseAdminConfigured() && webPushConfigured() && configureWebPush();
}

export async function sendWebPushToAll(payload: WebPushPayload & { dedupeKey?: string }) {
  if (!pushReady()) return { sent: 0, failed: 0, skipped: "not-configured" };

  const db = supabaseAdmin();
  if (payload.dedupeKey) {
    const reserved = await reserveDedupeKey(payload.dedupeKey);
    if (!reserved) return { sent: 0, failed: 0, skipped: "duplicate" };
  }

  const { data, error } = await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth");
  if (error) throw error;

  return sendWebPushRows((data ?? []) as PushSubscriptionRow[], payload);
}

export async function sendWebPushToUser(userId: string, payload: WebPushPayload & { dedupeKey?: string }) {
  if (!pushReady()) return { sent: 0, failed: 0, skipped: "not-configured" };

  const db = supabaseAdmin();
  if (payload.dedupeKey) {
    const reserved = await reserveDedupeKey(`${payload.dedupeKey}:${userId}`);
    if (!reserved) return { sent: 0, failed: 0, skipped: "duplicate" };
  }

  const { data, error } = await db
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (error) throw error;

  return sendWebPushRows((data ?? []) as PushSubscriptionRow[], payload);
}
