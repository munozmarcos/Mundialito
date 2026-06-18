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

let ultraMsgConnectionCache: { checkedAt: number; ok: boolean; message?: string } | null = null;

async function assertUltraMsgConnected(instance: string, token: string) {
  const now = Date.now();
  if (ultraMsgConnectionCache && now - ultraMsgConnectionCache.checkedAt < 20_000) {
    if (ultraMsgConnectionCache.ok) return;
    throw new Error(ultraMsgConnectionCache.message ?? "UltraMsg no conectado");
  }

  const res = await fetch(`https://api.ultramsg.com/${instance}/instance/me?token=${encodeURIComponent(token)}`, {
    cache: "no-store"
  });
  const payload = await res.json().catch(() => null);
  const error = payload && typeof payload === "object" && "error" in payload
    ? String((payload as { error?: unknown }).error)
    : "";

  const ok = res.ok && !error;
  ultraMsgConnectionCache = {
    checkedAt: now,
    ok,
    message: ok ? undefined : `UltraMsg no conectado${error ? `: ${error}` : ""}. Escaneá el QR de la instancia.`
  };

  if (!ok) throw new Error(ultraMsgConnectionCache.message);
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

  await assertUltraMsgConnected(instance, token);

  const res = await fetch(`https://api.ultramsg.com/${instance}/messages/chat`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, to, body: cleanBody })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`UltraMsg error ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }

  const payload = await res.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    throw new Error("UltraMsg error: respuesta inválida");
  }

  const sentValue = "sent" in payload ? String((payload as { sent?: unknown }).sent).toLowerCase() : "";
  const okValue = "ok" in payload ? Boolean((payload as { ok?: unknown }).ok) : undefined;
  if (sentValue === "false" || okValue === false || "error" in payload) {
    const message =
      (payload as { error?: unknown; message?: unknown }).error ??
      (payload as { error?: unknown; message?: unknown }).message ??
      "envío rechazado";
    throw new Error(`UltraMsg error: ${String(message).slice(0, 180)}`);
  }

  return payload;
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
