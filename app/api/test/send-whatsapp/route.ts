import { findProfileByPhone } from "@/lib/whatsapp-commands";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendWebPushToUser } from "@/lib/web-push";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  to: z.string().min(6),
  body: z.string().min(1).max(4096)
});

export async function POST(req: Request) {
  const input = Body.parse(await req.json());
  const result = await sendWhatsApp(input.to, input.body);
  const profile = await findProfileByPhone(input.to);
  const push = profile?.id
    ? await sendWebPushToUser(profile.id, {
        title: "Mundialito",
        body: input.body.replace(/\*/g, "").split(/\r?\n/).filter(Boolean).slice(0, 3).join(" · ").slice(0, 180),
        url: "/novedades",
        tag: `test-whatsapp:${profile.id}`
      })
    : null;

  return NextResponse.json({
    mode: process.env.WHATSAPP_PROVIDER === "ultramsg" ? "real" : "mock",
    result,
    push
  });
}
