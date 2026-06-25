import { recalculateMatch } from "@/lib/recalculate";
import { recalculateAllPodiumPoints } from "@/lib/podium";
import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { fetchProviderResultsDetailed, teamsMatch, type ProviderResult } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";
import { sendWebPushToAll } from "@/lib/web-push";
import { hasWhatsAppGroup, sendWhatsAppGroup } from "@/lib/whatsapp";
import { ICONS } from "@/lib/message-icons";

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
  if (!process.env.API_FOOTBALL_KEY) return false;

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
    .in("job_path", ["/api/jobs/sync-results", "/api/live/pulse"])
    .order("created_at", { ascending: false })
    .limit(10);

  const lastApiFootballRun = (data ?? []).find((run) => (run.payload as any)?.provider === "api-football");
  if (!lastApiFootballRun?.created_at) return true;
  return now - new Date(lastApiFootballRun.created_at).getTime() >= 9 * 60 * 1000;
}

async function notifyFinalResult(db: ReturnType<typeof supabaseAdmin>, match: any) {
  if (match.home_goals == null || match.away_goals == null) return { sent: 0, pushSent: 0, pushFailed: 0, failures: [] as string[] };

  const homeName = displayNameForTeam(match.home_team);
  const awayName = displayNameForTeam(match.away_team);
  const label = `${flagEmojiForTeam(match.home_team, match.home_country_code)} ${homeName} ${match.home_goals}-${match.away_goals} ${flagEmojiForTeam(match.away_team, match.away_country_code)} ${awayName}`;

  const push = await sendWebPushToAll({
    dedupeKey: `result-final:${match.id}:${match.home_goals}-${match.away_goals}`,
    title: "Partido finalizado",
    body: `${homeName} ${match.home_goals}-${match.away_goals} ${awayName}`,
    url: "/ranking",
    tag: `result-final:${match.id}`
  });

  let whatsappSent = 0;
  const failures: string[] = [];
  if (hasWhatsAppGroup()) {
    const kind = "whatsapp-result-final-group";
    const dedupeKey = `group:result-final:${match.id}`;
    const { count } = await db.from("notification_logs").select("id", { count: "exact", head: true }).eq("kind", kind).eq("dedupe_key", dedupeKey);
    if ((count ?? 0) === 0) {
      try {
        await sendWhatsAppGroup([`${ICONS.checkeredFlag} *Partido finalizado*`, "", `*${label}*`, "", "El ranking ya fue actualizado."].join("\n"));
        await db.from("notification_logs").insert({ match_id: match.id, kind, dedupe_key: dedupeKey });
        whatsappSent = 1;
      } catch (error) {
        failures.push(`${homeName} vs ${awayName}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
  }

  return { sent: whatsappSent, pushSent: push.sent, pushFailed: push.failed, failures };
}

async function notifyLiveStart(db: ReturnType<typeof supabaseAdmin>, match: any) {
  const homeName = displayNameForTeam(match.home_team);
  const awayName = displayNameForTeam(match.away_team);
  const label = `${flagEmojiForTeam(match.home_team, match.home_country_code)} ${homeName} vs ${flagEmojiForTeam(match.away_team, match.away_country_code)} ${awayName}`;

  const push = await sendWebPushToAll({
    dedupeKey: `match-kickoff:${match.id}`,
    title: "Partido en vivo",
    body: `${homeName} vs ${awayName}`,
    url: "/partidos",
    tag: `match-kickoff:${match.id}`
  });

  let whatsappSent = 0;
  const failures: string[] = [];
  if (hasWhatsAppGroup()) {
    const kind = "whatsapp-match-kickoff-group";
    const dedupeKey = `group:match-kickoff:${match.id}`;
    const { count } = await db.from("notification_logs").select("id", { count: "exact", head: true }).eq("kind", kind).eq("dedupe_key", dedupeKey);
    if ((count ?? 0) === 0) {
      try {
        await sendWhatsAppGroup([`${ICONS.redCircle} *Partido en vivo*`, "", `*${label}*`, "", "El ranking se va actualizando con el resultado en vivo."].join("\n"));
        await db.from("notification_logs").insert({ match_id: match.id, kind, dedupe_key: dedupeKey });
        whatsappSent = 1;
      } catch (error) {
        failures.push(`${homeName} vs ${awayName}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
  }

  return { sent: whatsappSent, pushSent: push.sent, pushFailed: push.failed, failures };
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
  let kickoffNotifications = 0;
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
    const localIsFinal = local.status === "closed" && local.home_goals != null && local.away_goals != null;

    if (localIsFinal && result.status === "playing") {
      continue;
    }

    if ((providerHomeGoals == null || providerAwayGoals == null) && result.statusOnly) {
      if (result.status === "playing" && !localIsFinal) {
        const { error: updateError } = await db
          .from("matches")
          .update({
            home_goals: null,
            away_goals: null,
            penalty_winner: null,
            locked: true,
            status: "playing",
            result_updated_at: new Date().toISOString()
          })
          .eq("id", local.id);

        if (updateError) throw updateError;
        await recalculateMatch(local.id);
        if (local.status !== "playing") {
          const notification = await notifyLiveStart(db, {
            ...local,
            home_goals: null,
            away_goals: null,
            status: "playing"
          });
          kickoffNotifications += notification.pushSent;
          kickoffNotifications += notification.sent ?? 0;
          if (notification.pushFailed) notificationFailures.push(`${local.home_team} vs ${local.away_team}: ${notification.pushFailed} push fallidos`);
          notificationFailures.push(...(notification.failures ?? []));
        }
        updated += 1;
      }
      continue;
    }

    const sameResult =
      local.home_goals === homeGoals &&
      local.away_goals === awayGoals &&
      (local.penalty_winner ?? null) === penaltyWinner &&
      local.status === result.status;

    if (result.status === "closed" && local.status === "closed") {
      continue;
    }

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
    if (result.status === "playing" && local.status !== "playing" && !localIsFinal) {
      const notification = await notifyLiveStart(db, {
        ...local,
        home_goals: homeGoals,
        away_goals: awayGoals,
        status: "playing"
      });
      kickoffNotifications += notification.pushSent;
      kickoffNotifications += notification.sent ?? 0;
      if (notification.pushFailed) notificationFailures.push(`${local.home_team} vs ${local.away_team}: ${notification.pushFailed} push fallidos`);
      notificationFailures.push(...(notification.failures ?? []));
    }
    if (result.status === "closed" && local.status !== "closed") {
      const notification = await notifyFinalResult(db, {
        ...local,
        home_goals: homeGoals,
        away_goals: awayGoals,
        penalty_winner: penaltyWinner,
        status: "closed"
      });
      resultNotifications += notification.sent;
      resultNotifications += notification.pushSent ?? 0;
      notificationFailures.push(...notification.failures);
    }
    updated += 1;
  }

  const now = Date.now();
  for (const match of matches ?? []) {
    if (matchedLocalIds.has(match.id)) continue;
    if (match.status === "locked" || match.status === "scheduled") continue;
    if (match.status === "playing") continue;
    if (match.home_goals != null || match.away_goals != null) continue;

    const kickoff = new Date(match.kickoff_at).getTime();
    const inLiveWindow = now >= kickoff && now <= kickoff + 150 * 60 * 1000;
    if (!inLiveWindow) continue;

    const { error: updateError } = await db
      .from("matches")
      .update({
        locked: true,
        status: "playing",
        result_updated_at: new Date().toISOString()
      })
      .eq("id", match.id);

    if (updateError) throw updateError;
    await recalculateMatch(match.id);
    const notification = await notifyLiveStart(db, {
      ...match,
      home_goals: null,
      away_goals: null,
      status: "playing"
    });
    kickoffNotifications += notification.pushSent;
    kickoffNotifications += notification.sent ?? 0;
    if (notification.pushFailed) notificationFailures.push(`${match.home_team} vs ${match.away_team}: ${notification.pushFailed} push fallidos`);
    notificationFailures.push(...(notification.failures ?? []));
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
    kickoffNotifications,
    resultNotifications,
    notificationFailures,
    unmatched: unmatched.map((item) => `${item.homeTeam} vs ${item.awayTeam}`)
  };
}

