"use client";

import { scorePrediction } from "@/lib/scoring";
import { formatArgentinaDate } from "@/lib/dates";
import { matchFitsBasicFilters } from "@/lib/match-filters";
import { displayNameForTeam } from "@/lib/flags";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import type { Match, MatchStage, Prediction, Profile } from "@/lib/types";
import { TeamLabel } from "@/components/team-label";
import { DateFilter } from "@/components/date-filter";
import { CountryFilterPicker } from "@/components/country-filter-picker";
import { teamOptionsFromMatches } from "@/lib/team-options";
import { Calculator, CircleDot, ClipboardPaste, GitBranch, Lock, RotateCcw, Table2, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SimPrediction = Prediction & { profiles?: Pick<Profile, "display_name"> | null };

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

function parseGoalInput(value: string) {
  if (!/^\d*$/.test(value)) return null;
  if (value === "") return "";
  return Number(value);
}

type Props = {
  matches: Match[];
  predictions: SimPrediction[];
  profiles: Profile[];
};

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

function parseBulkLine(line: string) {
  const clean = line
    .replace(/\s*\|\s*Ganador:.+$/i, "")
    .replace(/\s+Ganador:.+$/i, "")
    .trim();
  const match = clean.match(/^(.+?)\s+(\d+)\s*[-:]\s*(\d+)\s+(.+)$/);
  if (!match) return null;
  return { homeTeam: match[1].trim().toLowerCase(), homeGoals: Number(match[2]), awayGoals: Number(match[3]), awayTeam: match[4].trim().toLowerCase() };
}

function norm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function teamMatchesBulk(team: string, query: string) {
  const normalizedQuery = norm(query);
  return norm(team) === normalizedQuery || norm(displayNameForTeam(team)) === normalizedQuery;
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

function isPlaceholderTeam(team: DisplayTeam) {
  const clean = team.name.trim();
  return (
    clean === "Por definir" ||
    /^([123])([A-L])$/i.test(clean) ||
    /^3[A-L](?:\/[A-L])+$/i.test(clean) ||
    /^(?:Ganador|Winner Match|W|Perdedor|Loser Match|L)\s*#?\d+$/i.test(clean)
  );
}

function TeamOrLock({ team }: { team: DisplayTeam }) {
  if (!isPlaceholderTeam(team)) return <TeamLabel name={team.name} code={team.code} />;
  return (
    <span className="inline-flex items-center gap-2 font-bold text-slate-400">
      <span className="grid h-4 w-6 place-items-center rounded-[2px] bg-slate-800 ring-1 ring-slate-600">
        <Lock className="h-3 w-3" />
      </span>
      <span>{team.name}</span>
    </span>
  );
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
    const goalDiff = (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.order - b.order;
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

function thirdAllowedGroups(slot: string) {
  const third = slot.trim().match(/^3([A-L](?:\/[A-L])+)$/i);
  return third ? new Set(third[1].split("/").map((group) => group.toUpperCase())) : null;
}

function resolveThirdAssignments(knockoutMatches: Match[], bestThirds: GroupRow[]) {
  const slots = knockoutMatches
    .flatMap((match) => [
      { matchId: match.id, side: "home" as const, slot: match.home_team },
      { matchId: match.id, side: "away" as const, slot: match.away_team }
    ])
    .map((item) => ({ ...item, allowed: thirdAllowedGroups(item.slot) }))
    .filter((item): item is typeof item & { allowed: Set<string> } => Boolean(item.allowed));

  const byGroup = new Map(bestThirds.map((row) => [row.group ?? "", row]));
  const sortedSlots = [...slots].sort((a, b) => a.allowed.size - b.allowed.size);
  const assigned = new Map<string, GroupRow>();
  const used = new Set<string>();

  function backtrack(index: number): boolean {
    if (index >= sortedSlots.length) return true;
    const slot = sortedSlots[index];
    const candidates = [...slot.allowed]
      .map((group) => byGroup.get(group))
      .filter((row): row is GroupRow => Boolean(row && row.group && !used.has(row.group)));

    for (const row of candidates) {
      used.add(row.group!);
      assigned.set(`${slot.matchId}:${slot.side}`, row);
      if (backtrack(index + 1)) return true;
      assigned.delete(`${slot.matchId}:${slot.side}`);
      used.delete(row.group!);
    }

    return false;
  }

  backtrack(0);
  return assigned;
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
  losers: Record<number, DisplayTeam>,
  assignedThird?: GroupRow
): DisplayTeam {
  const clean = slot.trim();
  const winner = clean.match(/^(?:Ganador|Winner Match|W)\s*#?(\d+)$/i);
  if (winner) return winners[Number(winner[1])] ?? { name: clean };

  const loser = clean.match(/^(?:Perdedor|Loser Match|L)\s*#?(\d+)$/i);
  if (loser) return losers[Number(loser[1])] ?? { name: clean };

  if (thirdAllowedGroups(clean)) return displayFromRow(assignedThird, clean);

  return resolveGroupSlot(clean, groupTables, bestThirds);
}

function deriveSimulatedBracket(groupMatches: Match[], knockoutMatches: Match[], results: ResultMap) {
  const grouped = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const groupTables = Object.fromEntries(Object.entries(grouped).map(([group, items]) => [group, projectedGroupTable(items, results)]));
  const bestThirds = Object.values(groupTables)
    .map((table) => table[2])
    .filter(Boolean)
    .sort((a, b) => {
      const goalDiff = (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
      return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.order - b.order;
    })
    .slice(0, 8);
  const thirdAssignments = resolveThirdAssignments(knockoutMatches.filter((match) => match.stage === "R32"), bestThirds);

  const winners: Record<number, DisplayTeam> = {};
  const losers: Record<number, DisplayTeam> = {};
  const displays: Record<string, DisplayMatch> = {};

  for (const match of [...knockoutMatches].sort((a, b) => (matchNumber(a) ?? 999) - (matchNumber(b) ?? 999))) {
    const display = {
      home: resolveBracketSlot(match.home_team, groupTables, bestThirds, winners, losers, thirdAssignments.get(`${match.id}:home`)),
      away: resolveBracketSlot(match.away_team, groupTables, bestThirds, winners, losers, thirdAssignments.get(`${match.id}:away`))
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

export function ScoringSimulator({ matches, predictions, profiles }: Props) {
  const [results, setResults] = useState<ResultMap>(() => initialResults(matches));
  const [bulk, setBulk] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"todos" | "cargar" | "tablas" | "llave">("todos");
  const [activeKnockoutStage, setActiveKnockoutStage] = useState<MatchStage>("R32");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [activeGroup, setActiveGroup] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [podium, setPodium] = useState({ champion_team: "", runner_up_team: "", third_place_team: "" });
  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  const knockoutMatches = matches.filter((match) => match.stage !== "GROUP");
  const byGroup = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const byStage = groupBy(knockoutMatches, (match) => match.stage);
  const simulated = useMemo(() => deriveSimulatedBracket(groupMatches, knockoutMatches, results), [groupMatches, knockoutMatches, results]);
  const availableKnockoutStages = knockoutOrder.filter((item) => byStage[item]?.length);
  const selectedKnockoutStage = availableKnockoutStages.includes(activeKnockoutStage)
    ? activeKnockoutStage
    : availableKnockoutStages[0];
  const selectedKnockoutMatches = selectedKnockoutStage
    ? (byStage[selectedKnockoutStage] ?? []).filter((match) => matchFitsFilters(match, teamFilter, dateFilter))
    : [];
  const allFilteredMatches = matches.filter((match) => matchFitsFilters(match, teamFilter, dateFilter));
  const allFilteredByStage = groupBy(allFilteredMatches, (match) => match.stage);
  const teamOptions = useMemo(() => teamOptionsFromMatches(groupMatches), [groupMatches]);
  const availableGroups = Object.keys(byGroup).sort();
  const selectedGroup = activeGroup && availableGroups.includes(activeGroup) ? activeGroup : availableGroups[0];
  const filteredGroups = Object.entries(byGroup)
    .filter(([group]) => activeTab === "tablas" || !selectedGroup || group === selectedGroup)
    .map(([group, items]) => [group, items.filter((match) => matchFitsFilters(match, teamFilter, dateFilter))] as const)
    .filter(([, items]) => items.length);
  const groupPhaseComplete =
    groupMatches.length > 0 &&
    groupMatches.every((match) => results[match.id]?.home !== "" && results[match.id]?.away !== "");

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!mounted) return;
        setSessionUserId(data.user?.id ?? null);
        if (data.user) {
          void fetch("/api/podium", { cache: "no-store" })
            .then((response) => response.json())
            .then((podiumData) => {
              if (!mounted || !podiumData.podium) return;
              setPodium({
                champion_team: podiumData.podium.champion_team ?? "",
                runner_up_team: podiumData.podium.runner_up_team ?? "",
                third_place_team: podiumData.podium.third_place_team ?? ""
              });
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (mounted) setSessionUserId(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const predictionsByMatch = useMemo(() => {
    return predictions.reduce<Record<string, SimPrediction[]>>((acc, prediction) => {
      acc[prediction.match_id] ??= [];
      acc[prediction.match_id].push(prediction);
      return acc;
    }, {});
  }, [predictions]);

  const ranking = useMemo(() => {
    const rows = profiles.reduce<Record<string, { userId: string; name: string; points: number; exacts: number; trends: number; played: number }>>((acc, profile) => {
      acc[profile.id] = { userId: profile.id, name: profile.display_name, points: 0, exacts: 0, trends: 0, played: 0 };
      return acc;
    }, {});

    for (const match of matches) {
      const result = results[match.id];
      if (result?.home === "" || result?.away === "") continue;
      for (const prediction of predictionsByMatch[match.id] ?? []) {
        rows[prediction.user_id] ??= { userId: prediction.user_id, name: prediction.profiles?.display_name ?? "Jugador", points: 0, exacts: 0, trends: 0, played: 0 };
        const score = scorePrediction({
          stage: match.stage,
          predictedHomeGoals: prediction.home_goals,
          predictedAwayGoals: prediction.away_goals,
          actualHomeGoals: result.home,
          actualAwayGoals: result.away
        });
        rows[prediction.user_id].points += score.points;
        rows[prediction.user_id].exacts += score.exactHit ? 1 : 0;
        rows[prediction.user_id].trends += score.trendHit ? 1 : 0;
        rows[prediction.user_id].played += 1;
      }
    }

    return Object.values(rows).sort((a, b) => b.points - a.points || b.exacts - a.exacts || b.trends - a.trends || a.name.localeCompare(b.name));
  }, [matches, predictionsByMatch, profiles, results]);

  function setResult(matchId: string, side: "home" | "away", value: string) {
    setResults((current) => ({
      ...current,
      [matchId]: { ...current[matchId], [side]: value === "" ? "" : Number(value) }
    }));
  }

  function setWinner(matchId: string, winner: WinnerSide) {
    setResults((current) => ({
      ...current,
      [matchId]: { ...current[matchId], winner }
    }));
  }

  function updatePodium(field: "champion_team" | "runner_up_team" | "third_place_team", value: string) {
    setPodium((current) => ({ ...current, [field]: value }));
  }

  function copyMyPrediction() {
    if (!sessionUserId) {
      setCopyMessage("Entrá con tu usuario para copiar tu pronóstico.");
      return;
    }

    const mine = predictions.filter((prediction) => prediction.user_id === sessionUserId);
    if (!mine.length) {
      setCopyMessage("Todavía no tenés predicciones cargadas para copiar.");
      return;
    }

    setResults((current) => {
      const next = { ...current };
      for (const prediction of mine) {
        const match = matches.find((item) => item.id === prediction.match_id);
        const savedWinner = prediction.penalty_winner ?? "";
        const winner =
          savedWinner === "HOME" ||
          savedWinner === match?.home_team
            ? "HOME"
            : savedWinner === "AWAY" || savedWinner === match?.away_team
              ? "AWAY"
              : next[prediction.match_id]?.winner ?? "";
        next[prediction.match_id] = {
          ...next[prediction.match_id],
          home: prediction.home_goals,
          away: prediction.away_goals,
          winner
        };
      }
      return next;
    });
    setCopyMessage(`Copié ${mine.length} predicciones y tu podio anticipado al simulador.`);
  }

  function applyBulk() {
    const next = { ...results };
    for (const line of bulk.split(/\r?\n/)) {
      const parsed = parseBulkLine(line.trim());
      if (!parsed) continue;
      const match = matches.find((item) => teamMatchesBulk(item.home_team, parsed.homeTeam) && teamMatchesBulk(item.away_team, parsed.awayTeam));
      if (match) next[match.id] = { ...next[match.id], home: parsed.homeGoals, away: parsed.awayGoals };
    }
    setResults(next);
    setBulkOpen(false);
  }

  function resultCard(match: Match) {
    const result = results[match.id];
    const rawDisplay =
      match.stage === "GROUP"
        ? {
            home: { name: match.home_team, code: match.home_country_code },
            away: { name: match.away_team, code: match.away_country_code }
          }
        : simulated.displays[match.id] ?? {
            home: { name: match.home_team, code: match.home_country_code },
            away: { name: match.away_team, code: match.away_country_code }
          };
    const knockoutBlocked = match.stage !== "GROUP" && (!groupPhaseComplete || isPlaceholderTeam(rawDisplay.home) || isPlaceholderTeam(rawDisplay.away));
    const display = knockoutBlocked
      ? { home: { name: "Por definir" }, away: { name: "Por definir" } }
      : rawDisplay;
    const isKnockoutTie = !knockoutBlocked && match.stage !== "GROUP" && result?.home !== "" && result?.away !== "" && result?.home === result?.away;

    return (
      <div className="grid gap-3 rounded-lg border border-line p-3" key={match.id}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase text-ink/45">Resultado</p>
            <p className="text-xs text-ink/60">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage]} - {formatArgentinaDate(match.kickoff_at)}</p>
          </div>
          <span className="badge">{stageLabels[match.stage] ?? match.stage}</span>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_82px] items-center gap-3 rounded-md bg-field p-2">
            <TeamOrLock team={display.home} />
            <input
              className="field text-center font-black"
              aria-label={`Goles ${display.home.name}`}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              type="text"
              disabled={knockoutBlocked}
              value={knockoutBlocked ? "" : result?.home ?? ""}
              onChange={(event) => {
                if (knockoutBlocked) return;
                const value = parseGoalInput(event.target.value);
                if (value !== null && (value === "" || value <= 30)) setResult(match.id, "home", String(value));
              }}
            />
          </div>
          <div className="grid grid-cols-[1fr_82px] items-center gap-3 rounded-md bg-field p-2">
            <TeamOrLock team={display.away} />
            <input
              className="field text-center font-black"
              aria-label={`Goles ${display.away.name}`}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              type="text"
              disabled={knockoutBlocked}
              value={knockoutBlocked ? "" : result?.away ?? ""}
              onChange={(event) => {
                if (knockoutBlocked) return;
                const value = parseGoalInput(event.target.value);
                if (value !== null && (value === "" || value <= 30)) setResult(match.id, "away", String(value));
              }}
            />
          </div>
        </div>
        {isKnockoutTie && (
          <div className="rounded-lg border border-line bg-field p-3">
            <div className="mb-2 text-xs font-black uppercase text-ink/45">Ganador</div>
            <div className="grid gap-2 sm:grid-cols-2">
            <button className={`btn ${result?.winner === "HOME" ? "" : "secondary"}`} onClick={() => setWinner(match.id, "HOME")} type="button">
              <TeamLabel name={display.home.name} code={display.home.code} />
            </button>
            <button className={`btn ${result?.winner === "AWAY" ? "" : "secondary"}`} onClick={() => setWinner(match.id, "AWAY")} type="button">
              <TeamLabel name={display.away.name} code={display.away.code} />
            </button>
            </div>
          </div>
        )}
        {knockoutBlocked && <p className="text-xs font-bold text-slate-400">Completá todos los partidos de grupos para habilitar esta llave.</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5">
        <span className="badge">Simulador</span>
        <h1 className="mt-3 text-3xl font-black">Probar puntuación con predicciones reales</h1>
        <p className="mt-2 text-ink/70">Cargá resultados simulados, mirá cómo se mueven las tablas y cómo avanzan los equipos en las llaves sin tocar resultados oficiales.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn secondary" onClick={copyMyPrediction} type="button">
            <ClipboardPaste className="h-4 w-4" />
            Copiar mi pronóstico
          </button>
          <button className="btn secondary" onClick={() => setBulkOpen(true)} type="button">
            <Calculator className="h-4 w-4" />
            Carga masiva
          </button>
          {copyMessage && <span className="text-sm font-bold text-ink/65">{copyMessage}</span>}
        </div>
      </section>

      <section className="panel grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Trophy className="h-5 w-5 text-gold" />
            Podio anticipado
          </h2>
          <p className="mt-1 text-sm font-semibold text-ink/60">Completa el podio para copiar tu historia. Los puntos se suman solo cuando haya resultados reales.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["champion_team", "Campeón"],
              ["runner_up_team", "Subcampeón"],
              ["third_place_team", "3er Puesto"]
            ].map(([field, label]) => (
              <label className="grid gap-1 text-sm font-bold text-ink/70" key={field}>
                {label}
                <CountryFilterPicker
                  value={podium[field as keyof typeof podium]}
                  options={teamOptions}
                  onChange={(value) => updatePodium(field as keyof typeof podium, value)}
                />
              </label>
            ))}
          </div>
        </div>
        <span className="inline-flex min-h-11 items-center rounded-lg bg-field px-4 text-base font-black text-ink/55">0 Pts</span>
      </section>

      <section className="panel flex flex-wrap gap-2 p-2">
        {[
          ["todos", "Todos", CircleDot],
          ["cargar", "Grupos", Calculator],
          ["tablas", "Tablas", Table2],
          ["llave", "Llaves", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            className={`btn ${activeTab === key ? "" : "secondary"}`}
            key={key as string}
            onClick={() => setActiveTab(key as "todos" | "cargar" | "tablas" | "llave")}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </section>

      <section className="panel grid gap-2 p-3 sm:grid-cols-[minmax(280px,1fr)_140px_auto] lg:grid-cols-[320px_140px_44px] lg:items-center">
        <CountryFilterPicker className="min-w-[260px]" value={teamFilter} options={teamOptions} onChange={setTeamFilter} />
        <DateFilter value={dateFilter} onChange={setDateFilter} />
        <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => { setTeamFilter(""); setDateFilter(""); }}>
          <X className="h-4 w-4" />
        </button>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4">
          <h2 className="flex items-center gap-2 text-xl font-black"><Trophy className="h-5 w-5 text-gold" />Ranking simulado</h2>
          <p className="mt-1 text-sm font-semibold text-ink/60">Suma puntos por tendencia, exactos y, cuando exista resultado final real, aciertos del podio anticipado.</p>
        </div>
        {ranking.map((row, index) => (
          <div className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-line p-3 last:border-0" key={row.userId}>
            <strong className="text-center text-gold">#{index + 1}</strong>
            <div>
              <strong>{row.name}</strong>
              <p className="text-xs text-ink/60">{row.exacts} exactos - {row.trends} tendencias - {row.played} puntuados</p>
            </div>
            <strong className="text-center">{row.points} Pts</strong>
          </div>
        ))}
      </section>

      {activeTab === "todos" && (
        <section className="grid gap-4">
          <div>
            <h3 className="text-2xl font-black">Todos</h3>
            <p className="mb-3 mt-1 text-sm font-semibold text-ink/60">Todos los partidos del simulador en grilla, filtrables por país y fecha.</p>
          </div>
          <div className="grid gap-5">
            {(["GROUP", ...knockoutOrder] as MatchStage[]).map((stage) => {
              const items = allFilteredByStage[stage] ?? [];
              if (!items.length) return null;
              return (
                <div className="grid gap-3" key={stage}>
                  <h4 className="flex items-center gap-2 text-xl font-black">
                    {stage !== "GROUP" && <Trophy className="h-4 w-4 text-gold" />}
                    {stageLabels[stage]}
                  </h4>
                  <div className="match-card-grid">
                    {items.map((match) => resultCard(match))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "cargar" && (
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

      {activeTab === "cargar" && (
      <section className="grid gap-4">
        <div>
          <h3 className="text-2xl font-black">Partidos de grupos</h3>
          <p className="mb-3 mt-1 text-sm font-semibold text-ink/60">Carga marcadores de prueba y mira como se mueve el torneo simulado.</p>
          <div className="grid gap-4">
            {filteredGroups.map(([group, items]) => (
              <div className="grid gap-3" key={group}>
                <h2 className="text-xl font-black">Grupo {group}</h2>
                <div className="match-card-grid">
                  {items.map((match) => resultCard(match))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn secondary w-fit" onClick={() => setResults(initialResults(matches))} type="button"><RotateCcw className="h-4 w-4" />Reiniciar</button>
      </section>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4">
          <section className="panel w-full max-w-3xl p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black"><ClipboardPaste className="h-5 w-5 text-grass" />Carga masiva</h2>
                <p className="mt-1 text-sm text-ink/60">Pegá el texto de $pronosticos o usá formato por línea: Argentina 2-1 México</p>
              </div>
              <button className="btn secondary min-w-11 px-0" onClick={() => setBulkOpen(false)} type="button" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              className="field mt-4 h-[52vh] min-h-[340px] w-full resize-y py-4 leading-6"
              rows={18}
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button className="btn secondary" onClick={() => setBulkOpen(false)} type="button">Cancelar</button>
              <button className="btn" onClick={applyBulk} type="button"><Calculator className="h-4 w-4" />Aplicar</button>
            </div>
          </section>
        </div>
      )}

      {activeTab === "llave" && (
        <section className="grid gap-4">
          <div className="panel flex flex-wrap gap-2 p-2">
            {availableKnockoutStages.map((item) => (
              <button
                className={`btn ${selectedKnockoutStage === item ? "" : "secondary"}`}
                key={item}
                onClick={() => setActiveKnockoutStage(item)}
                type="button"
              >
                <Trophy className="h-4 w-4" />
                {stageLabels[item]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-lg font-black">
            <Trophy className="h-4 w-4 text-gold" />
            <h2>{selectedKnockoutStage ? stageLabels[selectedKnockoutStage] : "Llaves"}</h2>
          </div>
          <div className="match-card-grid">
            {selectedKnockoutMatches.map((match) => resultCard(match))}
          </div>
        </section>
      )}

      {activeTab === "tablas" && (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map(([group, items]) => {
            const table = simulated.groupTables[group] ?? projectedGroupTable(items, results);
            const completed = items.filter((match) => results[match.id]?.home !== "" && results[match.id]?.away !== "").length;
            return (
              <article className="panel p-4" key={group}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-xl font-black">Grupo {group}</h2>
                  <span className="badge">{completed}/{items.length}</span>
                </div>
                <div className="grid gap-2 text-sm">
                  {table.map((row, index) => (
                    <div className="grid grid-cols-[28px_1fr_40px_40px_40px] items-center gap-2 rounded-lg bg-field p-2" key={`${group}-${row.team}`}>
                      <span className={`font-black ${index < 2 ? "text-grass" : index === 2 ? "text-gold" : "text-ink/45"}`}>{index + 1}</span>
                      <TeamLabel name={row.team} code={row.code} />
                      <strong className="text-center">{row.points}</strong>
                      <span className="text-center text-ink/60">{row.played}</span>
                      <span className="text-center text-ink/60">{row.goalsFor - row.goalsAgainst}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-[28px_1fr_40px_40px_40px] gap-2 px-2 text-[11px] font-bold uppercase text-ink/45">
                  <span />
                  <span>Equipo</span>
                  <span className="text-center">Pts</span>
                  <span className="text-center">PJ</span>
                  <span className="text-center">DG</span>
                </div>
              </article>
            );
          })}
        </section>
      )}

    </div>
  );
}
