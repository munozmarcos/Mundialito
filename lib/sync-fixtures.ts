import { knockoutPlaceholders } from "@/data/knockout-placeholders";
import { isOfficialKnockoutMatchReady, isPlaceholderTeamName } from "@/lib/match-availability";
import { fetchProviderFixtures, teamsMatch, type ProviderFixture } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

function kickoffClose(a: string, b: string) {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= 2 * 60 * 60 * 1000;
}

function sameFixture(match: any, fixture: ProviderFixture) {
  return (
    teamsMatch(match.home_team, fixture.homeTeam) &&
    teamsMatch(match.away_team, fixture.awayTeam) &&
    kickoffClose(match.kickoff_at, fixture.kickoffAt)
  );
}

function sameKnockoutSlot(match: any, fixture: Pick<ProviderFixture, "stage" | "kickoffAt">) {
  return match.stage === fixture.stage && fixture.stage !== "GROUP" && kickoffClose(match.kickoff_at, fixture.kickoffAt);
}

function isFixtureOfficialKnockout(fixture: ProviderFixture) {
  if (fixture.stage === "GROUP") return false;
  return isOfficialKnockoutMatchReady({
    stage: fixture.stage,
    status: "open",
    home_team: fixture.homeTeam,
    away_team: fixture.awayTeam
  });
}

function shouldOpenConfirmedFixture(existing: any, fixture: ProviderFixture) {
  if (!isFixtureOfficialKnockout(fixture)) return false;
  if (existing?.status === "closed" || existing?.status === "playing") return false;
  if (existing?.home_goals != null || existing?.away_goals != null) return false;
  return true;
}

async function upsertFixture(db: ReturnType<typeof supabaseAdmin>, fixture: ProviderFixture, matches: any[]) {
  const existing =
    matches.find((match) => String(match.provider_match_id ?? "") === String(fixture.providerMatchId)) ??
    matches.find((match) => sameFixture(match, fixture)) ??
    matches.find((match) => sameKnockoutSlot(match, fixture));

  const row = {
    provider_match_id: fixture.providerMatchId,
    home_team: fixture.homeTeam,
    away_team: fixture.awayTeam,
    home_country_code: fixture.homeCode,
    away_country_code: fixture.awayCode,
    kickoff_at: fixture.kickoffAt,
    stadium: fixture.stadium,
    stage: fixture.stage,
    group_name: fixture.groupName,
    status: shouldOpenConfirmedFixture(existing, fixture) ? "open" : existing?.status ?? "open",
    locked: shouldOpenConfirmedFixture(existing, fixture) ? false : existing?.locked ?? false
  };

  if (existing) {
    const { error } = await db.from("matches").update(row).eq("id", existing.id);
    if (error) throw error;
    Object.assign(existing, row);
    return;
  }

  const { data, error } = await db
    .from("matches")
    .insert(row)
    .select("id,home_team,away_team,kickoff_at,provider_match_id,stage,status,locked,home_goals,away_goals")
    .single();
  if (error) throw error;
  if (data) matches.push(data);
}

export async function syncFixturesFromProvider() {
  if (!supabaseAdminConfigured()) {
    return { mode: "not-configured", imported: 0, message: "Configura Supabase para guardar fixture real." };
  }

  const db = supabaseAdmin();
  const fixtures = await fetchProviderFixtures();
  const { data: existingMatches, error: existingError } = await db
    .from("matches")
    .select("id,home_team,away_team,kickoff_at,provider_match_id,stage,status,locked,home_goals,away_goals");
  if (existingError) throw existingError;
  const matches = existingMatches ?? [];
  let imported = 0;
  let placeholders = 0;
  let opened = 0;

  for (const fixture of fixtures) {
    const existingBefore =
      matches.find((match) => String(match.provider_match_id ?? "") === String(fixture.providerMatchId)) ??
      matches.find((match) => sameFixture(match, fixture)) ??
      matches.find((match) => sameKnockoutSlot(match, fixture));
    if (shouldOpenConfirmedFixture(existingBefore, fixture)) opened += 1;
    await upsertFixture(db, fixture, matches);
    imported += 1;
  }

  for (const fixture of knockoutPlaceholders) {
    const hasConfirmedOrPreparedSlot = matches.some(
      (match) =>
        match.stage === fixture.stage &&
        kickoffClose(match.kickoff_at, fixture.kickoffAt) &&
        (!isPlaceholderTeamName(match.home_team) || !isPlaceholderTeamName(match.away_team) || String(match.provider_match_id ?? "") !== `fifa-${fixture.matchNumber}`)
    );
    if (hasConfirmedOrPreparedSlot) continue;

    const { error } = await db.from("matches").upsert(
      {
        provider_match_id: `fifa-${fixture.matchNumber}`,
        home_team: fixture.homeTeam,
        away_team: fixture.awayTeam,
        home_country_code: null,
        away_country_code: null,
        kickoff_at: fixture.kickoffAt,
        stadium: fixture.stadium,
        stage: fixture.stage,
        group_name: null,
        status: "locked",
        locked: true
      },
      { onConflict: "provider_match_id" }
    );
    if (error) throw error;
    placeholders += 1;
  }

  return { mode: "real", imported, placeholders, opened, total: imported + placeholders, provider: process.env.RESULTS_PROVIDER ?? "football-data" };
}
