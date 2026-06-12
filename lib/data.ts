import { demoMatches, demoRanking } from "@/lib/demo-data";
import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { fetchAllSupabaseRows } from "@/lib/supabase-pagination";
import { unstable_noStore as noStore } from "next/cache";

export type RankingRow = {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_hits: number;
  trend_hits: number;
  podium_points?: number;
  podium_champion_points?: number;
  podium_runner_up_points?: number;
  podium_third_place_points?: number;
};

export type RankingPredictionDetail = {
  id: string;
  user_id: string;
  points: number;
  exact_hit: boolean;
  trend_hit: boolean;
  home_goals: number;
  away_goals: number;
  penalty_winner?: string | null;
  updated_at?: string | null;
  user_updated_at?: string | null;
  matches?: {
    id: string;
    home_team: string;
    away_team: string;
    home_country_code?: string | null;
    away_country_code?: string | null;
    kickoff_at: string;
    stage: string;
    group_name?: string | null;
    home_goals?: number | null;
    away_goals?: number | null;
    penalty_winner?: string | null;
  } | {
    id: string;
    home_team: string;
    away_team: string;
    home_country_code?: string | null;
    away_country_code?: string | null;
    kickoff_at: string;
    stage: string;
    group_name?: string | null;
    home_goals?: number | null;
    away_goals?: number | null;
    penalty_winner?: string | null;
  }[] | null;
};

export type RankingPodiumDetail = {
  user_id: string;
  champion_team?: string | null;
  runner_up_team?: string | null;
  third_place_team?: string | null;
  champion_points: number;
  runner_up_points: number;
  third_place_points: number;
  points: number;
  updated_at?: string | null;
};

export type RankingDetails = {
  predictions: RankingPredictionDetail[];
  podium: RankingPodiumDetail[];
  summaries: RankingUserSummary[];
};

export type RankingUserSummary = {
  user_id: string;
  loaded_predictions: number;
  available_predictions: number;
  podium_loaded: number;
};

export type ActivityRow = {
  id: string;
  points: number;
  exact_hit: boolean;
  trend_hit: boolean;
  updated_at?: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
  matches?: { home_team: string; away_team: string; home_goals: number | null; away_goals: number | null } | { home_team: string; away_team: string; home_goals: number | null; away_goals: number | null }[] | null;
};

export type PaymentSummary = {
  totalParticipants: number;
  paidParticipants: number;
  unpaidParticipants: number;
  totalCollected: number;
  missionFund: number;
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
};

export type ParticipantPaymentRow = {
  id: string;
  display_name: string;
  paid: boolean;
  role: "admin" | "participant";
};

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
};

export type AutomaticNewsItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  source: "automatic";
};

export async function getMatches() {
  if (!supabaseConfigured()) return demoMatches;

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("matches").select("*").order("kickoff_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.warn("[demo:fallback] matches", error);
    return demoMatches;
  }
}

export async function getUpcomingMatches(limit = 8) {
  const matches = await getMatches();
  return matches.slice(0, limit);
}

