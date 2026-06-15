import { supabaseAdmin } from "@/lib/supabase";
import { sendGroupInviteIfPaid } from "@/lib/whatsapp-group-invite";

export async function readMercadoPagoPayment(paymentId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) return null;
  return response.json();
}

export async function applyMercadoPagoPayment(paymentId: string) {
  const payment = await readMercadoPagoPayment(paymentId);
  if (!payment) return { ok: false, skipped: "payment-not-readable" as const };

  const attemptId = payment.external_reference;
  if (!attemptId) return { ok: false, skipped: "missing-external-reference" as const, payment };

  const db = supabaseAdmin();
  const { data: attempt } = await db
    .from("payment_attempts")
    .select("id,user_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return { ok: false, skipped: "unknown-attempt" as const, payment };

  await db
    .from("payment_attempts")
    .update({
      status: payment.status ?? "unknown",
      payment_id: String(paymentId),
      raw: payment
    })
    .eq("id", attempt.id);

  let groupInviteWarning: string | null = null;
  if (payment.status === "approved") {
    const { data: previousProfile } = await db
      .from("profiles")
      .select("display_name,phone,paid")
      .eq("id", attempt.user_id)
      .maybeSingle();

    const { data: updatedProfile } = await db
      .from("profiles")
      .update({ paid: true })
      .eq("id", attempt.user_id)
      .select("display_name,phone,paid")
      .maybeSingle();

    if (!previousProfile?.paid && updatedProfile?.paid) {
      groupInviteWarning = await sendGroupInviteIfPaid(updatedProfile);
    }
  }

  return { ok: true, status: payment.status as string | undefined, attemptId: attempt.id, userId: attempt.user_id, groupInviteWarning, payment };
}
