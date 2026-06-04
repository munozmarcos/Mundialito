import { getNewsItems, getRecentActivity, type ActivityRow } from "@/lib/data";

export type LatestNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: "admin" | "points";
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
  const hit = item.exact_hit ? "resultado exacto" : item.trend_hit ? "tendencia" : "pronostico";

  if (!match) return `${name} sumo ${points} por su ${hit}.`;

  const result =
    match.home_goals == null || match.away_goals == null
      ? ""
      : ` (${match.home_goals}-${match.away_goals})`;
  return `${name} sumo ${points} por ${match.home_team} vs ${match.away_team}${result}: ${hit}.`;
}

export async function getLatestNotifications(limit = 10): Promise<LatestNotification[]> {
  const [manualNews, activity] = await Promise.all([getNewsItems(limit), getRecentActivity(limit)]);

  return [
    ...manualNews.map((item) => ({
      id: `admin:${item.id}`,
      title: item.title,
      body: item.body,
      created_at: item.created_at,
      type: "admin" as const
    })),
    ...activity.map((item) => ({
      id: `points:${item.id}`,
      title: "Puntos sumados",
      body: activityText(item),
      created_at: item.updated_at ?? new Date().toISOString(),
      type: "points" as const
    }))
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
