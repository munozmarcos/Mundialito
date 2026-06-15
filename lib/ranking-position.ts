import { ICONS } from "@/lib/message-icons";

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

export function competitionRankMap<T>(rows: T[], key: (row: T) => string, score: (row: T) => number) {
  return new Map(rows.map((row, index) => [key(row), competitionRankForIndex(rows, index, score)]));
}

export function rankingPrefix(rank: number) {
  if (rank === 1) return ICONS.first;
  if (rank === 2) return ICONS.second;
  if (rank === 3) return ICONS.third;
  return `${rank}.`;
}
