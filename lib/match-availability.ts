type MatchAvailabilityInput = {
  stage: string;
  status?: string | null;
  home_team?: string | null;
  away_team?: string | null;
};

const placeholderPatterns = [
  /^por definir$/i,
  /^tbd$/i,
  /^to be determined$/i,
  /^([123])([A-L])$/i,
  /^3[A-L](?:\/[A-L])+$/i,
  /^(?:ganador|winner|w)\s*(?:match|partido)?\s*#?\d+$/i,
  /^(?:perdedor|loser|l)\s*(?:match|partido)?\s*#?\d+$/i,
  /^(?:winner|ganador)\s+group\s+[A-L]$/i,
  /^(?:runner-up|second|2nd)\s+group\s+[A-L]$/i,
  /^(?:third|3rd)\s+group\s+[A-L]$/i,
  /^(?:1st|first)\s+group\s+[A-L]$/i,
  /^match\s*#?\d+\s*(?:winner|loser)$/i
];

export function isPlaceholderTeamName(team: string | null | undefined) {
  const clean = (team ?? "").trim();
  if (!clean) return true;
  return placeholderPatterns.some((pattern) => pattern.test(clean));
}

export function isOfficialKnockoutMatchReady(match: MatchAvailabilityInput) {
  if (match.stage === "GROUP") return true;
  return !isPlaceholderTeamName(match.home_team) && !isPlaceholderTeamName(match.away_team);
}

export function isMatchBlockedUntilOfficial(match: MatchAvailabilityInput) {
  if (match.status === "locked" || match.status === "scheduled") return true;
  return match.stage !== "GROUP" && !isOfficialKnockoutMatchReady(match);
}
