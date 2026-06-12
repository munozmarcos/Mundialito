import { recalculateMatch } from "@/lib/recalculate";
import { recalculateAllPodiumPoints } from "@/lib/podium";
import { flagEmojiForTeam } from "@/lib/flags";
import { fetchProviderResultsDetailed, teamsMatch, type ProviderResult } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";

function resultTimeMatches(match: any, result: ProviderResult) {
  if (!result.playedAt) return true;
  const matchTime = new Date(match.kickoff_at).getTime();
  const resultTime = new Date(result.playedAt).getTime();
  if (!Number.isFinite(matchTime) || !Number.isFinite(resultTime)) return true;
  return Math.abs(matchTime - resultTime) <= 8 * 60 * 60 * 1000;
}

function findLocalMatch(matches: any[], result: ProviderResult) {
  const providerMatch = matches.find((match) => String(match.provider_match_id ?? "") === String(result.providerMatchId));
  if (providerMatch) return providerMatch;

  return matches.find((match) => {
    if (!resultTimeMatches(match, result)) return false;
    const direct = teamsMatch(match.home_team, result.homeTeam) && teamsMatch(match.away_team, result.awayTeam);
    const reverse = teamsMatch(match.home_team, result.awayTeam) && teamsMatch(match.away_team, result.homeTeam);
    return direct || reverse;
  });
}

async function shouldUseLiveProvider(db: ReturnType<typeof supabaseAdmin>, matches: any[]) {
  if ((process.env.LIVE_RESULTS_PROVIDER ?? process.env.RESULTS_PROVIDER) !== "api-football") return false;

  const now = Date.now();
  const hasLiveWindow = matches.some((match) => {
    if (match.status === "locked" || match.status === "scheduled") return false;
    const kickoff = new Date(match.kickoff_at).getTime();
    if (!Number.isFinite(kickoff)) return false;
    return now >= kickoff && now <= kickoff + 150 * 60 * 1000;
  });
  if (!hasLiveWindow) return false;

  const { data } = await db
    .from("job_runs")
    .select("created_at,payload")
    .eq("job_path", "/api/jobs/sync-results")
    .order("created_at", { ascending: false })
    .limit(10);

  const lastApiFootballRun = (data ?? []).find((run) => (run.payload as any)?.provider === "api-football");
  if (!lastApiFootballRun?.created_at) return true;
  return now - new Date(lastApiFootballRun.created_at).getTime() >= 9 * 60 * 1000;
}

async function notifyFinalResult(db: ReturnType<typeof supabaseAdmin>, match: any) {
  if (match.home_goals == null || match.away_goals == null) return { sent: 0, failures: [] as string[] };

  const { data: users, error: usersError } = await db
    .from("profiles")
    .select("id,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (usersError) throw usersError;

  let sent = 0;
  const failures: string[] = [];
  for (const user of users ?? []) {
    const dedupeKey = `${match.id}:${user.id}:result-final`;
    const { error: logError } = await db.from("notification_logs").insert({
      user_id: user.id,
      match_id: match.id,
      kind: "whatsapp-result-final",
      dedupe_key: dedupeKey
    });
    if (logError) continue;

    try {
      await sendWhatsApp(
        user.phone,
        [
          "🏁 *Partido cerrado*",
          "",
          `${flagEmojiForTeam(match.home_team, match.home_country_code)} ${match.home_team} *${match.home_goals}-${match.away_goals}* ${flagEmojiForTeam(match.away_team, match.away_country_code)} ${match.away_team}`,
          "",
          "🏆 El ranking ya fue actualizado.",
          "Responde *$ranking* para ver la tabla."
        ].join("\n")
      );
      sent += 1;
    } catch (error) {
      failures.push(`${user.display_name}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return { sent, failures };
}

export async function syncResultsFromProvider(options: { allowLiveProvider?: boolean } = {}) {
  if (!supabaseAdminConfigured()) {
    return {
      mode: "not-configured",
      fetched: 0,
      updated: 0,
      message: "Configura Supabase para guardar resultados reales."
    };
  }

  const db = supabaseAdmin();
  const { data: matches, error } = await db.from("matches").select("*");
  if (error) throw error;

  let providerResults: ProviderResult[] = [];
  let providerError: string | null = null;
  let provider = process.env.LIVE_RESULTS_PROVIDER ?? process.env.RESULTS_PROVIDER ?? "football-data";
  let providerWarning: string | null = null;

  try {
    const detailed = await fetchProviderResultsDetailed({
      allowLiveProvider: options.allowLiveProvider ?? (await shouldUseLiveProvider(db, matches ?? []))
    });
    providerResults = detailed.results;
    provider = detailed.provider;
    providerWarning = detailed.providerWarning ?? null;
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

  let updated = 0;
  let liveInitialized = 0;
  let resultNotifications = 0;
  const unmatched: ProviderResult[] = [];
  const notificationFailures: string[] = [];
  const matchedLocalIds = new Set<string>();

  for (const result of providerResults) {
    const local = findLocalMatch(matches ?? [], result);
    if (!local) {
      unmatched.push(result);
      continue;
    }
    matchedLocalIds.add(local.id);

    const reversed = teamsMatch(local.home_team, result.awayTeam) && teamsMatch(local.away_team, result.homeTeam);
    const providerHomeGoals = reversed ? result.awayGoals : result.homeGoals;
    const providerAwayGoals = reversed ? result.homeGoals : result.awayGoals;
    const homeGoals = providerHomeGoals ?? local.home_goals;
    const awayGoals = providerAwayGoals ?? local.away_goals;
    const penaltyWinner = result.penaltyWinner ?? null;

    if ((homeGoals == null || awayGoals == null) && result.statusOnly) {
      continue;
    }

    const sameResult =
      local.home_goals === homeGoals &&
      local.away_goals === awayGoals &&
      (local.penalty_winner ?? null) === penaltyWinner &&
      local.status === result.status;

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
        result_updated_at: new Date().toISOString()
      })
      .eq("id", local.id);

    if (updateError) throw updateError;
    await recalculateMatch(local.id);
    if (result.status === "closed") {
      const notification = await notifyFinalResult(db, {
        ...local,
        home_goals: homeGoals,
        away_goals: awayGoals,
        penalty_winner: penaltyWinner,
        status: "closed"
      });
      resultNotifications += notification.sent;
      notificationFailures.push(...notification.failures);
    }
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
    provider,
    providerWarning,
    fetched: providerResults.length,
    updated,
    liveInitialized,
    resultNotifications,
    notificationFailures,
    unmatched: unmatched.map((item) => `${item.homeTeam} vs ${item.awayTeam}`)
  };
}
