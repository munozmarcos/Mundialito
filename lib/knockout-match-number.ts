import { knockoutPlaceholders } from "@/data/knockout-placeholders";
import type { Match } from "@/lib/types";

function kickoffClose(a: string, b: string) {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= 2 * 60 * 60 * 1000;
}

export function knockoutMatchNumber(match: Pick<Match, "provider_match_id" | "stage" | "kickoff_at">) {
  const source = match.provider_match_id ?? "";
  const fromProvider = source.match(/fifa-(\d+)/i);
  if (fromProvider) return Number(fromProvider[1]);

  return knockoutPlaceholders.find((fixture) => fixture.stage === match.stage && kickoffClose(match.kickoff_at, fixture.kickoffAt))?.matchNumber ?? null;
}
