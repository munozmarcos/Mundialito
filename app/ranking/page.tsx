import { EmptyState } from "@/components/empty-state";
import { PageHero } from "@/components/page-hero";
import { PaymentCard } from "@/components/payment-card";
import { getParticipantPayments, getPaymentSummary, getRanking, type RankingRow } from "@/lib/data";
import { Trophy, UsersRound } from "lucide-react";

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

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="panel overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="text-2xl font-black">Ranking</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Puntos, exactos y tendencias acertadas.</p>
          </div>
          {!ranking.length ? (
            <div className="p-5">
              <EmptyState title="Ranking vacío" text="Cuando haya predicciones puntuadas, aparece la tabla." />
            </div>
          ) : (
            (ranking as RankingRow[]).map((row, index) => (
              <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-line p-4 last:border-0" key={row.user_id}>
                <div className="text-2xl font-black text-gold">#{index + 1}</div>
                <div>
                  <h3 className="font-black">{row.display_name}</h3>
                  <p className="text-sm text-ink/60">
                    {row.exact_hits} exactos - {row.trend_hits} tendencias
                  </p>
                </div>
                <div className="text-right">
                  <strong className="block text-2xl font-black">{row.total_points}</strong>
                  <span className="text-xs font-black uppercase text-ink/45">pts</span>
                </div>
              </div>
            ))
          )}
        </article>

        <article className="panel overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Participantes</h2>
                <p className="mt-1 text-sm font-semibold text-ink/60">Apodos registrados y estado de pago.</p>
              </div>
              <div className="rounded-lg bg-field px-4 py-3 text-right">
                <UsersRound className="ml-auto h-5 w-5 text-grass" />
                <strong className="mt-1 block text-2xl">{summary.paidParticipants}/{summary.totalParticipants}</strong>
                <span className="text-xs font-black uppercase text-ink/55">pagaron</span>
              </div>
            </div>
          </div>
          {!participants.length ? (
            <div className="p-5">
              <EmptyState title="Sin participantes" text="Cuando se registren, sus apodos aparecen acá." />
            </div>
          ) : (
            participants.map((participant) => (
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line p-4 last:border-0" key={participant.id}>
                <div>
                  <h3 className="font-black">{participant.display_name}</h3>
                  <p className="text-xs font-black text-ink/55">
                    {participant.role === "admin" ? "Admin" : "Participante"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                    participant.paid ? "bg-mint text-grass" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {participant.paid ? "Pago" : "Impago"}
                </span>
              </div>
            ))
          )}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <article className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Pozo y premios</h2>
              <p className="mt-1 text-sm font-semibold text-ink/65">
                Cada entrada suma $10.000 al pozo.
              </p>
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
