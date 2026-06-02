import { EmptyState } from "@/components/empty-state";
import { HomePrimaryAction } from "@/components/home-primary-action";
import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { getRecentActivity, getRanking, getUpcomingMatches } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { displayNameForTeam } from "@/lib/flags";
import { matchStatus } from "@/lib/scoring";
import { LockKeyhole, MessageCircle, MessageSquareText, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const features = [
  { icon: Trophy, title: "Ranking vivo", text: "Puntos, exactos, tendencias e historial por partido." },
  { icon: LockKeyhole, title: "Cierre automático", text: "Cada predicción se bloquea 15 minutos antes del inicio." },
  { icon: MessageCircle, title: "WhatsApp bot", text: "Recordatorios, ranking y carga rápida desde el chat." },
  { icon: MessageSquareText, title: "Chat IA", text: "Preguntas sobre tabla, pendientes y próximos partidos." }
];

export default async function Home() {
  const [matches, ranking, activity] = await Promise.all([
    getUpcomingMatches(6),
    getRanking(),
    getRecentActivity(6)
  ]);
  const profileName = (profile: (typeof activity)[number]["profiles"]) => Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name;
  const matchInfo = (match: (typeof activity)[number]["matches"]) => Array.isArray(match) ? match[0] : match;

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
            <Link className="btn secondary" href="/ranking">
              Ver ranking
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
        <div className="grid gap-4">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="text-xl font-black">Próximos partidos</h2>
              <Link className="btn secondary min-h-9 px-3" href="/mi-prode">Pronósticos</Link>
            </div>
            {!matches.length ? (
              <EmptyState title="Todavía no hay partidos" text="Carga el calendario desde Admin para empezar." />
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
                      {match.home_goals == null ? null : <strong className="text-xl">{match.home_goals}-{match.away_goals}</strong>}
                      <StatusPill status={matchStatus(match.kickoff_at, match.locked, match.home_goals != null)} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <Sparkles className="h-5 w-5 text-gold" />
              <h2 className="text-xl font-black">Novedades</h2>
            </div>
            {!activity.length ? (
              <p className="p-5 text-sm font-semibold text-ink/65">Todavía no hay puntos cargados. Cuando haya resultados, acá aparecen las jugadas destacadas.</p>
            ) : (
              activity.map((item) => (
                <div className="border-b border-line p-4 last:border-0" key={item.id}>
                  <p className="font-bold">
                    {profileName(item.profiles) ?? "Un jugador"} gano <span className="text-grass">{item.points} puntos</span>
                    {item.exact_hit ? " por resultado exacto" : item.trend_hit ? " por tendencia" : ""}.
                  </p>
                  {matchInfo(item.matches) && (
                    <p className="mt-1 text-sm text-ink/60">
                      {displayNameForTeam(matchInfo(item.matches)!.home_team)} {matchInfo(item.matches)!.home_goals}-{matchInfo(item.matches)!.away_goals} {displayNameForTeam(matchInfo(item.matches)!.away_team)}
                    </p>
                  )}
                </div>
              ))
            )}
          </section>
        </div>

        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <Trophy className="h-5 w-5 text-gold" />
            <h2 className="text-xl font-black">Ranking</h2>
          </div>
          {!ranking.length ? (
            <p className="p-5 text-sm font-semibold text-ink/65">Todavía no hay ranking.</p>
          ) : (
            ranking.slice(0, 8).map((row, index) => (
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
      </section>
    </div>
  );
}
