import { displayNameForTeam } from "@/lib/flags";
import { isPlaceholderTeamName } from "@/lib/match-availability";
import type { Match } from "@/lib/types";

export type TeamOption = {
  name: string;
  code?: string | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function teamOptionsFromMatches(matches: Match[]) {
  const options = new Map<string, TeamOption>();

  for (const match of matches) {
    [
      { name: match.home_team, code: match.home_country_code },
      { name: match.away_team, code: match.away_country_code }
    ].forEach((team) => {
      if (isPlaceholderTeamName(team.name)) return;
      const display = displayNameForTeam(team.name);
      const key = normalize(display);
      if (!key || options.has(key)) return;
      options.set(key, { name: display, code: team.code });
    });
  }

  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
