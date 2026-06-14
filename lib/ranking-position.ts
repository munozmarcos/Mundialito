export function competitionRankForIndex<T>(rows: T[], index: number, score: (row: T) => number) {
  if (index <= 0) return 1;
  const currentScore = score(rows[index]);
  const previousScore = score(rows[index - 1]);
  if (currentScore === previousScore) {
    return competitionRankForIndex(rows, index - 1, score);
  }
  return index + 1;
}

export function competitionRankMap<T>(rows: T[], key: (row: T) => string, score: (row: T) => number) {
  return new Map(rows.map((row, index) => [key(row), competitionRankForIndex(rows, index, score)]));
}

export function rankingPrefix(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}
