export type WhatsAppCommand = "ranking" | "mis_apuestas" | "pendientes" | "ayuda";

export async function sendWhatsApp(to: string, body: string) {
  if (process.env.WHATSAPP_PROVIDER !== "ultramsg") {
    console.log("[WHATSAPP:mock]", { to, body });
    return { ok: true, provider: "mock" };
  }

  const instance = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instance || !token) throw new Error("Missing UltraMsg environment variables");

  const res = await fetch(`https://api.ultramsg.com/${instance}/messages/chat`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, to, body })
  });

  if (!res.ok) throw new Error(`UltraMsg error ${res.status}`);
  return res.json();
}

export function parseWhatsAppCommand(text: string): WhatsAppCommand {
  const clean = text.trim().toLowerCase();
  if (clean.includes("apuesta")) return "mis_apuestas";
  if (clean.includes("pendiente")) return "pendientes";
  if (clean.includes("ranking") || clean.includes("tabla")) return "ranking";
  return "ayuda";
}
