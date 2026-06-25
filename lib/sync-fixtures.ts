import { knockoutPlaceholders } from "@/data/knockout-placeholders";
import { countryCodeForTeam } from "@/lib/flags";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import { isOfficialKnockoutMatchReady, isPlaceholderTeamName } from "@/lib/match-availability";
import { fetchProviderFixtures, teamsMatch, type ProviderFixture } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

type GroupRow = {
  team: string;
  code?: string | null;
  order: number;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
};

function kickoffClose(a: string, b: string) {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return Math.abs(aTime - bTime) <= 2 * 60 * 60 * 1000;
}

function sameFixture(match: any, fixture: ProviderFixture) {
  if (!fixture.homeTeam || !fixture.awayTeam) return false;
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
  if (!fixture.homeTeam || !fixture.awayTeam) return false;
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

function groupStandings(matches: any[]) {
  const groups = new Map<string, any[]>();
  for (const match of matches) {
    if (match.stage !== "GROUP" || !match.group_name) continue;
    const group = String(match.group_name).toUpperCase();
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(match);
  }

  const tables = new Map<string, GroupRow[]>();
  for (const [group, groupMatches] of groups.entries()) {
    if (groupMatches.length < 6) continue;
    if (groupMatches.some((match) => match.home_goals == null || match.away_goals == null)) continue;

    const rows = new Map<string, GroupRow>();
    const ensure = (team: string, code?: string | null) => {
      if (!rows.has(team)) {
        rows.set(team, {
          team,
          code: countryCodeForTeam(team, code),
          order: fifaGroupTeamOrder(group, team, rows.size),
          played: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0
        });
      }
      return rows.get(team)!;
    };

    for (const match of groupMatches) {
      const home = ensure(match.home_team, match.home_country_code);
      const away = ensure(match.away_team, match.away_country_code);
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.home_goals;
      home.goalsAgainst += match.away_goals;
      away.goalsFor += match.away_goals;
      away.goalsAgainst += match.home_goals;

      if (match.home_goals > match.away_goals) home.points += 3;
      else if (match.away_goals > match.home_goals) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    }

    tables.set(
      group,
      [...rows.values()].sort((a, b) => {
        const goalDiff = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
        return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.order - b.order;
      })
    );
  }
  return tables;
}

function resolveDirectGroupSlot(slot: string, tables: Map<string, GroupRow[]>) {
  const match = slot.trim().match(/^([12])([A-L])$/i);
  if (!match) return null;
  return tables.get(match[2].toUpperCase())?.[Number(match[1]) - 1] ?? null;
}

async function resolveDirectKnockoutSlots(db: ReturnType<typeof supabaseAdmin>, matches: any[]) {
  const tables = groupStandings(matches);
  if (!tables.size) return 0;

  let resolved = 0;
  for (const match of matches) {
    if (match.stage === "GROUP" || match.home_goals != null || match.away_goals != null) continue;

    const home = resolveDirectGroupSlot(match.home_team, tables);
    const away = resolveDirectGroupSlot(match.away_team, tables);
    if (!home && !away) continue;

    const nextHomeTeam = home?.team ?? match.home_team;
    const nextAwayTeam = away?.team ?? match.away_team;
    const nextHomeCode = home?.code ?? match.home_country_code ?? null;
    const nextAwayCode = away?.code ?? match.away_country_code ?? null;
    const ready = isOfficialKnockoutMatchReady({
      stage: match.stage,
      status: "open",
      home_team: nextHomeTeam,
      away_team: nextAwayTeam
    });

    const { error } = await db
      .from("matches")
      .update({
        home_team: nextHomeTeam,
        away_team: nextAwayTeam,
        home_country_code: nextHomeCode,
        away_country_code: nextAwayCode,
        status: ready ? "open" : match.status,
        locked: ready ? false : match.locked
      })
      .eq("id", match.id);
    if (error) throw error;

    Object.assign(match, {
      home_team: nextHomeTeam,
      away_team: nextAwayTeam,
      home_country_code: nextHomeCode,
      away_country_code: nextAwayCode,
      status: ready ? "open" : match.status,
      locked: ready ? false : match.locked
    });
    resolved += 1;
  }
  return resolved;
}

async function upsertFixture(db: ReturnType<typeof supabaseAdmin>, fixture: ProviderFixture, matches: any[]) {
  const existing =
    matches.find((match) => String(match.provider_match_id ?? "") === String(fixture.providerMatchId)) ??
    matches.find((match) => sameFixture(match, fixture)) ??
    matches.find((match) => sameKnockoutSlot(match, fixture));

  if (!existing && (!fixture.homeTeam || !fixture.awayTeam)) return;

  const nextHomeTeam = fixture.homeTeam ?? existing?.home_team;
  const nextAwayTeam = fixture.awayTeam ?? existing?.away_team;
  const nextHomeCode = fixture.homeCode ?? existing?.home_country_code ?? null;
  const nextAwayCode = fixture.awayCode ?? existing?.away_country_code ?? null;
  const mergedFixture = {
    ...fixture,
    homeTeam: nextHomeTeam,
    awayTeam: nextAwayTeam,
    homeCode: nextHomeCode,
    awayCode: nextAwayCode
  };
  const shouldOpen = shouldOpenConfirmedFixture(existing, mergedFixture);

  const row = {
    provider_match_id: fixture.providerMatchId,
    home_team: nextHomeTeam,
    away_team: nextAwayTeam,
    home_country_code: nextHomeCode,
    away_country_code: nextAwayCode,
    kickoff_at: fixture.kickoffAt,
    stadium: fixture.stadium,
    stage: fixture.stage,
    group_name: fixture.groupName,
    status: shouldOpen ? "open" : existing?.status ?? "open",
    locked: shouldOpen ? false : existing?.locked ?? false
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
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,provider_match_id,stage,group_name,status,locked,home_goals,away_goals");
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
    const mergedFixture = existingBefore
      ? {
          ...fixture,
          homeTeam: fixture.homeTeam ?? existingBefore.home_team,
          awayTeam: fixture.awayTeam ?? existingBefore.away_team,
          homeCode: fixture.homeCode ?? existingBefore.home_country_code ?? null,
          awayCode: fixture.awayCode ?? existingBefore.away_country_code ?? null
        }
      : fixture;
    if (shouldOpenConfirmedFixture(existingBefore, mergedFixture)) opened += 1;
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

  const { data: refreshedMatches, error: refreshedError } = await db
    .from("matches")
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,provider_match_id,stage,group_name,status,locked,home_goals,away_goals");
  if (refreshedError) throw refreshedError;
  const resolvedSlots = await resolveDirectKnockoutSlots(db, refreshedMatches ?? matches);

  return { mode: "real", imported, placeholders, opened, resolvedSlots, total: imported + placeholders, provider: process.env.RESULTS_PROVIDER ?? "football-data" };
}
