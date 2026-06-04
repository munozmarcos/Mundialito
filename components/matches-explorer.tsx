"use client";

import { StatusPill } from "@/components/status-pill";
import { DateFilter } from "@/components/date-filter";
import { TeamLabel } from "@/components/team-label";
import { formatArgentinaDateTime } from "@/lib/dates";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import { isMatchBlockedUntilOfficial, isPlaceholderTeamName } from "@/lib/match-availability";
import { matchFitsBasicFilters } from "@/lib/match-filters";
import { matchStatus } from "@/lib/scoring";
import type { Match, MatchStage } from "@/lib/types";
import { Calculator, GitBranch, Lock, Table2, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";

type WinnerSide = "HOME" | "AWAY";
type ResultMap = Record<string, { home: number | ""; away: number | ""; winner?: WinnerSide | "" }>;

type GroupRow = {
  team: string;
  code?: string | null;
  group?: string | null;
  order: number;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
};

type DisplayTeam = {
  name: string;
  code?: string | null;
};

type DisplayMatch = {
  home: DisplayTeam;
  away: DisplayTeam;
};

const stageLabels: Record<string, string> = {
  ALL: "Todos",
  GROUP: "Grupos",
  R32: "16vos",
  R16: "8vos",
  QF: "4tos",
  SF: "Semis",
  THIRD_PLACE: "3ros",
  FINAL: "Final"
};

const knockoutOrder: MatchStage[] = ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];
function matchFitsFilters(match: Match, teamFilter: string, dateFilter: string) {
  return matchFitsBasicFilters(match, teamFilter, dateFilter);
}

function initialResults(matches: Match[]): ResultMap {
  return matches.reduce<ResultMap>((acc, match) => {
    acc[match.id] = {
      home: match.home_goals ?? "",
      away: match.away_goals ?? "",
      winner:
        match.penalty_winner === match.home_team
          ? "HOME"
          : match.penalty_winner === match.away_team
            ? "AWAY"
            : ""
    };
    return acc;
  }, {});
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const group = key(item);
    acc[group] ??= [];
    acc[group].push(item);
    return acc;
  }, {});
}

function matchNumber(match: Match) {
  const source = match.provider_match_id ?? "";
  const fromProvider = source.match(/fifa-(\d+)/i);
  if (fromProvider) return Number(fromProvider[1]);
  return null;
}

function displayFromRow(row?: GroupRow, fallback = "Por definir"): DisplayTeam {
  return row ? { name: row.team, code: row.code } : { name: fallback };
}

