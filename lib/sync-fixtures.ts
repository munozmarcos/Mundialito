import { knockoutPlaceholders } from "@/data/knockout-placeholders";
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

async function upsertFixture(db: ReturnType<typeof supabaseAdmin>, fixture: ProviderFixture, matches: any[]) {
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
    status: "open"
  };

  const existing = matches.find((match) => String(match.provider_match_id ?? "") === String(fixture.providerMatchId)) ?? matches.find((match) => sameFixture(match, fixture));

  if (existing) {
    const { error } = await db.from("matches").update(row).eq("id", existing.id);
    if (error) throw error;
    Object.assign(existing, row);
    return;
  }

  const { data, error } = await db.from("matches").insert(row).select("id,home_team,away_team,kickoff_at,provider_match_id").single();
  if (error) throw error;
  if (data) matches.push(data);
}

export async function syncFixturesFromProvider() {
  if (!supabaseAdminConfigured()) {
    return { mode: "not-configured", imported: 0, message: "Configura Supabase para guardar fixture real." };
  }

  const db = supabaseAdmin();
  const fixtures = await fetchProviderFixtures();
  const { data: existingMatches, error: existingError } = await db.from("matches").select("id,home_team,away_team,kickoff_at,provider_match_id");
  if (existingError) throw existingError;
  const matches = existingMatches ?? [];
  let imported = 0;
  let placeholders = 0;

  for (const fixture of fixtures) {
    await upsertFixture(db, fixture, matches);
    imported += 1;
  }

  for (const fixture of knockoutPlaceholders) {
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
        status: "open"
      },
      { onConflict: "provider_match_id" }
    );
    if (error) throw error;
    placeholders += 1;
  }

  return { mode: "real", imported, placeholders, total: imported + placeholders, provider: process.env.RESULTS_PROVIDER ?? "football-data" };
}
