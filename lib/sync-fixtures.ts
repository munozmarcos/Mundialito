import { knockoutPlaceholders } from "@/data/knockout-placeholders";
import { fetchProviderFixtures } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

export async function syncFixturesFromProvider() {
  if (!supabaseAdminConfigured()) {
    return { mode: "not-configured", imported: 0, message: "Configura Supabase para guardar fixture real." };
  }

  const db = supabaseAdmin();
  const fixtures = await fetchProviderFixtures();
  let imported = 0;
  let placeholders = 0;

  for (const fixture of fixtures) {
    const { error } = await db.from("matches").upsert(
      {
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
      },
      { onConflict: "provider_match_id" }
    );
    if (error) throw error;
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
