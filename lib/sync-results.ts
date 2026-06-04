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
  let providerResults: ProviderResult[] = [];
  let providerError: string | null = null;

  try {
    providerResults = await fetchProviderResults();
  } catch (error) {
    providerError = error instanceof Error ? error.message : "No se pudo consultar el proveedor de resultados.";
  }

  if (providerError) {
    return {
      mode: "provider-error",
      fetched: 0,
      updated: 0,
      unmatched: [],
      providerError
    };
  }

  const { data: matches, error } = await db.from("matches").select("*").neq("status", "closed");
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
        status: "closed",
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
