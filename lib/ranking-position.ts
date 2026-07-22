import { ICONS } from "@/lib/message-icons";

export type RankingTieBreakRow = {
  total_points: number;
  exact_hits: number;
  trend_hits: number;
  podium_champion_points?: number;
  podium_runner_up_points?: number;
  podium_third_place_points?: number;
};

export function podiumHitCount(row: Pick<RankingTieBreakRow, "podium_champion_points" | "podium_runner_up_points" | "podium_third_place_points">) {
  return [row.podium_champion_points, row.podium_runner_up_points, row.podium_third_place_points].filter((points) => (points ?? 0) > 0).length;
}

export function rankingTieBreakValue(row: RankingTieBreakRow) {
  const exacts = row.exact_hits + podiumHitCount(row);
  return {
    points: row.total_points,
    hits: exacts + row.trend_hits,
    exacts
  };
}

export function compareRankingRows<T extends RankingTieBreakRow & { display_name?: string }>(a: T, b: T) {
  const aTie = rankingTieBreakValue(a);
  const bTie = rankingTieBreakValue(b);
  return (
    bTie.points - aTie.points ||
    bTie.hits - aTie.hits ||
    bTie.exacts - aTie.exacts ||
    (a.display_name ?? "").localeCompare(b.display_name ?? "", "es")
  );
}

export function competitionRankForIndex<T>(rows: T[], index: number, score: (row: T) => number) {
  if (index <= 0) return 1;
  let rank = 1;
  let previousScore = score(rows[0]);
  for (let currentIndex = 1; currentIndex <= index; currentIndex += 1) {
    const currentScore = score(rows[currentIndex]);
    if (currentScore !== previousScore) {
      rank += 1;
      previousScore = currentScore;
    }
  }
  return rank;
}

export function sameRankingPosition(a: RankingTieBreakRow, b: RankingTieBreakRow) {
  const left = rankingTieBreakValue(a);
  const right = rankingTieBreakValue(b);
  return left.points === right.points && left.hits === right.hits && left.exacts === right.exacts;
}

export function rankingRankForIndex<T extends RankingTieBreakRow>(rows: T[], index: number) {
  if (index <= 0) return 1;
  let rank = 1;
  for (let currentIndex = 1; currentIndex <= index; currentIndex += 1) {
    if (!sameRankingPosition(rows[currentIndex], rows[currentIndex - 1])) rank += 1;
  }
  return rank;
}

export function rankingRankMap<T extends RankingTieBreakRow>(rows: T[], key: (row: T) => string) {
  return new Map(rows.map((row, index) => [key(row), rankingRankForIndex(rows, index)]));
}

export function competitionRankMap<T>(rows: T[], key: (row: T) => string, score: (row: T) => number) {
  return new Map(rows.map((row, index) => [key(row), competitionRankForIndex(rows, index, score)]));
}

export function rankingPrefix(rank: number) {
  if (rank === 1) return ICONS.first;
  if (rank === 2) return ICONS.second;
  if (rank === 3) return ICONS.third;
  return `${rank}.`;
}
