import { EmptyState } from "@/components/empty-state";
import { HomePrimaryAction } from "@/components/home-primary-action";
import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { getMatches, getNewsItems, getRanking } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { matchStatus } from "@/lib/scoring";
import { CalendarDays, CreditCard, LockKeyhole, MessageCircle, Newspaper, Trophy } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const features = [
  { icon: Trophy, title: "Ranking y premios", text: "Top 3, puntos, exactos y pozo actualizado con pagos." },
  { icon: LockKeyhole, title: "Estados claros", text: "Abierto, cerrado o bloqueado segun el momento del partido." },
  { icon: MessageCircle, title: "WhatsApp bot", text: "Comandos para ranking, pendientes, partidos y resultados." },
  { icon: Newspaper, title: "Novedades", text: "Avisos del admin y partidos importantes de la semana." },
  { icon: CreditCard, title: "Pago asociado", text: "Mercado Pago vinculado al apodo cuando el usuario paga logueado." }
];

function upcoming(matches: Awaited<ReturnType<typeof getMatches>>, limit: number) {
  const now = Date.now();
  return matches
    .filter((match) => new Date(match.kickoff_at).getTime() >= now && match.home_goals == null)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    .slice(0, limit);
}

function thisWeek(matches: Awaited<ReturnType<typeof getMatches>>) {
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  return matches
    .filter((match) => {
      const kickoff = new Date(match.kickoff_at).getTime();
      return kickoff >= now && kickoff <= weekEnd && match.home_goals == null;
    })
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
}

export default async function Home() {
  const [allMatches, ranking, newsItems] = await Promise.all([getMatches(), getRanking(), getNewsItems(5)]);
  const matches = upcoming(allMatches, 6);
  const weekMatches = thisWeek(allMatches);

  return (
    <div className="grid gap-6">
      <section className="panel hero-pitch p-5 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
            El prode con alma de Mundial.
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold text-white/86">
            Predicciones, tablas proyectadas, llave completa, ranking automático y WhatsApp para que nadie se olvide de cargar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomePrimaryAction />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {features.map((feature) => (
          <article className="panel flex gap-4 p-4" key={feature.title}>
            <feature.icon className="mt-1 h-5 w-5 shrink-0 text-grass" />
            <div>
              <h2 className="font-black">{feature.title}</h2>
              <p className="text-sm text-ink/70">{feature.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="text-xl font-black">Próximos partidos</h2>
            <Link className="btn secondary min-h-9 px-3" href="/mi-prode">Pronósticos</Link>
          </div>
          {!matches.length ? (
            <EmptyState title="Todavía no hay partidos" text="Cargá el calendario desde Admin para empezar." />
          ) : (
            <div className="grid">
              {matches.map((match) => (
                <article className="grid gap-3 border-b border-line p-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center" key={match.id}>
                  <div>
                    <div className="text-sm font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</div>
                    <h3 className="flex flex-wrap items-center gap-2 text-xl font-black">
                      <TeamLabel name={match.home_team} code={match.home_country_code} />
                      <span className="text-ink/40">vs</span>
                      <TeamLabel name={match.away_team} code={match.away_country_code} />
                    </h3>
                    <p className="text-sm text-ink/70">{[match.group_name ? `Grupo ${match.group_name}` : match.stage, match.stadium].filter(Boolean).join(" - ")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill
                      status={isMatchBlockedUntilOfficial(match) ? "locked" : matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status)}
                      label={isMatchBlockedUntilOfficial(match) ? "Bloqueado" : undefined}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 content-start">
          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <Trophy className="h-5 w-5 text-gold" />
              <h2 className="text-xl font-black">Ranking</h2>
            </div>
            {!ranking.length ? (
              <p className="p-5 text-sm font-semibold text-ink/65">Todavía no hay ranking.</p>
            ) : (
              ranking.slice(0, 3).map((row, index) => (
                <div className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-line p-4 last:border-0" key={row.user_id}>
                  <strong className="text-gold">#{index + 1}</strong>
                  <div>
                    <strong>{row.display_name}</strong>
                    <p className="text-xs text-ink/60">{row.exact_hits} exactos - {row.trend_hits} tendencias</p>
                  </div>
                  <strong>{row.total_points}</strong>
                </div>
              ))
            )}
            <div className="p-4">
              <Link className="btn secondary w-full" href="/ranking">Ver ranking completo</Link>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <CalendarDays className="h-5 w-5 text-gold" />
              <h2 className="text-xl font-black">Novedades</h2>
            </div>
            {!newsItems.length && !weekMatches.length ? (
              <p className="p-5 text-sm font-semibold text-ink/65">No quedan partidos pendientes esta semana.</p>
            ) : (
              <>
                {newsItems.map((item) => (
                  <div className="border-b border-line p-4" key={item.id}>
                    <p className="text-xs font-black uppercase text-gold">🗞️ Aviso Mundialito</p>
                    <h3 className="mt-1 font-black">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-ink/70">{item.body}</p>
                  </div>
                ))}
                {weekMatches.map((match) => (
                  <div className="border-b border-line p-4 last:border-0" key={match.id}>
                    <p className="text-xs font-black uppercase text-ink/45">🏟️ {formatArgentinaDateTime(match.kickoff_at)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 font-bold">
                      <TeamLabel name={match.home_team} code={match.home_country_code} />
                      <span className="text-ink/40">vs</span>
                      <TeamLabel name={match.away_team} code={match.away_country_code} />
                    </p>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
