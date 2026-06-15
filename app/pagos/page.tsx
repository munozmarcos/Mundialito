import { PageHero } from "@/components/page-hero";
import { PaymentCard } from "@/components/payment-card";
import { PaymentsContent } from "@/components/payments-content";
import { getParticipantPayments, getPaymentSummary } from "@/lib/data";
import { applyMercadoPagoPayment } from "@/lib/mercadopago-payments";
import { CreditCard, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

type PaymentSearchParams = {
  payment?: string;
  payment_id?: string;
  collection_id?: string;
  status?: string;
};

export default async function PaymentsPage({ searchParams }: { searchParams?: PaymentSearchParams }) {
  const returnPaymentId = searchParams?.payment_id || searchParams?.collection_id;
  if (returnPaymentId) await applyMercadoPagoPayment(returnPaymentId);

  const [summary, participants] = await Promise.all([getPaymentSummary(), getParticipantPayments()]);

  return (
    <div className="grid gap-6">
      <PageHero
        badge="Pagos"
        icon={CreditCard}
        title="Pagos y pozo"
        subtitle="Entrada, participantes pagos, pozo acumulado y premios del Mundialito."
      />

      {searchParams?.payment && (
        <section className={`panel p-4 ${searchParams.payment === "success" ? "border-emerald-500/40" : "border-sky-500/40"}`}>
          <h2 className="text-lg font-black">
            {searchParams.payment === "success" ? "Pago recibido" : searchParams.payment === "pending" ? "Pago pendiente" : "Pago no completado"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-ink/70">
            {searchParams.payment === "success"
              ? "Si MercadoPago ya lo aprobó, tu estado aparece como Pago y el pozo se actualiza solo."
              : searchParams.payment === "pending"
                ? "MercadoPago todavía lo está procesando. Cuando quede aprobado, se actualiza solo."
                : "No se registró un pago aprobado. Podés intentar de nuevo cuando quieras."}
          </p>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <article className="panel p-5">
          <div className="grid justify-items-center gap-4 text-center">
            <div>
              <h2 className="text-2xl font-black">Premios</h2>
              <p className="mt-1 text-sm font-semibold text-ink/65">Cada entrada suma $10.000 al pozo.</p>
            </div>
            <div className="w-full max-w-md rounded-lg border border-grass/35 bg-grass/15 px-5 py-4 text-center shadow-[0_18px_38px_rgba(32,182,67,0.16)]">
              <Trophy className="mx-auto h-7 w-7 text-grass" />
              <strong className="mt-2 block text-4xl font-black text-grass sm:text-5xl">{money(summary.prizePool)}</strong>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-grass">Pozo</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-yellow-300/45 bg-yellow-300/12 p-4 text-center">
              <span className="text-xs font-black uppercase text-yellow-200">1er puesto - 70%</span>
              <strong className="mt-1 block text-2xl text-yellow-200">{money(summary.firstPrize)}</strong>
            </div>
            <div className="rounded-lg border border-slate-200/45 bg-slate-200/12 p-4 text-center">
              <span className="text-xs font-black uppercase text-slate-100">2do puesto - 20%</span>
              <strong className="mt-1 block text-2xl text-slate-100">{money(summary.secondPrize)}</strong>
            </div>
            <div className="rounded-lg border border-orange-300/45 bg-orange-400/12 p-4 text-center">
              <span className="text-xs font-black uppercase text-orange-200">3er puesto - 10%</span>
              <strong className="mt-1 block text-2xl text-orange-200">{money(summary.thirdPrize)}</strong>
            </div>
          </div>
        </article>
        <PaymentCard />
      </section>

      <PaymentsContent
        participants={participants}
        paidParticipants={summary.paidParticipants}
        totalParticipants={summary.totalParticipants}
        groupInviteUrl={process.env.WHATSAPP_GROUP_INVITE_URL}
      />
    </div>
  );
}

