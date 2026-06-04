import { getAppUserFromRequest } from "@/lib/app-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

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
    await db.from("payment_attempts").update({ status: "missing_access_token" }).eq("id", attemptId);
    return NextResponse.json({ error: "MercadoPago no esta configurado. Avisale a Marcos." }, { status: 503 });
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
        success: `${appUrl}/pagos?payment=success&attempt=${attemptId}`,
        failure: `${appUrl}/pagos?payment=failure&attempt=${attemptId}`,
        pending: `${appUrl}/pagos?payment=pending&attempt=${attemptId}`
      },
      notification_url: `${appUrl}/api/payments/mercadopago/webhook`,
      metadata: {
        user_id: user.id,
        display_name: user.displayName
      }
    })
  });

  if (!preference.ok) {
    const raw = await preference.text().catch(() => "");
    await db
      .from("payment_attempts")
      .update({ status: "preference_error", raw: { error: raw } })
      .eq("id", attemptId);
    return NextResponse.json({ error: "No se pudo abrir MercadoPago. Proba de nuevo en un minuto." }, { status: 502 });
  }

  const data = await preference.json();
  await db
    .from("payment_attempts")
    .update({ preference_id: data.id ?? null, status: "preference_created", raw: data })
    .eq("id", attemptId);

  if (!data.init_point) {
    await db.from("payment_attempts").update({ status: "missing_init_point", raw: data }).eq("id", attemptId);
    return NextResponse.json({ error: "MercadoPago no devolvio link de pago." }, { status: 502 });
  }

  return NextResponse.json({ url: data.init_point, attemptId, mode: "checkout" });
}
