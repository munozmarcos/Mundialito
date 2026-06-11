import { getNewsItems } from "@/lib/data";
import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
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
  home_country_code?: string | null;
  away_country_code?: string | null;
  kickoff_at: string;
  status: "open" | "locked" | "closed" | "playing";
  home_goals: number | null;
  away_goals: number | null;
};

type ParticipantNoticeRow = {
  id: string;
  display_name: string;
  created_at: string;
};

type PointMatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  home_country_code?: string | null;
  away_country_code?: string | null;
  home_goals: number | null;
  away_goals: number | null;
};

type PointActivityRow = {
  id: string;
  user_id: string;
  points: number;
  updated_at?: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
  matches?: PointMatchRow | PointMatchRow[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function matchLabel(match: Pick<MatchNoticeRow, "home_team" | "away_team" | "home_country_code" | "away_country_code">) {
  return [
    flagEmojiForTeam(match.home_team, match.home_country_code),
    displayNameForTeam(match.home_team),
    "vs",
    flagEmojiForTeam(match.away_team, match.away_country_code),
    displayNameForTeam(match.away_team)
  ].join(" ");
}

async function getHiddenNotificationIds() {
  if (!supabaseConfigured()) return new Set<string>();
  const db = supabaseAdmin();
  const { data, error } = await db.from("hidden_automatic_notifications").select("id");
  if (error) {
    console.warn("[notifications:hidden]", error);
    return new Set<string>();
  }
  return new Set((data ?? []).map((item) => item.id as string));
}

async function getPointMatchNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("predictions")
    .select("id,user_id,points,updated_at,profiles(display_name),matches(id,home_team,away_team,home_country_code,away_country_code,home_goals,away_goals)")
    .gt("points", 0)
    .order("updated_at", { ascending: false })
    .limit(limit * 40);

  if (error) {
    console.warn("[notifications:points]", error);
    return [];
  }

  const groups = new Map<string, { match: PointMatchRow; updatedAt: string; players: Map<string, { name: string; points: number }> }>();
  for (const item of (data ?? []) as unknown as PointActivityRow[]) {
    const match = firstRelation(item.matches);
    if (!match?.id) continue;
    const profile = firstRelation(item.profiles);
    const group = groups.get(match.id) ?? { match, updatedAt: item.updated_at ?? new Date().toISOString(), players: new Map() };
    if (new Date(item.updated_at ?? 0).getTime() > new Date(group.updatedAt).getTime()) group.updatedAt = item.updated_at ?? group.updatedAt;
    group.players.set(item.user_id, { name: profile?.display_name ?? "Un participante", points: item.points });
    groups.set(match.id, group);
  }

  return [...groups.entries()]
    .map(([matchId, group]) => {
      const score =
        group.match.home_goals == null || group.match.away_goals == null
          ? ""
          : ` (${group.match.home_goals}-${group.match.away_goals})`;
      const players = [...group.players.values()]
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "es"))
        .map((player) => `${player.name}: ${player.points} pts`)
        .join("\n");
      return {
        id: `points-match:${matchId}:${group.match.home_goals ?? "x"}-${group.match.away_goals ?? "x"}`,
        title: "Puntos sumados",
        body: `${matchLabel(group.match)}${score}\n${players}`,
        created_at: group.updatedAt,
        type: "points" as const
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

async function getClosingMatchNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const now = new Date();
  const closesUntil = new Date(now.getTime() + 15 * 60 * 1000);
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("matches")
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,status,home_goals,away_goals")
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
    body: `${matchLabel(match)} cierra la carga de pronosticos en menos de 15 minutos.`,
    created_at: match.kickoff_at,
    type: "closing" as const
  }));
}

async function getClosedMatchNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("matches")
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,status,home_goals,away_goals")
    .or("status.eq.closed,home_goals.not.is.null")
    .order("kickoff_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[notifications:closed]", error);
    return [];
  }

  return ((data ?? []) as MatchNoticeRow[]).map((match) => {
    const hasResult = match.home_goals != null && match.away_goals != null;
    const isLive = match.status === "playing";
    const score =
      !hasResult
        ? ""
        : ` Resultado: ${match.home_goals}-${match.away_goals}.`;
    return {
      id: `closed:${match.id}:${match.home_goals ?? "x"}-${match.away_goals ?? "x"}`,
      title: isLive ? "Partido en vivo" : hasResult ? "Partido finalizado" : "Pronosticos cerrados",
      body: isLive
        ? `${matchLabel(match)} esta en vivo.${score}`
        : hasResult
        ? `${matchLabel(match)} ya finalizo.${score}`
        : `${matchLabel(match)} ya cerro la carga de pronosticos.`,
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
  const [manualNews, pointMatches, closingMatches, closedMatches, participants, hiddenIds] = await Promise.all([
    getNewsItems(limit),
    getPointMatchNotifications(limit),
    getClosingMatchNotifications(limit),
    getClosedMatchNotifications(limit),
    getParticipantNotifications(limit),
    getHiddenNotificationIds()
  ]);

  return [
    ...manualNews.map((item) => ({
      id: `admin:${item.id}`,
      title: item.title,
      body: item.body,
      created_at: item.created_at,
      type: "admin" as const
    })),
    ...pointMatches,
    ...closingMatches,
    ...closedMatches,
    ...participants
  ]
    .filter((item) => !hiddenIds.has(item.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