export async function getRanking(): Promise<RankingRow[]> {
  noStore();
  if (!supabaseConfigured()) return demoRanking;

  try {
    const db = supabaseAdmin();
    const [
      { data: profiles, error: profilesError },
      predictions,
      { data: podiumRows, error: podiumError }
    ] = await Promise.all([
      db.from("profiles").select("id,display_name"),
      fetchAllSupabaseRows<any>((from, to) =>
        db
          .from("predictions")
          .select("user_id,points,exact_hit,trend_hit,home_goals,away_goals,matches(home_goals,away_goals)")
          .not("home_goals", "is", null)
          .not("away_goals", "is", null)
          .range(from, to)
      ),
      db.from("podium_predictions").select("user_id,champion_points,runner_up_points,third_place_points,points")
    ]);
    if (profilesError) throw profilesError;
    if (podiumError) throw podiumError;

    const matchPointsByUser = new Map<string, { points: number; exacts: number; trends: number }>();
    for (const prediction of predictions) {
      const match = Array.isArray(prediction.matches) ? prediction.matches[0] : prediction.matches;
      if (!match || match.home_goals == null || match.away_goals == null) continue;
      const current = matchPointsByUser.get(prediction.user_id) ?? { points: 0, exacts: 0, trends: 0 };
      current.points += prediction.points ?? 0;
      if (prediction.exact_hit) current.exacts += 1;
      else if (prediction.trend_hit) current.trends += 1;
      matchPointsByUser.set(prediction.user_id, current);
    }

    const podiumByUser = new Map((podiumRows ?? []).map((row) => [row.user_id, row]));
    return (profiles ?? [])
      .map((profile) => {
        const matchPoints = matchPointsByUser.get(profile.id) ?? { points: 0, exacts: 0, trends: 0 };
        const podium = podiumByUser.get(profile.id);
        const podiumPoints = podium?.points ?? 0;
        return {
          user_id: profile.id,
          display_name: profile.display_name,
          total_points: matchPoints.points + podiumPoints,
          exact_hits: matchPoints.exacts,
          trend_hits: matchPoints.trends,
          podium_points: podiumPoints,
          podium_champion_points: podium?.champion_points ?? 0,
          podium_runner_up_points: podium?.runner_up_points ?? 0,
          podium_third_place_points: podium?.third_place_points ?? 0
        } satisfies RankingRow;
      })
      .sort((a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits || b.trend_hits - a.trend_hits || a.display_name.localeCompare(b.display_name));
  } catch (error) {
    console.warn("[demo:fallback] ranking", error);
    return demoRanking;
  }
}

export async function getRankingDetails(): Promise<RankingDetails> {
  noStore();
  if (!supabaseConfigured()) return { predictions: [], podium: [], summaries: [] };

  try {
    const db = supabaseAdmin();
    const [
      predictions,
      { data: podium, error: podiumError },
      allPredictions,
      { data: allPodiums, error: allPodiumsError },
      { data: matches, error: matchesError },
      { data: profiles, error: profilesError }
    ] = await Promise.all([
      fetchAllSupabaseRows<any>((from, to) =>
        db
          .from("predictions")
          .select("id,user_id,points,exact_hit,trend_hit,home_goals,away_goals,penalty_winner,updated_at,matches(id,home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name,home_goals,away_goals,penalty_winner)")
          .not("home_goals", "is", null)
          .not("away_goals", "is", null)
          .gt("points", 0)
          .order("updated_at", { ascending: false })
          .range(from, to)
      ),
      db
        .from("podium_predictions")
        .select("user_id,champion_team,runner_up_team,third_place_team,champion_points,runner_up_points,third_place_points,points,updated_at")
        .gt("points", 0),
      fetchAllSupabaseRows<any>((from, to) =>
        db.from("predictions").select("user_id,match_id,home_goals,away_goals").not("home_goals", "is", null).not("away_goals", "is", null).range(from, to)
      ),
      db.from("podium_predictions").select("user_id,champion_team,runner_up_team,third_place_team"),
      db.from("matches").select("id,home_team,away_team,kickoff_at,stage,status,locked"),
      db.from("profiles").select("id")
    ]);
    if (podiumError) throw podiumError;
    if (allPodiumsError) throw allPodiumsError;
    if (matchesError) throw matchesError;
    if (profilesError) throw profilesError;

    const availableMatches = (matches ?? []).filter((match) => {
      if (match.status === "locked") return false;
      if (isMatchBlockedUntilOfficial({ stage: match.stage ?? "GROUP", status: match.status, home_team: match.home_team, away_team: match.away_team })) return false;
      return true;
    });
    const availableIds = new Set(availableMatches.map((match) => match.id));
    const summaryMap = new Map<string, RankingUserSummary>();
    for (const profile of profiles ?? []) {
      summaryMap.set(profile.id, { user_id: profile.id, loaded_predictions: 0, available_predictions: availableIds.size, podium_loaded: 0 });
    }
    for (const prediction of allPredictions) {
      const userId = prediction.user_id;
      if (!summaryMap.has(userId)) {
        summaryMap.set(userId, { user_id: userId, loaded_predictions: 0, available_predictions: availableIds.size, podium_loaded: 0 });
      }
      if (availableIds.has(prediction.match_id)) summaryMap.get(userId)!.loaded_predictions += 1;
    }
    for (const item of allPodiums ?? []) {
      const userId = item.user_id;
      if (!summaryMap.has(userId)) {
        summaryMap.set(userId, { user_id: userId, loaded_predictions: 0, available_predictions: availableIds.size, podium_loaded: 0 });
      }
      summaryMap.get(userId)!.podium_loaded = [item.champion_team, item.runner_up_team, item.third_place_team].filter(Boolean).length;
    }
    const validDetails = predictions.filter((prediction: any) => {
      const match = Array.isArray(prediction.matches) ? prediction.matches[0] : prediction.matches;
      return match?.home_goals != null && match?.away_goals != null;
    });

    return {
      predictions: validDetails as unknown as RankingPredictionDetail[],
      podium: (podium ?? []) as RankingPodiumDetail[],
      summaries: [...summaryMap.values()]
    };
  } catch (error) {
    console.warn("[ranking-details:fallback]", error);
    return { predictions: [], podium: [], summaries: [] };
  }
}

export async function getRecentActivity(limit = 6): Promise<ActivityRow[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("predictions")
      .select("id,points,exact_hit,trend_hit,updated_at,profiles(display_name),matches(home_team,away_team,home_goals,away_goals)")
      .not("home_goals", "is", null)
      .not("away_goals", "is", null)
      .gt("points", 0)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).filter((item: any) => {
      const match = Array.isArray(item.matches) ? item.matches[0] : item.matches;
      return match?.home_goals != null && match?.away_goals != null;
    }) as unknown as ActivityRow[];
  } catch (error) {
    console.warn("[activity:fallback]", error);
    return [];
  }
}

