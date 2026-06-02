import { getAppUserFromRequest } from "@/lib/app-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const fallbackPaymentUrl = "https://mpago.la/2kV7LPV";

export async function POST(req: Request) {
  const user = await getAppUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const attemptId = crypto.randomUUID();

  await db.from("payment_attempts").insert({
    id: attemptId,
    user_id: user.id,
    amount: 15000,
    status: "started",
    provider: "mercadopago"
  });

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL || new URL(req.url).origin;

  if (!accessToken) {
    return NextResponse.json({ url: fallbackPaymentUrl, attemptId, mode: "fallback-link" });
  }

  const preference = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      external_reference: attemptId,
      items: [
        {
          title: `Entrada Mundialito - ${user.displayName}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: 15000
        }
      ],
      back_urls: {
        success: `${appUrl}/ranking?payment=success`,
        failure: `${appUrl}/ranking?payment=failure`,
        pending: `${appUrl}/ranking?payment=pending`
      },
      notification_url: `${appUrl}/api/payments/mercadopago/webhook`,
      metadata: {
        user_id: user.id,
        display_name: user.displayName
      }
    })
  });

  if (!preference.ok) {
    return NextResponse.json({ url: fallbackPaymentUrl, attemptId, mode: "fallback-link" });
  }

  const data = await preference.json();
  await db
    .from("payment_attempts")
    .update({ preference_id: data.id ?? null, status: "preference_created", raw: data })
    .eq("id", attemptId);

  return NextResponse.json({ url: data.init_point ?? fallbackPaymentUrl, attemptId, mode: "checkout" });
}
