import { PageHero } from "@/components/page-hero";
import { PaymentCard } from "@/components/payment-card";
import { PaymentsContent } from "@/components/payments-content";
import { getParticipantPayments, getPaymentSummary } from "@/lib/data";
import { CreditCard, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function PaymentsPage({ searchParams }: { searchParams?: { payment?: string } }) {
  const [summary, participants] = await Promise.all([
    getPaymentSummary(),
    getParticipantPayments()
  ]);

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

      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <article className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Pozo y premios</h2>
              <p className="mt-1 text-sm font-semibold text-ink/65">Cada entrada suma $10.000 al pozo.</p>
            </div>
            <div className="rounded-lg bg-mint px-4 py-3 text-right">
              <Trophy className="ml-auto h-5 w-5 text-grass" />
              <strong className="mt-1 block text-3xl">{money(summary.prizePool)}</strong>
              <span className="text-xs font-black uppercase text-grass">pozo</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-mint p-4">
              <span className="text-xs font-black uppercase text-grass">1er puesto - 70%</span>
              <strong className="mt-1 block text-2xl">{money(summary.firstPrize)}</strong>
            </div>
            <div className="rounded-lg bg-field p-4">
              <span className="text-xs font-black uppercase text-ink/55">2do puesto - 20%</span>
              <strong className="mt-1 block text-2xl">{money(summary.secondPrize)}</strong>
            </div>
            <div className="rounded-lg bg-field p-4">
              <span className="text-xs font-black uppercase text-ink/55">3ros - 10%</span>
              <strong className="mt-1 block text-2xl">{money(summary.thirdPrize)}</strong>
            </div>
          </div>
        </article>
        <PaymentCard />
      </section>

      <PaymentsContent
        participants={participants}
        paidParticipants={summary.paidParticipants}
        totalParticipants={summary.totalParticipants}
      />
    </div>
  );
}
