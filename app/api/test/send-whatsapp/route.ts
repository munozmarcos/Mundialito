import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  to: z.string().min(6),
  body: z.string().min(1).max(4096)
});

export async function POST(req: Request) {
  const input = Body.parse(await req.json());
  const result = await sendWhatsApp(input.to, input.body);

  return NextResponse.json({
    mode: process.env.WHATSAPP_PROVIDER === "ultramsg" ? "real" : "mock",
    result
  });
}

