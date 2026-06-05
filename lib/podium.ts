import { displayNameForTeam } from "@/lib/flags";
import type { Match } from "@/lib/types";

export const PODIUM_POINTS = {
  champion: 3,
  runnerUp: 2,
  thirdPlace: 1
} as const;

type PodiumPrediction = {
  champion_team?: string | null;
  runner_up_team?: string | null;
  third_place_team?: string | null;
};

type ActualPodium = {
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
};

function normalizeTeam(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function sameTeam(left?: string | null, right?: string | null) {
  const a = normalizeTeam(left);
  const b = normalizeTeam(right);
  if (!a || !b) return false;
  return a === b || normalizeTeam(displayNameForTeam(left ?? "")) === b || a === normalizeTeam(displayNameForTeam(right ?? ""));
}

function matchWinner(match: Pick<Match, "home_team" | "away_team" | "home_goals" | "away_goals" | "penalty_winner">) {
  if (match.home_goals == null || match.away_goals == null) return null;
  if (match.home_goals > match.away_goals) return match.home_team;
  if (match.away_goals > match.home_goals) return match.away_team;
  if (match.penalty_winner === "HOME" || sameTeam(match.penalty_winner, match.home_team)) return match.home_team;
  if (match.penalty_winner === "AWAY" || sameTeam(match.penalty_winner, match.away_team)) return match.away_team;
  return null;
}

function matchLoser(match: Pick<Match, "home_team" | "away_team" | "home_goals" | "away_goals" | "penalty_winner">) {
  const winner = matchWinner(match);
  if (!winner) return null;
  return sameTeam(winner, match.home_team) ? match.away_team : match.home_team;
}

export function resolveActualPodium(matches: Match[]): ActualPodium {
  const final = matches.find((match) => match.stage === "FINAL");
  const thirdPlace = matches.find((match) => match.stage === "THIRD_PLACE");

  return {
    champion: final ? matchWinner(final) : null,
    runnerUp: final ? matchLoser(final) : null,
    thirdPlace: thirdPlace ? matchWinner(thirdPlace) : null
  };
}

export function scorePodiumPrediction(prediction: PodiumPrediction, actual: ActualPodium) {
  let championPoints = 0;
  let runnerUpPoints = 0;
  let thirdPlacePoints = 0;

  if (actual.champion && sameTeam(prediction.champion_team, actual.champion)) championPoints = PODIUM_POINTS.champion;
  if (actual.runnerUp && sameTeam(prediction.runner_up_team, actual.runnerUp)) runnerUpPoints = PODIUM_POINTS.runnerUp;
  if (actual.thirdPlace && sameTeam(prediction.third_place_team, actual.thirdPlace)) thirdPlacePoints = PODIUM_POINTS.thirdPlace;

  return {
    championPoints,
    runnerUpPoints,
    thirdPlacePoints,
    points: championPoints + runnerUpPoints + thirdPlacePoints
  };
}

export function validatePodiumTeams(championTeam?: string | null, runnerUpTeam?: string | null, thirdPlaceTeam?: string | null) {
  const chosen = [championTeam, runnerUpTeam, thirdPlaceTeam].filter(Boolean).map((team) => normalizeTeam(team));
  return new Set(chosen).size === chosen.length;
}

export async function recalculateAllPodiumPoints(db: any) {
  const [{ data: matches, error: matchesError }, { data: predictions, error: predictionsError }] = await Promise.all([
    db.from("matches").select("home_team,away_team,home_goals,away_goals,penalty_winner,stage"),
    db.from("podium_predictions").select("user_id,champion_team,runner_up_team,third_place_team")
  ]);

  if (matchesError) throw matchesError;
  if (predictionsError) throw predictionsError;

  const actual = resolveActualPodium((matches ?? []) as Match[]);
  let updated = 0;

  for (const prediction of predictions ?? []) {
    const score = scorePodiumPrediction(prediction, actual);
    const { error } = await db
      .from("podium_predictions")
      .update({
        champion_points: score.championPoints,
        runner_up_points: score.runnerUpPoints,
        third_place_points: score.thirdPlacePoints,
        points: score.points
      })
      .eq("user_id", prediction.user_id);
    if (error) throw error;
    updated += 1;
  }

  return { actual, updated };
}
