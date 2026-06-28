import { knockoutPlaceholders } from "@/data/knockout-placeholders";
import { countryCodeForTeam } from "@/lib/flags";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import { isOfficialKnockoutMatchReady, isPlaceholderTeamName } from "@/lib/match-availability";
import { fetchProviderFixtures, teamsMatch, type ProviderFixture } from "@/lib/results-provider";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

type GroupRow = {
  group: string;
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

function fixturePlaceholder(fixture: ProviderFixture) {
  return knockoutPlaceholders.find((placeholder) => placeholder.stage === fixture.stage && kickoffClose(placeholder.kickoffAt, fixture.kickoffAt));
}

function existingOfficialSide(existingTeam?: string | null, existingCode?: string | null) {
  if (!existingTeam || isPlaceholderTeamName(existingTeam)) return null;
  return { team: existingTeam, code: existingCode ?? countryCodeForTeam(existingTeam) ?? null };
}

function mergeFixtureSide(
  fixtureTeam: string | null | undefined,
  fixtureCode: string | null | undefined,
  existingTeam: string | null | undefined,
  existingCode: string | null | undefined,
  placeholderTeam: string | undefined
) {
  if (fixtureTeam) {
    return { team: fixtureTeam, code: fixtureCode ?? existingCode ?? countryCodeForTeam(fixtureTeam) ?? null, fromProvider: true };
  }

  const officialExisting = existingOfficialSide(existingTeam, existingCode);
  if (officialExisting) {
    return { ...officialExisting, fromProvider: false };
  }

  return { team: placeholderTeam ?? existingTeam ?? null, code: null, fromProvider: false };
}

function isFinalGroupMatch(match: any) {
  return (match.status === "closed" || match.status === "final") && match.home_goals != null && match.away_goals != null;
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
    if (groupMatches.some((match) => !isFinalGroupMatch(match))) continue;

    const rows = new Map<string, GroupRow>();
    const ensure = (team: string, code?: string | null) => {
      if (!rows.has(team)) {
        rows.set(team, {
          group,
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

function thirdAllowedGroups(slot: string) {
  const match = slot.trim().match(/^3([A-L](?:\/[A-L])+)$/i);
  return match ? new Set(match[1].split("/").map((group) => group.toUpperCase())) : null;
}

function groupForTeam(tables: Map<string, GroupRow[]>, team: string) {
  for (const table of tables.values()) {
    const row = table.find((item) => teamsMatch(item.team, team));
    if (row) return row;
  }
  return null;
}

function providerFixtureForMatch(match: any, fixtures: ProviderFixture[]) {
  return fixtures.find((fixture) => sameKnockoutSlot(match, fixture));
}

function resolveThirdAssignments(knockoutMatches: any[], bestThirds: GroupRow[], tables: Map<string, GroupRow[]>, fixtures: ProviderFixture[]) {
  const slots = knockoutMatches
    .flatMap((match) => {
      const placeholder = placeholderForMatch(match);
      const providerFixture = providerFixtureForMatch(match, fixtures);
      return [
        { matchId: match.id, side: "home" as const, currentTeam: match.home_team, providerConfirmed: Boolean(providerFixture?.homeTeam), slot: placeholder?.homeTeam ?? match.home_team },
        { matchId: match.id, side: "away" as const, currentTeam: match.away_team, providerConfirmed: Boolean(providerFixture?.awayTeam), slot: placeholder?.awayTeam ?? match.away_team }
      ];
    })
    .map((item) => ({ ...item, allowed: thirdAllowedGroups(item.slot) }))
    .filter((item): item is typeof item & { allowed: Set<string> } => Boolean(item.allowed));

  const byGroup = new Map(bestThirds.map((row) => [row.group, row]));
  const assigned = new Map<string, GroupRow>();
  const used = new Set<string>();

  for (const slot of slots) {
    if (!slot.providerConfirmed || isPlaceholderTeamName(slot.currentTeam)) continue;
    const row = groupForTeam(tables, slot.currentTeam);
    if (!row || !slot.allowed.has(row.group) || !byGroup.has(row.group) || used.has(row.group)) continue;
    assigned.set(`${slot.matchId}:${slot.side}`, row);
    used.add(row.group);
  }

  const sortedSlots = slots
    .filter((slot) => !assigned.has(`${slot.matchId}:${slot.side}`))
    .sort((a, b) => a.allowed.size - b.allowed.size);

  function backtrack(index: number): boolean {
    if (index >= sortedSlots.length) return true;
    const slot = sortedSlots[index];
    const candidates = [...slot.allowed]
      .map((group) => byGroup.get(group))
      .filter((row): row is GroupRow => Boolean(row && !used.has(row.group)));

    for (const row of candidates) {
      used.add(row.group);
      assigned.set(`${slot.matchId}:${slot.side}`, row);
      if (backtrack(index + 1)) return true;
      assigned.delete(`${slot.matchId}:${slot.side}`);
      used.delete(row.group);
    }

    return false;
  }

  backtrack(0);
  return assigned;
}

function placeholderForMatch(match: any) {
  return knockoutPlaceholders.find((fixture) => fixture.stage === match.stage && kickoffClose(match.kickoff_at, fixture.kickoffAt));
}

function resolveDirectSide(
  currentTeam: string,
  currentCode: string | null | undefined,
  placeholderTeam: string | undefined,
  tables: Map<string, GroupRow[]>,
  assignedThird?: GroupRow
) {
  if (placeholderTeam?.trim().match(/^3([A-L](?:\/[A-L])+)$/i)) {
    if (!assignedThird) return { team: placeholderTeam, code: null };
    return { team: assignedThird.team, code: assignedThird.code ?? null };
  }

  if (!placeholderTeam?.trim().match(/^([12])([A-L])$/i)) {
    return { team: currentTeam, code: currentCode ?? null };
  }

  const resolved = resolveDirectGroupSlot(placeholderTeam, tables);
  if (!resolved) return { team: placeholderTeam, code: null };
  return { team: resolved.team, code: resolved.code ?? null };
}

async function resolveDirectKnockoutSlots(db: ReturnType<typeof supabaseAdmin>, matches: any[], fixtures: ProviderFixture[]) {
  const tables = groupStandings(matches);
  const totalGroups = new Set(matches.filter((match) => match.stage === "GROUP" && match.group_name).map((match) => String(match.group_name).toUpperCase())).size;
  const allGroupsComplete = totalGroups > 0 && tables.size === totalGroups;
  const bestThirds = allGroupsComplete
    ? [...tables.values()]
        .map((table) => table[2])
        .filter(Boolean)
        .sort((a, b) => {
          const goalDiff = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
          return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.order - b.order;
        })
        .slice(0, 8)
    : [];
  const thirdAssignments = resolveThirdAssignments(matches.filter((match) => match.stage === "R32"), bestThirds, tables, fixtures);

  let resolved = 0;
  for (const match of matches) {
    if (match.stage === "GROUP" || match.home_goals != null || match.away_goals != null) continue;

    const placeholder = placeholderForMatch(match);
    const nextHome = resolveDirectSide(
      match.home_team,
      match.home_country_code,
      placeholder?.homeTeam ?? match.home_team,
      tables,
      thirdAssignments.get(`${match.id}:home`)
    );
    const nextAway = resolveDirectSide(
      match.away_team,
      match.away_country_code,
      placeholder?.awayTeam ?? match.away_team,
      tables,
      thirdAssignments.get(`${match.id}:away`)
    );

    if (
      nextHome.team === match.home_team &&
      nextAway.team === match.away_team &&
      (nextHome.code ?? null) === (match.home_country_code ?? null) &&
      (nextAway.code ?? null) === (match.away_country_code ?? null)
    ) {
      continue;
    }

    const ready = isOfficialKnockoutMatchReady({
      stage: match.stage,
      status: "open",
      home_team: nextHome.team,
      away_team: nextAway.team
    });

    const { error } = await db
      .from("matches")
      .update({
        home_team: nextHome.team,
        away_team: nextAway.team,
        home_country_code: nextHome.code,
        away_country_code: nextAway.code,
        status: ready ? "open" : "locked",
        locked: !ready
      })
      .eq("id", match.id);
    if (error) throw error;

    Object.assign(match, {
      home_team: nextHome.team,
      away_team: nextAway.team,
      home_country_code: nextHome.code,
      away_country_code: nextAway.code,
      status: ready ? "open" : "locked",
      locked: !ready
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

  const placeholder = fixture.stage === "GROUP" ? null : fixturePlaceholder(fixture);
  const homeSide = mergeFixtureSide(fixture.homeTeam, fixture.homeCode, existing?.home_team, existing?.home_country_code, placeholder?.homeTeam);
  const awaySide = mergeFixtureSide(fixture.awayTeam, fixture.awayCode, existing?.away_team, existing?.away_country_code, placeholder?.awayTeam);
  const nextHomeTeam = homeSide.team;
  const nextAwayTeam = awaySide.team;
  const nextHomeCode = homeSide.code;
  const nextAwayCode = awaySide.code;
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
    status: fixture.stage !== "GROUP" && !shouldOpen ? "locked" : shouldOpen ? "open" : existing?.status ?? "open",
    locked: fixture.stage !== "GROUP" && !shouldOpen ? true : shouldOpen ? false : existing?.locked ?? false
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
    const fixtureSlot = fixturePlaceholder(fixture);
    const homeSide = mergeFixtureSide(fixture.homeTeam, fixture.homeCode, existingBefore?.home_team, existingBefore?.home_country_code, fixtureSlot?.homeTeam);
    const awaySide = mergeFixtureSide(fixture.awayTeam, fixture.awayCode, existingBefore?.away_team, existingBefore?.away_country_code, fixtureSlot?.awayTeam);
    const mergedFixture = existingBefore
      ? {
          ...fixture,
          homeTeam: homeSide.team,
          awayTeam: awaySide.team,
          homeCode: homeSide.code,
          awayCode: awaySide.code
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

  return { mode: "real", imported, placeholders, opened, resolvedSlots: 0, total: imported + placeholders, provider: process.env.RESULTS_PROVIDER ?? "football-data" };
}
