type MatchScore = {
  home_goals?: number | null;
  away_goals?: number | null;
  home_penalty_goals?: number | null;
  away_penalty_goals?: number | null;
};

export function formatMainScore(match: MatchScore) {
  if (match.home_goals == null || match.away_goals == null) return null;
  return `${match.home_goals}-${match.away_goals}`;
}

export function formatScoreWithPenalties(match: MatchScore) {
  const mainScore = formatMainScore(match);
  if (!mainScore) return null;
  if (match.home_penalty_goals != null && match.away_penalty_goals != null) {
    return `(${match.home_penalty_goals}) ${mainScore} (${match.away_penalty_goals})`;
  }
  return mainScore;
}

