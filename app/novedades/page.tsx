import { getNewsItems, getRecentActivity, type ActivityRow } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { Newspaper, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novedades | Mundialito"
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function activityText(item: ActivityRow) {
  const profile = firstRelation(item.profiles);
  const match = firstRelation(item.matches);
  const name = profile?.display_name ?? "Un participante";
  const points = item.points === 1 ? "1 punto" : `${item.points} pts`;
  const hit = item.exact_hit ? "resultado exacto" : item.trend_hit ? "tendencia" : "pronóstico";

  if (!match) return `${name} sumó ${points} por su ${hit}.`;

  const result =
    match.home_goals == null || match.away_goals == null
      ? ""
      : ` (${match.home_goals}-${match.away_goals})`;
  return `${name} sumó ${points} por ${match.home_team} vs ${match.away_team}${result}: ${hit}.`;
}

export default async function NovedadesPage() {
  const [manualNews, activity] = await Promise.all([getNewsItems(100), getRecentActivity(100)]);
  const newsItems = [
    ...manualNews.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      created_at: item.created_at
    })),
    ...activity.map((item) => ({
      id: item.id,
      title: "Puntos sumados",
      body: activityText(item),
      created_at: item.updated_at ?? new Date().toISOString()
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <span className="badge">Novedades</span>
        <h1 className="mt-3 flex items-center gap-3 text-4xl font-black">
          <Newspaper className="h-8 w-8 text-grass" />
          Noticias del Mundialito
        </h1>
        <p className="mt-2 text-ink/70">Avisos oficiales y movimientos de puntaje del prode.</p>
      </section>

      <section className="grid gap-4">
        {!newsItems.length ? (
          <article className="panel p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-gold" />
            <h2 className="mt-3 text-2xl font-black">Todavía no hay avisos</h2>
            <p className="mt-1 text-sm font-semibold text-ink/65">Cuando el admin publique algo o se sumen puntos, queda registrado acá.</p>
          </article>
        ) : (
          newsItems.map((item) => (
            <article className="panel p-5" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-2xl font-black">{item.title}</h2>
                <time className="rounded-full border border-line bg-field px-3 py-1 text-xs font-black text-ink/55" dateTime={item.created_at}>
                  {formatArgentinaDateTime(item.created_at)}
                </time>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-base font-semibold leading-7 text-ink/78">{item.body}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
