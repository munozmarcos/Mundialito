import { demoMatches, demoRanking } from "@/lib/demo-data";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export type RankingRow = {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_hits: number;
  trend_hits: number;
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
    const { data, error } = await db.rpc("ranking");
    if (error) throw error;
    return (data ?? []) as RankingRow[];
  } catch (error) {
    console.warn("[demo:fallback] ranking", error);
    return demoRanking;
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

export function isDemoMode() {
  return !supabaseConfigured();
}
