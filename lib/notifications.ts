import { getNewsItems } from "@/lib/data";
import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { formatScoreWithPenalties } from "@/lib/match-score";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { fetchAllSupabaseRows } from "@/lib/supabase-pagination";

export type LatestNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: "admin" | "points" | "closing" | "closed" | "participant";
  point_players?: { name: string; points: number }[];
  match?: {
    home_team: string;
    away_team: string;
    home_country_code?: string | null;
    away_country_code?: string | null;
    home_goals?: number | null;
    away_goals?: number | null;
    home_penalty_goals?: number | null;
    away_penalty_goals?: number | null;
  };
};

type MatchNoticeRow = {
  id: string;
  home_team: string;
  away_team: string;
  home_country_code?: string | null;
  away_country_code?: string | null;
  kickoff_at: string;
  result_updated_at?: string | null;
  status: "open" | "locked" | "closed" | "playing";
  home_goals: number | null;
  away_goals: number | null;
  home_penalty_goals?: number | null;
  away_penalty_goals?: number | null;
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
  home_penalty_goals?: number | null;
  away_penalty_goals?: number | null;
  status?: string | null;
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
  let data: PointActivityRow[];
  try {
    data = await fetchAllSupabaseRows<PointActivityRow>((from, to) =>
      db
        .from("predictions")
        .select("id,user_id,points,updated_at,profiles(display_name),matches(id,home_team,away_team,home_country_code,away_country_code,home_goals,away_goals,home_penalty_goals,away_penalty_goals,status)")
        .gt("points", 0)
        .order("updated_at", { ascending: false })
        .range(from, to)
    );
  } catch (error) {
    console.warn("[notifications:points]", error);
    return [];
  }

  const groups = new Map<string, { match: PointMatchRow; updatedAt: string; players: Map<string, { name: string; points: number }> }>();
  for (const item of data) {
    const match = firstRelation(item.matches);
    if (!match?.id) continue;
    if (match.status !== "closed" && match.status !== "final") continue;
    if (match.home_goals == null || match.away_goals == null) continue;
    const profile = firstRelation(item.profiles);
    const group = groups.get(match.id) ?? { match, updatedAt: item.updated_at ?? new Date().toISOString(), players: new Map() };
    if (new Date(item.updated_at ?? 0).getTime() > new Date(group.updatedAt).getTime()) group.updatedAt = item.updated_at ?? group.updatedAt;
    group.players.set(item.user_id, { name: profile?.display_name ?? "Un participante", points: item.points });
    groups.set(match.id, group);
  }

  return [...groups.entries()]
    .map(([matchId, group]) => {
      const players = [...group.players.values()]
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "es"))
        .map((player) => ({ name: player.name, points: player.points }));
      return {
        id: `points-match:${matchId}:${formatScoreWithPenalties(group.match) ?? "x"}`,
        title: "Puntos obtenidos",
        body: "",
        created_at: group.updatedAt,
        type: "points" as const,
        point_players: players,
        match: group.match
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
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,result_updated_at,status,home_goals,away_goals,home_penalty_goals,away_penalty_goals")
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
    body: "Cierra la carga de pronósticos en menos de 15 minutos.",
    created_at: new Date(new Date(match.kickoff_at).getTime() - 15 * 60 * 1000).toISOString(),
    type: "closing" as const,
    match
  }));
}

async function getClosedMatchNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const todayStart = new Date(`${todayKey}T00:00:00-03:00`);
  todayStart.setUTCDate(todayStart.getUTCDate() - 1);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("matches")
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,result_updated_at,status,home_goals,away_goals,home_penalty_goals,away_penalty_goals")
    .or("status.eq.closed,home_goals.not.is.null")
    .gte("kickoff_at", todayStart.toISOString())
    .order("kickoff_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[notifications:closed]", error);
    return [];
  }

  return ((data ?? []) as MatchNoticeRow[]).map((match) => {
    const hasResult = match.home_goals != null && match.away_goals != null;
    const isLive = match.status === "playing";
    return {
      id: `closed:${match.id}:${formatScoreWithPenalties(match) ?? "x"}`,
      title: isLive ? "Partido en vivo" : hasResult ? "Partido cerrado" : "Pronósticos cerrados",
      body: isLive
        ? "Está en vivo."
        : hasResult
        ? ""
        : "Ya cerró la carga de pronósticos.",
      created_at: match.result_updated_at ?? match.kickoff_at,
      type: "closed" as const,
      match
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
    body: `${profile.display_name} se sumó al Mundialito.`,
    created_at: profile.created_at,
    type: "participant" as const
  }));
}

export async function getLatestNotifications(limit = 10, options?: { includeExpiredManual?: boolean }): Promise<LatestNotification[]> {
  const [manualNews, pointMatches, closingMatches, closedMatches, participants, hiddenIds] = await Promise.all([
    getNewsItems(limit, { includeExpired: options?.includeExpiredManual }),
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
