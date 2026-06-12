import { scorePrediction } from "@/lib/scoring";
import { recalculateAllPodiumPoints } from "@/lib/podium";
import { supabaseAdmin } from "@/lib/supabase";

export async function recalculateMatch(matchId: string) {
  const db = supabaseAdmin();
  const { data: match, error: matchError } = await db.from("matches").select("*").eq("id", matchId).single();
  if (matchError) throw matchError;

  const { data: predictions, error: predictionsError } = await db
    .from("predictions")
    .select("*")
    .eq("match_id", matchId);
  if (predictionsError) throw predictionsError;

  for (const prediction of predictions ?? []) {
    if (prediction.home_goals == null || prediction.away_goals == null) {
      await db
        .from("predictions")
        .update({
          points: 0,
          trend_hit: false,
          exact_hit: false,
          score_details: ["missing-score"]
        })
        .eq("id", prediction.id);
      continue;
    }

    const result = scorePrediction({
      stage: match.stage,
      predictedHomeGoals: prediction.home_goals,
      predictedAwayGoals: prediction.away_goals,
      actualHomeGoals: match.home_goals,
      actualAwayGoals: match.away_goals,
      predictedPenaltyWinner: prediction.penalty_winner,
      actualPenaltyWinner: match.penalty_winner
    });

    await db
      .from("predictions")
      .update({
        points: result.points,
        trend_hit: result.trendHit,
        exact_hit: result.exactHit,
        score_details: result.details
      })
      .eq("id", prediction.id);
  }

  if (match.stage === "FINAL" || match.stage === "THIRD_PLACE") {
    await recalculateAllPodiumPoints(db);
  }
}

export async function recalculateAllMatches() {
  const db = supabaseAdmin();
  const { error: incompleteError } = await db
    .from("predictions")
    .update({
      points: 0,
      trend_hit: false,
      exact_hit: false,
      score_details: ["missing-score"]
    })
    .or("home_goals.is.null,away_goals.is.null");
  if (incompleteError) throw incompleteError;

  const { data: matches, error: matchesError } = await db.from("matches").select("id");
  if (matchesError) throw matchesError;

  let recalculated = 0;
  for (const match of matches ?? []) {
    await recalculateMatch(match.id);
    recalculated += 1;
  }
  await recalculateAllPodiumPoints(db);

  return {
    matches: recalculated,
    incompletePredictionsReset: true,
    podiumRecalculated: true
  };
}
