import { sendPredictionReminder } from "@/lib/mailer";
import { formatArgentinaDateTime } from "@/lib/dates";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  emails: z.array(z.string().email()).min(1).max(10),
  matchLabel: z.string().min(1).max(120)
});

export async function POST(req: Request) {
  const { emails, matchLabel } = Body.parse(await req.json());
  const results = [];

  for (const email of emails) {
    const result = await sendPredictionReminder({
      to: email,
      name: email.split("@")[0],
      matchLabel,
      kickoffAt: formatArgentinaDateTime(new Date(Date.now() + 4 * 60 * 60 * 1000)),
      predictionUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/probar`
    });
    results.push({ email, result });
  }

  return NextResponse.json({
    sent: results.length,
    mode:
      (process.env.EMAIL_PROVIDER === "gmail" && process.env.GMAIL_APP_PASSWORD) || process.env.RESEND_API_KEY
        ? "real"
        : "mock",
    results
  });
}