function projectedGroupTable(matches: Match[], results: ResultMap) {
  const rows = new Map<string, GroupRow>();
  const group = matches[0]?.group_name ?? null;
  const ensure = (team: string, code?: string | null) => {
    if (!rows.has(team)) rows.set(team, { team, code, group, order: fifaGroupTeamOrder(group, team, rows.size), played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 });
    return rows.get(team)!;
  };

  for (const match of matches) {
    ensure(match.home_team, match.home_country_code);
    ensure(match.away_team, match.away_country_code);
    const result = results[match.id];
    if (!result || result.home === "" || result.away === "") continue;

    const home = ensure(match.home_team, match.home_country_code);
    const away = ensure(match.away_team, match.away_country_code);
    home.played += 1;
    away.played += 1;
    home.goalsFor += result.home;
    home.goalsAgainst += result.away;
    away.goalsFor += result.away;
    away.goalsAgainst += result.home;

    if (result.home > result.away) home.points += 3;
    else if (result.away > result.home) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  return [...rows.values()].sort((a, b) => {
    const goalDiff = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
    return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.order - b.order;
  });
}

function resolveGroupSlot(slot: string, groupTables: Record<string, GroupRow[]>, bestThirds: GroupRow[]) {
  const clean = slot.trim();
  const direct = clean.match(/^([12])([A-L])$/i);
  if (direct) return displayFromRow(groupTables[direct[2].toUpperCase()]?.[Number(direct[1]) - 1], clean);

  const third = clean.match(/^3([A-L](?:\/[A-L])+)$/i);
  if (third) {
    return { name: clean };
  }

  return { name: clean };
}

function isPlaceholderTeam(team: DisplayTeam) {
  return isPlaceholderTeamName(team.name);
}

function isMatchUnavailable(match: Match, display?: DisplayMatch) {
  if (isMatchBlockedUntilOfficial(match)) return true;
  if (match.stage === "GROUP") return false;
  const home = display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = display?.away ?? { name: match.away_team, code: match.away_country_code };
  return isPlaceholderTeam(home) || isPlaceholderTeam(away);
}

function TeamOrLock({ team }: { team: DisplayTeam }) {
  if (!isPlaceholderTeam(team)) return <TeamLabel name={team.name} code={team.code} />;
  return (
    <span className="inline-flex items-center gap-2 font-bold text-slate-500">
      <span className="grid h-4 w-6 place-items-center rounded-[2px] bg-slate-200 ring-1 ring-slate-300">
        <Lock className="h-3 w-3" />
      </span>
      <span>{team.name}</span>
    </span>
  );
}

function winnerFromResult(display: DisplayMatch, result?: { home: number | ""; away: number | ""; winner?: WinnerSide | "" }): DisplayTeam | null {
  if (!result || result.home === "" || result.away === "") return null;
  if (result.home > result.away) return display.home;
  if (result.away > result.home) return display.away;
  if (result.winner === "HOME") return display.home;
  if (result.winner === "AWAY") return display.away;
  return null;
}

function loserFromResult(display: DisplayMatch, result?: { home: number | ""; away: number | ""; winner?: WinnerSide | "" }): DisplayTeam | null {
  if (!result || result.home === "" || result.away === "") return null;
  if (result.home > result.away) return display.away;
  if (result.away > result.home) return display.home;
  if (result.winner === "HOME") return display.away;
  if (result.winner === "AWAY") return display.home;
  return null;
}

function resolveBracketSlot(
  slot: string,
  groupTables: Record<string, GroupRow[]>,
  bestThirds: GroupRow[],
  winners: Record<number, DisplayTeam>,
  losers: Record<number, DisplayTeam>
): DisplayTeam {
  const clean = slot.trim();
  const winner = clean.match(/^(?:Ganador|Winner Match|W)\s*#?(\d+)$/i);
  if (winner) return winners[Number(winner[1])] ?? { name: clean };

  const loser = clean.match(/^(?:Perdedor|Loser Match|L)\s*#?(\d+)$/i);
  if (loser) return losers[Number(loser[1])] ?? { name: clean };

  return resolveGroupSlot(clean, groupTables, bestThirds);
}

function deriveBracket(groupMatches: Match[], knockoutMatches: Match[], results: ResultMap) {
  const grouped = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const groupTables = Object.fromEntries(Object.entries(grouped).map(([group, items]) => [group, projectedGroupTable(items, results)]));
  const bestThirds = Object.values(groupTables)
    .map((table) => table[2])
    .filter(Boolean)
    .sort((a, b) => {
      const goalDiff = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
      return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.order - b.order;
    })
    .slice(0, 8);

  const winners: Record<number, DisplayTeam> = {};
  const losers: Record<number, DisplayTeam> = {};
  const displays: Record<string, DisplayMatch> = {};

  for (const match of [...knockoutMatches].sort((a, b) => (matchNumber(a) ?? 999) - (matchNumber(b) ?? 999))) {
    const display = {
      home: resolveBracketSlot(match.home_team, groupTables, bestThirds, winners, losers),
      away: resolveBracketSlot(match.away_team, groupTables, bestThirds, winners, losers)
    };
    displays[match.id] = display;

    const number = matchNumber(match);
    if (!number) continue;
    const winner = winnerFromResult(display, results[match.id]);
    const loser = loserFromResult(display, results[match.id]);
    if (winner) winners[number] = winner;
    if (loser) losers[number] = loser;
  }

  return { groupTables, bestThirds, displays };
}

function MatchCard({ match, display }: { match: Match; display?: DisplayMatch }) {
  const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status);
  const unavailable = isMatchUnavailable(match, display);
  const useOfficialPlaceholder = isMatchBlockedUntilOfficial(match);
  const home = useOfficialPlaceholder ? { name: match.home_team, code: match.home_country_code } : display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = useOfficialPlaceholder ? { name: match.away_team, code: match.away_country_code } : display?.away ?? { name: match.away_team, code: match.away_country_code };

  return (
    <article className="rounded-lg border border-line bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="badge">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage]}</span>
          <p className="mt-2 text-xs font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</p>
        </div>
        <StatusPill status={unavailable ? "locked" : status} label={unavailable ? "Bloqueado" : undefined} />
      </div>
      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_68px] items-center gap-3 rounded-md border border-line bg-field p-2">
          <TeamOrLock team={home} />
          <input className="field text-center font-black" disabled value={match.home_goals ?? ""} aria-label={`Goles ${home.name}`} readOnly />
        </div>
        <div className="grid grid-cols-[1fr_68px] items-center gap-3 rounded-md border border-line bg-field p-2">
          <TeamOrLock team={away} />
          <input className="field text-center font-black" disabled value={match.away_goals ?? ""} aria-label={`Goles ${away.name}`} readOnly />
        </div>
      </div>
      {match.stadium && match.stadium !== "-" && <p className="mt-3 text-xs font-semibold text-ink/55">{match.stadium}</p>}
      {unavailable && <p className="mt-2 text-xs font-bold text-slate-500">Bloqueado hasta que se definan los clasificados.</p>}
    </article>
  );
}

export function MatchesExplorer({ matches }: { matches: Match[] }) {
  const [activeTab, setActiveTab] = useState<"todos" | "grupos" | "tablas" | "llaves">("todos");
  const [activeGroup, setActiveGroup] = useState("");
  const [activeKnockoutStage, setActiveKnockoutStage] = useState<MatchStage>("R32");
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const results = useMemo(() => initialResults(matches), [matches]);
  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  const knockoutMatches = matches.filter((match) => match.stage !== "GROUP");
  const byGroup = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const byStage = groupBy(knockoutMatches, (match) => match.stage);
  const bracket = useMemo(() => deriveBracket(groupMatches, knockoutMatches, results), [groupMatches, knockoutMatches, results]);
  const totalOpen = matches.filter((match) => match.home_goals == null && !isMatchUnavailable(match) && matchStatus(match.kickoff_at, match.locked, false, new Date(), match.status) === "open").length;
  const totalBlocked = matches.filter((match) => isMatchUnavailable(match)).length;
  const totalClosed = matches.filter((match) => match.home_goals != null || (!isMatchUnavailable(match) && matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status) === "closed")).length;
  const availableGroups = Object.keys(byGroup).sort();
  const selectedGroup = activeGroup && availableGroups.includes(activeGroup) ? activeGroup : availableGroups[0];
  const availableKnockoutStages = knockoutOrder.filter((stage) => byStage[stage]?.length);
  const selectedKnockoutStage = availableKnockoutStages.includes(activeKnockoutStage) ? activeKnockoutStage : availableKnockoutStages[0];
  const selectedKnockoutMatches = selectedKnockoutStage ? (byStage[selectedKnockoutStage] ?? []).filter((match) => matchFitsFilters(match, teamFilter, dateFilter)) : [];
  const allFilteredMatches = matches.filter((match) => matchFitsFilters(match, teamFilter, dateFilter));
  const filteredGroups = Object.entries(byGroup)
    .filter(([group]) => activeTab === "tablas" || !selectedGroup || group === selectedGroup)
    .map(([group, items]) => [group, items.filter((match) => matchFitsFilters(match, teamFilter, dateFilter))] as const)
    .filter(([, items]) => items.length);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Totales</span>
          <strong className="block text-3xl">{matches.length}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Abiertos</span>
          <strong className="block text-3xl">{totalOpen}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Cerrados</span>
          <strong className="block text-3xl">{totalClosed}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Bloqueados</span>
          <strong className="block text-3xl">{totalBlocked}</strong>
        </div>
      </section>

      <section className="panel flex flex-wrap gap-2 p-2">
        {[
          ["todos", "Todos", Trophy],
          ["grupos", "Grupos", Calculator],
          ["tablas", "Tablas", Table2],
          ["llaves", "Llaves", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            className={`btn ${activeTab === key ? "" : "secondary"}`}
            key={key as string}
            onClick={() => setActiveTab(key as "todos" | "grupos" | "tablas" | "llaves")}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </section>

      <section className="panel grid gap-2 p-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto] lg:grid-cols-[220px_112px_44px] lg:items-center">
        <input className="field" placeholder="Pais" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} />
        <DateFilter value={dateFilter} onChange={setDateFilter} />
        <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => { setTeamFilter(""); setDateFilter(""); }}>
          <X className="h-4 w-4" />
        </button>
      </section>

      {activeTab === "todos" && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-2xl font-black">Todos</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Grilla completa con filtro por país y fecha.</p>
          </div>
          <div className="match-card-grid">
            {allFilteredMatches.map((match) => (
              <MatchCard key={match.id} match={match} display={bracket.displays[match.id]} />
            ))}
          </div>
        </section>
      )}

      {activeTab === "grupos" && (
        <section className="panel overflow-x-auto p-2">
          <div className="flex w-max flex-nowrap gap-2">
            {availableGroups.map((group) => (
              <button
                className={`btn min-w-11 px-0 ${selectedGroup === group ? "group-tab-active" : "secondary"}`}
                key={group}
                onClick={() => setActiveGroup(group)}
                type="button"
              >
                {group}
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "grupos" && (
        <section className="grid gap-4">
          <div className="grid gap-4">
            {filteredGroups.map(([group, items]) => (
              <div className="grid gap-3" key={group}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-black">Grupo {group}</h2>
                </div>
                <div className="match-card-grid">
                  {items.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "tablas" && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-2xl font-black">Tablas reales</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Se actualizan con cada resultado cargado y marcan clasificacion directa y mejores terceros.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map(([group, items]) => {
              const table = bracket.groupTables[group] ?? projectedGroupTable(items, results);
              const groupCompleted = items.filter((match) => results[match.id]?.home !== "" && results[match.id]?.away !== "").length;
              return (
                <article className="panel overflow-hidden" key={group}>
                  <div className="flex items-center justify-between gap-2 border-b border-line bg-field p-4">
                    <div>
                      <h2 className="text-xl font-black">Grupo {group}</h2>
                    </div>
                    <span className="text-sm font-black text-ink/60">{groupCompleted}/{items.length}</span>
                  </div>
                  <div className="grid gap-2 p-4 text-sm">
                    {table.map((row, index) => (
                      <div className="grid grid-cols-[32px_1fr_42px_42px_42px] items-center gap-2 rounded-lg border border-line bg-white p-2 shadow-sm" key={`${group}-${row.team}`}>
                        <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index < 2 ? "bg-mint text-grass" : index === 2 ? "bg-amber-50 text-gold" : "bg-field text-ink/45"}`}>{index + 1}</span>
                        <TeamLabel name={row.team} code={row.code} />
                        <strong className="text-center">{row.points}</strong>
                        <span className="text-center text-ink/60">{row.played}</span>
                        <span className="text-center text-ink/60">{row.goalsFor - row.goalsAgainst}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-[32px_1fr_42px_42px_42px] gap-2 px-2 text-[11px] font-bold uppercase text-ink/45">
                      <span />
                      <span>Equipo</span>
                      <span className="text-center">Pts</span>
                      <span className="text-center">PJ</span>
                      <span className="text-center">DG</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "llaves" && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-2xl font-black">Llaves reales</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Los cruces se muestran cuando esten confirmados oficialmente.</p>
          </div>
          {knockoutMatches.length ? (
            <div className="grid gap-4">
              <div className="panel flex flex-wrap gap-2 p-2">
                {availableKnockoutStages.map((stage) => (
                  <button
                    className={`btn ${selectedKnockoutStage === stage ? "" : "secondary"}`}
                    key={stage}
                    onClick={() => setActiveKnockoutStage(stage)}
                    type="button"
                  >
                    <Trophy className="h-4 w-4 text-gold" />
                    {stageLabels[stage]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-lg font-black">
                <Trophy className="h-4 w-4 text-gold" />
                <h3>{selectedKnockoutStage ? stageLabels[selectedKnockoutStage] : "Llaves"}</h3>
              </div>
              <div className="match-card-grid">
                {selectedKnockoutMatches.map((match) => (
                  <MatchCard key={match.id} match={match} display={bracket.displays[match.id]} />
                ))}
              </div>
            </div>
          ) : (
            <div className="panel p-6 text-sm text-ink/70">Las llaves aparecen cuando esten disponibles los cruces de cada fase.</div>
          )}
        </section>
      )}
    </div>
  );
}
