import type { MatchStage } from "@/lib/types";

export type ScoreInput = {
  stage: MatchStage;
  predictedHomeGoals: number | null | undefined;
  predictedAwayGoals: number | null | undefined;
  actualHomeGoals: number | null | undefined;
  actualAwayGoals: number | null | undefined;
  predictedPenaltyWinner?: string | null;
  actualPenaltyWinner?: string | null;
};

export type ScoreResult = {
  points: number;
  trendHit: boolean;
  exactHit: boolean;
  details: string[];
};

type Trend = "HOME" | "AWAY" | "DRAW";

function trend(home: number, away: number): Trend {
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

function hasScore(home: unknown, away: unknown) {
  return typeof home === "number" && Number.isFinite(home) && typeof away === "number" && Number.isFinite(away);
}

export function isGroupStage(stage: MatchStage) {
  return stage === "GROUP";
}

export function scorePrediction(input: ScoreInput): ScoreResult {
  const details: string[] = [];
  const { predictedHomeGoals: ph, predictedAwayGoals: pa, actualHomeGoals: ah, actualAwayGoals: aa } = input;

  if (!hasScore(ph, pa) || !hasScore(ah, aa)) {
    return { points: 0, trendHit: false, exactHit: false, details: ["missing-score"] };
  }

  const predictedHome = ph as number;
  const predictedAway = pa as number;
  const actualHome = ah as number;
  const actualAway = aa as number;

  const trendHit = trend(predictedHome, predictedAway) === trend(actualHome, actualAway);
  const exactHit = predictedHome === actualHome && predictedAway === actualAway;
  let points = 0;
  const prefix = isGroupStage(input.stage) ? "group" : "knockout";

  if (trendHit) {
    points += 1;
    details.push(`${prefix}-trend`);
  }

  if (trendHit && exactHit) {
    points += 2;
    details.push(`${prefix}-exact`);
  }

  return { points, trendHit, exactHit, details };
}

export function scoreKnockoutResult(input: ScoreInput): ScoreResult {
  return scorePrediction(input);
}

export function isPredictionLocked(kickoffAt: string | Date, locked: boolean, now = new Date()) {
  if (locked) return true;
  const kickoff = new Date(kickoffAt).getTime();
  return kickoff - now.getTime() <= 15 * 60 * 1000;
}

export function matchStatus(kickoffAt: string | Date, locked: boolean, hasResult: boolean, now = new Date()) {
  if (hasResult) return "final";
  if (isPredictionLocked(kickoffAt, locked, now)) return "locked";
  const msToKickoff = new Date(kickoffAt).getTime() - now.getTime();
  if (msToKickoff <= 4 * 60 * 60 * 1000) return "closing_soon";
  return "open";
}
