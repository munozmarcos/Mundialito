import { applyMercadoPagoPayment } from "@/lib/mercadopago-payments";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const paymentId = body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!paymentId) return NextResponse.json({ ok: true, skipped: "missing-payment-id" });

  const result = await applyMercadoPagoPayment(String(paymentId));
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? url.searchParams.get("payment_id");
  if (!paymentId) return NextResponse.json({ ok: true, skipped: "missing-payment-id" });

  const result = await applyMercadoPagoPayment(String(paymentId));
  return NextResponse.json(result);
}
