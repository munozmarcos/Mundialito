import { ScoringSimulator } from "@/components/scoring-simulator";
import { getMatches } from "@/lib/data";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import type { Match, Prediction, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SimulatorPage() {
  const matches = (await getMatches()) as Match[];
  let predictions: Prediction[] = [];
  let profiles: Profile[] = [];

  if (supabaseConfigured()) {
    const db = supabaseAdmin();
    const [predictionRes, profileRes] = await Promise.all([
      db.from("predictions").select("*, profiles(display_name)"),
      db.from("profiles").select("id,auth_email,display_name,role,phone,paid").order("display_name")
    ]);
    predictions = (predictionRes.data ?? []) as Prediction[];
    profiles = (profileRes.data ?? []) as Profile[];
  }

  return <ScoringSimulator matches={matches} predictions={predictions} profiles={profiles} />;
}
