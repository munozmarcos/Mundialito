import { recalculateMatch } from "@/lib/recalculate";
import { fetchProviderResults, teamsMatch, type ProviderResult } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

function findLocalMatch(matches: any[], result: ProviderResult) {
  return matches.find((match) => {
    const direct = teamsMatch(match.home_team, result.homeTeam) && teamsMatch(match.away_team, result.awayTeam);
    const reverse = teamsMatch(match.home_team, result.awayTeam) && teamsMatch(match.away_team, result.homeTeam);
    return direct || reverse;
  });
}

export async function syncResultsFromProvider() {
  if (!supabaseAdminConfigured()) {
    return {
      mode: "not-configured",
      fetched: 0,
      updated: 0,
      message: "Configura Supabase para guardar resultados reales."
    };
  }

  const db = supabaseAdmin();
  const providerResults = await fetchProviderResults();
  const { data: matches, error } = await db.from("matches").select("*").neq("status", "final");
  if (error) throw error;

  let updated = 0;
  const unmatched: ProviderResult[] = [];

  for (const result of providerResults) {
    const local = findLocalMatch(matches ?? [], result);
    if (!local) {
      unmatched.push(result);
      continue;
    }

    const reversed = teamsMatch(local.home_team, result.awayTeam) && teamsMatch(local.away_team, result.homeTeam);
    const homeGoals = reversed ? result.awayGoals : result.homeGoals;
    const awayGoals = reversed ? result.homeGoals : result.awayGoals;

    const { error: updateError } = await db
      .from("matches")
      .update({
        home_goals: homeGoals,
        away_goals: awayGoals,
        penalty_winner: result.penaltyWinner,
        locked: true,
        status: "final",
        provider_match_id: result.providerMatchId
      })
      .eq("id", local.id);

    if (updateError) throw updateError;
    await recalculateMatch(local.id);
    updated += 1;
  }

  return {
    mode: "real",
    fetched: providerResults.length,
    updated,
    unmatched: unmatched.map((item) => `${item.homeTeam} vs ${item.awayTeam}`)
  };
}

