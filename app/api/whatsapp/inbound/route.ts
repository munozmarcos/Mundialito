import { answerWhatsAppCommand, findProfileByPhone, isWhatsAppCommand } from "@/lib/whatsapp-commands";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendWebPushToUser } from "@/lib/web-push";
import { NextResponse } from "next/server";

function allowed(req: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return true;
  const url = new URL(req.url);
  return (
    url.searchParams.get("secret") === secret ||
    req.headers.get("x-webhook-secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}`
  );
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function firstPhoneLike(...values: unknown[]) {
  for (const value of values) {
    const text = firstText(value);
    if (!text) continue;
    const digits = text.replace(/@.+$/, "").replace(/:.+$/, "").replace(/\D/g, "");
    if (digits.length >= 8 || /@c\.us|@s\.whatsapp\.net/i.test(text)) return text;
  }
  return firstText(...values);
}

function compactPushBody(answer: string) {
  return answer
    .replace(/\*/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ")
    .slice(0, 180);
}

export async function POST(req: Request) {
  if (!allowed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = body.data ?? body;
  const text = firstText(payload.body, payload.text, payload.message, payload.caption, payload.Body, body.body);
  const from = firstPhoneLike(payload.author, payload.sender, payload.from, payload.phone, payload.From, body.from);
  const to = firstText(payload.to, payload.chatId, payload.chat_id, body.to);
  const isOutgoing = Boolean(payload.fromMe ?? payload.from_me ?? body.fromMe ?? body.from_me);
  const textValue = String(text);

  if (!isWhatsAppCommand(textValue)) {
    console.log("[whatsapp:ignored-not-command]", { from, to, text: textValue.slice(0, 40), isOutgoing });
    return NextResponse.json({ ignored: true, reason: "not_a_command" });
  }

  const participantPhone = isOutgoing ? to || from : from;
  const replyTo = isOutgoing ? to || from : from;
  const answer = await answerWhatsAppCommand(textValue, String(participantPhone));

  console.log("[whatsapp:command]", { participantPhone, replyTo, text: textValue.slice(0, 40), isOutgoing });
  if (replyTo) {
    await sendWhatsApp(String(replyTo), answer);
    const profile = await findProfileByPhone(String(participantPhone));
    if (profile?.id) {
      await sendWebPushToUser(profile.id, {
        title: "Mundialito",
        body: compactPushBody(answer),
        url: "/mi-prode",
        tag: `whatsapp-command:${profile.id}`
      });
    }
  }
  return NextResponse.json({ answer, replied: Boolean(replyTo), outgoing: isOutgoing });
}
