import { getNewsItems, getRecentActivity, type ActivityRow } from "@/lib/data";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export type LatestNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: "admin" | "points" | "closing" | "closed" | "participant";
};

type MatchNoticeRow = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: "open" | "locked" | "closed";
  home_goals: number | null;
  away_goals: number | null;
};

type ParticipantNoticeRow = {
  id: string;
  display_name: string;
  created_at: string;
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

async function getClosingMatchNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const now = new Date();
  const closesUntil = new Date(now.getTime() + 15 * 60 * 1000);
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("matches")
    .select("id,home_team,away_team,kickoff_at,status,home_goals,away_goals")
    .eq("status", "open")
    .gte("kickoff_at", now.toISOString())
    .lte("kickoff_at", closesUntil.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("[notifications:closing]", error);
    return [];
  }

  return ((data ?? []) as MatchNoticeRow[]).map((match) => ({
    id: `closing:${match.id}`,
    title: "Partido por cerrar",
    body: `${match.home_team} vs ${match.away_team} cierra en menos de 15 minutos. Revisen sus pronosticos.`,
    created_at: match.kickoff_at,
    type: "closing" as const
  }));
}

async function getClosedMatchNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("matches")
    .select("id,home_team,away_team,kickoff_at,status,home_goals,away_goals")
    .or("status.eq.closed,home_goals.not.is.null")
    .order("kickoff_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[notifications:closed]", error);
    return [];
  }

  return ((data ?? []) as MatchNoticeRow[]).map((match) => {
    const score =
      match.home_goals == null || match.away_goals == null
        ? ""
        : ` Resultado: ${match.home_goals}-${match.away_goals}.`;
    return {
      id: `closed:${match.id}:${match.home_goals ?? "x"}-${match.away_goals ?? "x"}`,
      title: "Partido finalizado",
      body: `${match.home_team} vs ${match.away_team} ya esta cerrado.${score}`,
      created_at: match.kickoff_at,
      type: "closed" as const
    };
  });
}

async function getParticipantNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[notifications:participants]", error);
    return [];
  }

  return ((data ?? []) as ParticipantNoticeRow[]).map((profile) => ({
    id: `participant:${profile.id}`,
    title: "Nuevo participante",
    body: `${profile.display_name} se sumo al Mundialito.`,
    created_at: profile.created_at,
    type: "participant" as const
  }));
}

export async function getLatestNotifications(limit = 10): Promise<LatestNotification[]> {
  const [manualNews, activity, closingMatches, closedMatches, participants] = await Promise.all([
    getNewsItems(limit),
    getRecentActivity(limit),
    getClosingMatchNotifications(limit),
    getClosedMatchNotifications(limit),
    getParticipantNotifications(limit)
  ]);

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
    })),
    ...closingMatches,
    ...closedMatches,
    ...participants
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
