import { displayNameForTeam } from "@/lib/flags";
import { argentinaDateKey } from "@/lib/dates";
import type { Match } from "@/lib/types";

export function normalizeFilter(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function dateKey(value: string) {
  return argentinaDateKey(value);
}

function teamSearchValues(name: string, code?: string | null) {
  return [name, displayNameForTeam(name), code ?? ""].map(normalizeFilter).filter(Boolean);
}

export function teamMatchesFilter(match: Match, teamFilter: string) {
  const team = normalizeFilter(teamFilter);
  if (!team) return true;
  return [
    ...teamSearchValues(match.home_team, match.home_country_code),
    ...teamSearchValues(match.away_team, match.away_country_code)
  ].some((value) => value.includes(team));
}

export function matchFitsBasicFilters(match: Match, teamFilter: string, dateFilter: string) {
  const dateOk = !dateFilter || dateKey(match.kickoff_at) === dateFilter;
  return dateOk && teamMatchesFilter(match, teamFilter);
}

export function matchFitsGroupFilters(match: Match, teamFilter: string, dateFilter: string, groupFilter: string) {
  const groupOk = groupFilter === "ALL" || match.group_name === groupFilter;
  return groupOk && matchFitsBasicFilters(match, teamFilter, dateFilter);
}
