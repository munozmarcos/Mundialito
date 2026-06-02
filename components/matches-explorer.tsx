"use client";

import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { formatArgentinaDate, formatArgentinaDateTime } from "@/lib/dates";
import { matchStatus } from "@/lib/scoring";
import type { Match, MatchStage } from "@/lib/types";
import { CalendarDays, GitBranch, Lock, Table2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

type WinnerSide = "HOME" | "AWAY";
type ResultMap = Record<string, { home: number | ""; away: number | ""; winner?: WinnerSide | "" }>;

type GroupRow = {
  team: string;
  code?: string | null;
  group?: string | null;
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
  THIRD_PLACE: "3er puesto",
  FINAL: "Final"
};

const knockoutOrder: MatchStage[] = ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];
const stages = ["ALL", "GROUP", "R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

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
    if (!rows.has(team)) rows.set(team, { team, code, group, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 });
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
    return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team);
  });
}

function resolveGroupSlot(slot: string, groupTables: Record<string, GroupRow[]>, bestThirds: GroupRow[]) {
  const clean = slot.trim();
  const direct = clean.match(/^([12])([A-L])$/i);
  if (direct) return displayFromRow(groupTables[direct[2].toUpperCase()]?.[Number(direct[1]) - 1], clean);

  const third = clean.match(/^3([A-L](?:\/[A-L])+)$/i);
  if (third) {
    const allowed = new Set(third[1].split("/").map((group) => group.toUpperCase()));
    const row = bestThirds.find((item) => allowed.has(item.group ?? ""));
    return displayFromRow(row, clean);
  }

  return { name: clean };
}

function isPlaceholderTeam(team: DisplayTeam) {
  const clean = team.name.trim();
  return (
    clean === "Por definir" ||
    /^([123])([A-L])$/i.test(clean) ||
    /^3[A-L](?:\/[A-L])+$/i.test(clean) ||
    /^(?:Ganador|Winner Match|W|Perdedor|Loser Match|L)\s*#?\d+$/i.test(clean)
  );
}

function isMatchUnavailable(match: Match, display?: DisplayMatch) {
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
      return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team);
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

function resultText(match: Match) {
  return match.home_goals == null || match.away_goals == null ? "Pendiente" : `${match.home_goals}-${match.away_goals}`;
}

function MatchCard({ match, display }: { match: Match; display?: DisplayMatch }) {
  const home = display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = display?.away ?? { name: match.away_team, code: match.away_country_code };
  const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null);
  const unavailable = isMatchUnavailable(match, display);

  return (
    <article className="rounded-lg border border-line bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="badge">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage]}</span>
          <p className="mt-2 text-xs font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</p>
        </div>
        <StatusPill status={unavailable ? "locked" : status} />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-field p-2">
          <TeamOrLock team={home} />
          <strong>{match.home_goals ?? ""}</strong>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-field p-2">
          <TeamOrLock team={away} />
          <strong>{match.away_goals ?? ""}</strong>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-field p-2">
          <span className="block font-bold text-ink/60">Resultado</span>
          <span className="font-black">{resultText(match)}</span>
        </div>
        <div className="rounded-md bg-field p-2">
          <span className="block font-bold text-ink/60">Fase</span>
          <span className="font-black">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage]}</span>
        </div>
      </div>
      {match.stadium && match.stadium !== "-" && <p className="mt-3 text-xs font-semibold text-ink/55">{match.stadium}</p>}
      {unavailable && <p className="mt-2 text-xs font-bold text-slate-500">Cerrado hasta que se definan los clasificados.</p>}
    </article>
  );
}

