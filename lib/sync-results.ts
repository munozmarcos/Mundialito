import { recalculateMatch } from "@/lib/recalculate";
import { recalculateAllPodiumPoints } from "@/lib/podium";
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

  const { data: matches, error } = await db.from("matches").select("*");
  if (error) throw error;

  let updated = 0;
  let liveInitialized = 0;
  const unmatched: ProviderResult[] = [];
  const matchedLocalIds = new Set<string>();

  for (const result of providerResults) {
    const local = findLocalMatch(matches ?? [], result);
    if (!local) {
      unmatched.push(result);
      continue;
    }
    matchedLocalIds.add(local.id);

    const reversed = teamsMatch(local.home_team, result.awayTeam) && teamsMatch(local.away_team, result.homeTeam);
    const homeGoals = reversed ? result.awayGoals : result.homeGoals;
    const awayGoals = reversed ? result.homeGoals : result.awayGoals;
    const penaltyWinner = result.penaltyWinner ?? null;

    const sameResult =
      local.home_goals === homeGoals &&
      local.away_goals === awayGoals &&
      (local.penalty_winner ?? null) === penaltyWinner &&
      local.status === result.status &&
      String(local.provider_match_id ?? "") === String(result.providerMatchId ?? "");

    if (sameResult && result.status === "playing") {
      const { error: heartbeatError } = await db
        .from("matches")
        .update({ result_updated_at: new Date().toISOString() })
        .eq("id", local.id);
      if (heartbeatError) throw heartbeatError;
      updated += 1;
      continue;
    }

    if (sameResult) {
      continue;
    }

    const { error: updateError } = await db
      .from("matches")
      .update({
        home_goals: homeGoals,
        away_goals: awayGoals,
        penalty_winner: penaltyWinner,
        locked: true,
        status: result.status,
        provider_match_id: result.providerMatchId,
        result_updated_at: new Date().toISOString()
      })
      .eq("id", local.id);

    if (updateError) throw updateError;
    await recalculateMatch(local.id);
    updated += 1;
  }

  const now = Date.now();
  for (const match of matches ?? []) {
    if (matchedLocalIds.has(match.id)) continue;
    if (match.status === "locked" || match.status === "scheduled") continue;
    if (match.home_goals != null || match.away_goals != null) continue;

    const kickoff = new Date(match.kickoff_at).getTime();
    const inLiveWindow = now >= kickoff && now <= kickoff + 150 * 60 * 1000;
    if (!inLiveWindow) continue;

    const { error: updateError } = await db
      .from("matches")
      .update({
        home_goals: 0,
        away_goals: 0,
        locked: true,
        status: "playing",
        result_updated_at: new Date().toISOString()
      })
      .eq("id", match.id);

    if (updateError) throw updateError;
    await recalculateMatch(match.id);
    updated += 1;
    liveInitialized += 1;
  }

  if (updated > 0) await recalculateAllPodiumPoints(db);

  return {
    mode: "real",
    fetched: providerResults.length,
    updated,
    liveInitialized,
    unmatched: unmatched.map((item) => `${item.homeTeam} vs ${item.awayTeam}`)
  };
}
