import { TeamLabel } from "@/components/team-label";
import { getAutomaticNewsItems, getMatches, getNewsItems } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { CalendarDays, Newspaper, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novedades | Mundialito"
};

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

export default async function NovedadesPage() {
  const [manualNews, automaticNews, matches] = await Promise.all([getNewsItems(100), getAutomaticNewsItems(100), getMatches()]);
  const newsItems = [...manualNews, ...automaticNews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const weekMatches = thisWeek(matches);

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <span className="badge">Novedades</span>
        <h1 className="mt-3 flex items-center gap-3 text-4xl font-black">
          <Newspaper className="h-8 w-8 text-grass" />
          Noticias del Mundialito
        </h1>
        <p className="mt-2 text-ink/70">Avisos oficiales, partidos de la semana y todo lo que va pasando en el prode.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="grid gap-4">
          {!newsItems.length ? (
            <article className="panel p-6 text-center">
              <Trophy className="mx-auto h-8 w-8 text-gold" />
              <h2 className="mt-3 text-2xl font-black">Todavía no hay avisos</h2>
              <p className="mt-1 text-sm font-semibold text-ink/65">Cuando el admin publique algo, queda registrado acá.</p>
            </article>
          ) : (
            newsItems.map((item) => (
              <article className="panel p-5" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gold">Aviso Mundialito</p>
                    <h2 className="mt-2 text-2xl font-black">{item.title}</h2>
                  </div>
                  <span className="rounded-full border border-line bg-field px-3 py-1 text-xs font-black text-ink/55">
                    {formatArgentinaDateTime(item.created_at)}
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-base font-semibold leading-7 text-ink/78">{item.body}</p>
              </article>
            ))
          )}
        </div>

        <aside className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <CalendarDays className="h-5 w-5 text-gold" />
            <h2 className="text-xl font-black">Partidos de la semana</h2>
          </div>
          {!weekMatches.length ? (
            <p className="p-5 text-sm font-semibold text-ink/65">No quedan partidos pendientes esta semana.</p>
          ) : (
            weekMatches.map((match) => (
              <div className="border-b border-line p-4 last:border-0" key={match.id}>
                <p className="text-xs font-black uppercase text-ink/45">{formatArgentinaDateTime(match.kickoff_at)}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-bold">
                  <TeamLabel name={match.home_team} code={match.home_country_code} />
                  <span className="text-ink/40">vs</span>
                  <TeamLabel name={match.away_team} code={match.away_country_code} />
                </p>
              </div>
            ))
          )}
        </aside>
      </section>
    </div>
  );
}
