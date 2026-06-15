export type WhatsAppCommand = "ranking" | "mis_apuestas" | "pendientes" | "ayuda";

export function whatsappGroupId() {
  return (process.env.ULTRAMSG_GROUP_ID ?? process.env.WHATSAPP_GROUP_ID ?? "").trim();
}

export function hasWhatsAppGroup() {
  return Boolean(whatsappGroupId());
}

function decodeEscapedUnicode(value: string) {
  const normalized = value.replace(/\\{2,}u/g, "\\u");
  if (!/\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}/.test(normalized)) return normalized;

  return normalized
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u(d[89ab][0-9a-fA-F]{2})\\u(d[cdef][0-9a-fA-F]{2})/gi, (_, high, low) => {
      const highCode = parseInt(high, 16);
      const lowCode = parseInt(low, 16);
      return String.fromCodePoint((highCode - 0xd800) * 0x400 + (lowCode - 0xdc00) + 0x10000);
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export async function sendWhatsApp(to: string, body: string) {
  const cleanBody = decodeEscapedUnicode(body);
  if (process.env.WHATSAPP_PROVIDER !== "ultramsg") {
    console.log("[WHATSAPP:mock]", { to, body: cleanBody });
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
    body: new URLSearchParams({ token, to, body: cleanBody })
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
