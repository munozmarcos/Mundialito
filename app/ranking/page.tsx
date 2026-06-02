import { PageHero } from "@/components/page-hero";
import { PaymentCard } from "@/components/payment-card";
import { RankingContent } from "@/components/ranking-content";
import { getParticipantPayments, getPaymentSummary, getRanking, type RankingRow } from "@/lib/data";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function RankingPage() {
  const [ranking, summary, participants] = await Promise.all([
    getRanking(),
    getPaymentSummary(),
    getParticipantPayments()
  ]);

  return (
    <div className="grid gap-6">
      <PageHero
        badge="Ranking y pozo"
        icon={Trophy}
        title="Ranking y pagos"
        subtitle="Posiciones generales, puntos acumulados, pozo del Mundialito y estado de pago de cada participante."
      />

      <RankingContent
        ranking={ranking as RankingRow[]}
        participants={participants}
        paidParticipants={summary.paidParticipants}
        totalParticipants={summary.totalParticipants}
      />

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
              <span className="text-xs font-black uppercase text-ink/55">3er puesto - 10%</span>
              <strong className="mt-1 block text-2xl">{money(summary.thirdPrize)}</strong>
            </div>
          </div>
        </article>
        <PaymentCard />
      </section>
    </div>
  );
}
