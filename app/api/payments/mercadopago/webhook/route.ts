import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

async function readPayment(paymentId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  return response.json();
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const paymentId = body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!paymentId) return NextResponse.json({ ok: true, skipped: "missing-payment-id" });

  const payment = await readPayment(String(paymentId));
  if (!payment) return NextResponse.json({ ok: true, skipped: "payment-not-readable" });

  const attemptId = payment.external_reference;
  if (!attemptId) return NextResponse.json({ ok: true, skipped: "missing-external-reference" });

  const db = supabaseAdmin();
  const { data: attempt } = await db
    .from("payment_attempts")
    .select("id,user_id")
    .eq("id", attemptId)
    .single();

  if (!attempt) return NextResponse.json({ ok: true, skipped: "unknown-attempt" });

  await db
    .from("payment_attempts")
    .update({
      status: payment.status ?? "unknown",
      payment_id: String(paymentId),
      raw: payment
    })
    .eq("id", attempt.id);

  if (payment.status === "approved") {
    await db.from("profiles").update({ paid: true }).eq("id", attempt.user_id);
  }

  return NextResponse.json({ ok: true, status: payment.status });
}
