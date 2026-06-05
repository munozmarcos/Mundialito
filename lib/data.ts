import { demoMatches, demoRanking } from "@/lib/demo-data";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";

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
  if (!supabaseConfigured()) return demoRanking;

  try {
    const db = supabaseAdmin();
    const [{ data, error }, { data: podiumRows, error: podiumError }] = await Promise.all([
      db.rpc("ranking"),
      db.from("podium_predictions").select("user_id,champion_points,runner_up_points,third_place_points,points")
    ]);
    if (error) throw error;
    if (podiumError) throw podiumError;
    const podiumByUser = new Map((podiumRows ?? []).map((row) => [row.user_id, row]));
    return ((data ?? []) as RankingRow[])
      .map((row) => {
        const podium = podiumByUser.get(row.user_id);
        return {
          ...row,
          podium_points: podium?.points ?? row.podium_points ?? 0,
          podium_champion_points: podium?.champion_points ?? 0,
          podium_runner_up_points: podium?.runner_up_points ?? 0,
          podium_third_place_points: podium?.third_place_points ?? 0
        };
      })
      .sort((a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits || b.trend_hits - a.trend_hits || a.display_name.localeCompare(b.display_name));
  } catch (error) {
    console.warn("[demo:fallback] ranking", error);
    return demoRanking;
  }
}

export async function getRankingDetails(): Promise<RankingDetails> {
  if (!supabaseConfigured()) return { predictions: [], podium: [] };

  try {
    const db = supabaseAdmin();
    const [{ data: predictions, error: predictionError }, { data: podium, error: podiumError }] = await Promise.all([
      db
        .from("predictions")
        .select("id,user_id,points,exact_hit,trend_hit,home_goals,away_goals,penalty_winner,updated_at,matches(id,home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name,home_goals,away_goals,penalty_winner)")
        .gt("points", 0)
        .order("updated_at", { ascending: false }),
      db
        .from("podium_predictions")
        .select("user_id,champion_team,runner_up_team,third_place_team,champion_points,runner_up_points,third_place_points,points,updated_at")
        .gt("points", 0)
    ]);
    if (predictionError) throw predictionError;
    if (podiumError) throw podiumError;
    return {
      predictions: (predictions ?? []) as unknown as RankingPredictionDetail[],
      podium: (podium ?? []) as RankingPodiumDetail[]
    };
  } catch (error) {
    console.warn("[ranking-details:fallback]", error);
    return { predictions: [], podium: [] };
  }
}

export async function getRecentActivity(limit = 6): Promise<ActivityRow[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("predictions")
      .select("id,points,exact_hit,trend_hit,updated_at,profiles(display_name),matches(home_team,away_team,home_goals,away_goals)")
      .gt("points", 0)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as ActivityRow[];
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

export async function getNewsItems(limit = 5): Promise<NewsItem[]> {
  if (!supabaseConfigured()) return [];

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("news_items")
      .select("id,title,body,published,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
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
