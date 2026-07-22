import { getNewsItems, getPaymentSummary, getRanking } from "@/lib/data";
import { countryCodeForTeam, displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { formatScoreWithPenalties } from "@/lib/match-score";
import { rankingRankForIndex, rankingPrefix } from "@/lib/ranking-position";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { fetchAllSupabaseRows } from "@/lib/supabase-pagination";

export type LatestNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: "admin" | "points" | "podium" | "champions" | "closing" | "closed" | "participant";
  point_players?: { name: string; points: number }[];
  podium_team?: {
    team: string;
    code?: string | null;
  };
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

type PodiumPointRow = {
  user_id: string;
  champion_team?: string | null;
  runner_up_team?: string | null;
  third_place_team?: string | null;
  champion_points: number;
  runner_up_points: number;
  third_place_points: number;
  points: number;
  updated_at?: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
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

async function getPodiumPointNotifications(limit: number): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  const db = supabaseAdmin();
  let data: PodiumPointRow[];
  try {
    data = await fetchAllSupabaseRows<PodiumPointRow>((from, to) =>
      db
        .from("podium_predictions")
        .select("user_id,champion_team,runner_up_team,third_place_team,champion_points,runner_up_points,third_place_points,points,updated_at,profiles(display_name)")
        .gt("points", 0)
        .order("updated_at", { ascending: false })
        .range(from, to)
    );
  } catch (error) {
    console.warn("[notifications:podium-points]", error);
    return [];
  }

  const groups = [
    {
      key: "champion",
      title: "🥇 Podio anticipado: Campeón",
      pointsField: "champion_points" as const,
      teamField: "champion_team" as const
    },
    {
      key: "runner-up",
      title: "🥈 Podio anticipado: Subcampeón",
      pointsField: "runner_up_points" as const,
      teamField: "runner_up_team" as const
    },
    {
      key: "third-place",
      title: "🥉 Podio anticipado: 3er puesto",
      pointsField: "third_place_points" as const,
      teamField: "third_place_team" as const
    }
  ].map((definition) => {
    const winners = data
      .filter((row) => (row[definition.pointsField] ?? 0) > 0)
      .map((row) => {
        const profile = firstRelation(row.profiles);
        return {
          name: profile?.display_name ?? "Un participante",
          points: row[definition.pointsField] ?? 0,
          team: row[definition.teamField] ?? null,
          updatedAt: row.updated_at ?? new Date().toISOString()
        };
      });
    const firstWinner = winners[0];
    const team = firstWinner?.team;
    return {
      id: `podium:${definition.key}:${team ?? "pending"}`,
      title: definition.title,
      body: "",
      created_at: winners.reduce((latest, winner) => (new Date(winner.updatedAt).getTime() > new Date(latest).getTime() ? winner.updatedAt : latest), firstWinner?.updatedAt ?? new Date(0).toISOString()),
      type: "podium" as const,
      podium_team: team ? { team, code: countryCodeForTeam(team) } : undefined,
      point_players: winners
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((winner) => ({ name: winner.name, points: winner.points }))
    };
  });

  return groups
    .filter((item) => item.point_players.length > 0)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

async function getChampionsNotification(): Promise<LatestNotification[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    const { data: finalMatch, error } = await db
      .from("matches")
      .select("id,result_updated_at,kickoff_at,status,home_goals,away_goals,home_penalty_goals,away_penalty_goals")
      .eq("stage", "FINAL")
      .maybeSingle();
    if (error) throw error;
    if (!finalMatch || finalMatch.status !== "closed" || finalMatch.home_goals == null || finalMatch.away_goals == null) return [];

    const [ranking, payments] = await Promise.all([getRanking(), getPaymentSummary()]);
    const prizeByRank: Record<number, number> = {
      1: payments.firstPrize,
      2: payments.secondPrize,
      3: payments.thirdPrize
    };
    const podiumRows = ranking
      .map((row, index) => ({ ...row, rank: rankingRankForIndex(ranking, index) }))
      .filter((row) => row.rank <= 3);
    if (!podiumRows.length) return [];

    return [
      {
        id: `champions:${finalMatch.id}:${formatScoreWithPenalties(finalMatch) ?? "final"}`,
        title: "Campeones del prode",
        body: podiumRows
          .map((row) => `${rankingPrefix(row.rank)} ${row.display_name} - ${row.total_points} pts - ${money(prizeByRank[row.rank] ?? 0)}`)
          .join("\n"),
        created_at: finalMatch.result_updated_at ?? finalMatch.kickoff_at ?? new Date().toISOString(),
        type: "champions" as const
      }
    ];
  } catch (error) {
    console.warn("[notifications:champions]", error);
    return [];
  }
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
  const [manualNews, pointMatches, podiumPoints, champions, closingMatches, closedMatches, participants, hiddenIds] = await Promise.all([
    getNewsItems(limit, { includeExpired: options?.includeExpiredManual }),
    getPointMatchNotifications(limit),
    getPodiumPointNotifications(limit),
    getChampionsNotification(),
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
    ...podiumPoints,
    ...champions,
    ...closingMatches,
    ...closedMatches,
    ...participants
  ]
    .filter((item) => !hiddenIds.has(item.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
