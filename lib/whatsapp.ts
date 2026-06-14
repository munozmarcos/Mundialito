export type WhatsAppCommand = "ranking" | "mis_apuestas" | "pendientes" | "ayuda";

export function whatsappGroupId() {
  return (process.env.ULTRAMSG_GROUP_ID ?? process.env.WHATSAPP_GROUP_ID ?? "").trim();
}

export function hasWhatsAppGroup() {
  return Boolean(whatsappGroupId());
}

export async function sendWhatsApp(to: string, body: string) {
  if (process.env.WHATSAPP_PROVIDER !== "ultramsg") {
    console.log("[WHATSAPP:mock]", { to, body });
    return { ok: true, provider: "mock" };
  }

  const rawInstance = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!rawInstance || !token) throw new Error("Missing UltraMsg environment variables");

  const instance = rawInstance
    .trim()
    .replace(/^https?:\/\/api\.ultramsg\.com\//i, "")
    .replace(/^\/+|\/+$/g, "");

  const res = await fetch(`https://api.ultramsg.com/${instance}/messages/chat`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, to, body })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`UltraMsg error ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return res.json();
}

export async function sendWhatsAppGroup(body: string) {
  const groupId = whatsappGroupId();
  if (!groupId) return { ok: false, skipped: true, reason: "missing-group-id" };
  return sendWhatsApp(groupId, body);
}

export function parseWhatsAppCommand(text: string): WhatsAppCommand {
  const clean = text.trim().toLowerCase();
  if (clean.includes("apuesta")) return "mis_apuestas";
  if (clean.includes("pendiente")) return "pendientes";
  if (clean.includes("ranking") || clean.includes("tabla")) return "ranking";
  return "ayuda";
}