export async function getPaymentSummary(): Promise<PaymentSummary> {
  if (!supabaseConfigured()) {
    return {
      totalParticipants: 0,
      paidParticipants: 0,
      unpaidParticipants: 0,
      totalCollected: 0,
      missionFund: 0,
      prizePool: 0,
      firstPrize: 0,
      secondPrize: 0,
      thirdPrize: 0
    };
  }

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from("profiles").select("id,paid,role");
    if (error) throw error;
    const totalParticipants = data?.length ?? 0;
    const paidParticipants = (data ?? []).filter((profile) => Boolean(profile.paid)).length;
    const prizePool = paidParticipants * 10000;
    return {
      totalParticipants,
      paidParticipants,
      unpaidParticipants: totalParticipants - paidParticipants,
      totalCollected: paidParticipants * 15000,
      missionFund: paidParticipants * 5000,
      prizePool,
      firstPrize: Math.round(prizePool * 0.7),
      secondPrize: Math.round(prizePool * 0.2),
      thirdPrize: Math.round(prizePool * 0.1)
    };
  } catch (error) {
    console.warn("[payments:fallback]", error);
    return {
      totalParticipants: 0,
      paidParticipants: 0,
      unpaidParticipants: 0,
      totalCollected: 0,
      missionFund: 0,
      prizePool: 0,
      firstPrize: 0,
      secondPrize: 0,
      thirdPrize: 0
    };
  }
}

export async function getParticipantPayments(): Promise<ParticipantPaymentRow[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("profiles")
      .select("id,display_name,paid,role")
      .order("display_name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ParticipantPaymentRow[];
  } catch (error) {
    console.warn("[participants:fallback]", error);
    return [];
  }
}

export async function getNewsItems(limit = 5, options?: { includeExpired?: boolean }): Promise<NewsItem[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    let query = db
      .from("news_items")
      .select("id,title,body,published,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (!options?.includeExpired) {
      query = query.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    }
    const { data, error } = await query.limit(limit);
    if (error) throw error;
    return (data ?? []) as NewsItem[];
  } catch (error) {
    console.warn("[news:fallback]", error);
    return [];
  }
}

function automaticNewsTitle(jobPath: string) {
  const titles: Record<string, string> = {
    "/api/jobs/sync-fixtures": "🗓️ Fixture actualizado",
    "/api/jobs/sync-results": "🏁 Resultados actualizados",
    "/api/jobs/send-reminders": "📲 Recordatorios enviados",
    "/api/jobs/lock-matches": "🔒 Partidos cerrados",
    "/api/jobs/notify-kickoff": "⚽ Avisos de inicio",
    "/api/jobs/send-daily-ranking": "🏆 Ranking enviado"
  };
  return titles[jobPath] ?? "🤖 Novedad automática";
}

export async function getAutomaticNewsItems(limit = 5): Promise<AutomaticNewsItem[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("job_runs")
      .select("id,job_path,summary,created_at,ok,trigger_type")
      .eq("trigger_type", "automatic")
      .eq("ok", true)
      .not("summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((item) => ({
      id: item.id,
      title: automaticNewsTitle(item.job_path),
      body: item.summary ?? "La app ejecutó una actualización automática.",
      created_at: item.created_at,
      source: "automatic" as const
    }));
  } catch (error) {
    console.warn("[automatic-news:fallback]", error);
    return [];
  }
}

export function isDemoMode() {
  return !supabaseConfigured();
}
