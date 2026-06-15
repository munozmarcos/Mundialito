import { ScoringSimulator } from "@/components/scoring-simulator";
import { getMatches } from "@/lib/data";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import type { Match, PodiumPrediction, Prediction, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

async function fetchAllPredictions(db: ReturnType<typeof supabaseAdmin>) {
  const pageSize = 1000;
  const rows: Prediction[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await db.from("predictions").select("*, profiles(display_name)").range(from, to);
    if (error) throw error;
    rows.push(...((data ?? []) as Prediction[]));
    if ((data?.length ?? 0) < pageSize) break;
  }

  return rows;
}

export default async function SimulatorPage() {
  const matches = (await getMatches()) as Match[];
  let predictions: Prediction[] = [];
  let profiles: Profile[] = [];
  let podiumPredictions: PodiumPrediction[] = [];

  if (supabaseConfigured()) {
    const db = supabaseAdmin();
    const [predictionRes, profileRes, podiumRes] = await Promise.all([
      fetchAllPredictions(db),
      db.from("profiles").select("id,auth_email,display_name,role,phone,paid").order("display_name"),
      db.from("podium_predictions").select("*")
    ]);
    predictions = predictionRes;
    profiles = (profileRes.data ?? []) as Profile[];
    podiumPredictions = (podiumRes.data ?? []) as PodiumPrediction[];
  }

  return <ScoringSimulator matches={matches} predictions={predictions} profiles={profiles} podiumPredictions={podiumPredictions} />;
}