export function MatchesExplorer({ matches }: { matches: Match[] }) {
  const [activeTab, setActiveTab] = useState<"partidos" | "tablas" | "llaves">("partidos");
  const [stage, setStage] = useState("ALL");
  const results = useMemo(() => initialResults(matches), [matches]);
  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  const knockoutMatches = matches.filter((match) => match.stage !== "GROUP");
  const byGroup = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const byStage = groupBy(knockoutMatches, (match) => match.stage);
  const bracket = useMemo(() => deriveBracket(groupMatches, knockoutMatches, results), [groupMatches, knockoutMatches, results]);
  const visibleMatches = stage === "ALL" ? matches : matches.filter((match) => match.stage === stage);
  const completed = matches.filter((match) => match.home_goals != null && match.away_goals != null).length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Partidos</span>
          <strong className="block text-3xl">{matches.length}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Resultados cargados</span>
          <strong className="block text-3xl">{completed}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Hora</span>
          <strong className="block text-lg">Argentina</strong>
        </div>
      </section>

      <section className="panel flex flex-wrap gap-2 p-2">
        {[
          ["partidos", "Partidos", CalendarDays],
          ["tablas", "Tablas", Table2],
          ["llaves", "Llaves", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            className={`btn ${activeTab === key ? "" : "secondary"}`}
            key={key as string}
            onClick={() => setActiveTab(key as "partidos" | "tablas" | "llaves")}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </section>

      {activeTab === "partidos" && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-2xl font-black">Calendario completo</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Resultados reales, estado de cierre y cruces ya resueltos cuando corresponda.</p>
          </div>
          <div className="panel flex flex-wrap gap-2 p-2">
            {stages.map((item) => (
              <button className={`btn ${stage === item ? "" : "secondary"}`} key={item} onClick={() => setStage(item)} type="button">
                {stageLabels[item] ?? item}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {visibleMatches.map((match) => (
              <MatchCard display={bracket.displays[match.id]} key={match.id} match={match} />
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
            {Object.entries(byGroup).map(([group, items]) => {
              const table = bracket.groupTables[group] ?? projectedGroupTable(items, results);
              const groupCompleted = items.filter((match) => results[match.id]?.home !== "" && results[match.id]?.away !== "").length;
              return (
                <article className="panel overflow-hidden" key={group}>
                  <div className="flex items-center justify-between gap-2 border-b border-line bg-field p-4">
                    <div>
                      <span className="badge">Grupo {group}</span>
                      <h2 className="mt-2 text-xl font-black">Tabla de posiciones</h2>
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
            <p className="mt-1 text-sm font-semibold text-ink/60">Los cruces se completan automaticamente segun tablas y ganadores.</p>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
            {knockoutOrder
              .filter((item) => byStage[item]?.length)
              .map((item) => (
                <article className="panel w-[300px] flex-none overflow-hidden" key={item}>
                  <h2 className="flex items-center gap-2 border-b border-line bg-field p-4 text-lg font-black">
                    <Trophy className="h-4 w-4 text-gold" />
                    {stageLabels[item]}
                  </h2>
                  <div className="grid gap-3 p-4">
                    {byStage[item].map((match) => {
                      const display = bracket.displays[match.id] ?? {
                        home: { name: match.home_team, code: match.home_country_code },
                        away: { name: match.away_team, code: match.away_country_code }
                      };
                      const result = results[match.id];
                      const winner = winnerFromResult(display, result);
                      return (
                        <div className="rounded-lg border border-line bg-white p-3 shadow-sm" key={match.id}>
                          <div className="mb-2 text-xs font-bold text-ink/55">{formatArgentinaDate(match.kickoff_at)}</div>
                          <div className={`flex items-center justify-between gap-2 rounded-md border border-line p-2 ${winner?.name === display.home.name ? "bg-mint" : "bg-field"}`}>
                            <TeamOrLock team={display.home} />
                            <strong>{result?.home === "" ? "" : result?.home}</strong>
                          </div>
                          <div className={`mt-1 flex items-center justify-between gap-2 rounded-md border border-line p-2 ${winner?.name === display.away.name ? "bg-mint" : "bg-field"}`}>
                            <TeamOrLock team={display.away} />
                            <strong>{result?.away === "" ? "" : result?.away}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
