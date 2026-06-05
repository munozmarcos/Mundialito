"use client";

import { EmptyState } from "@/components/empty-state";
import { CountryFilterPicker } from "@/components/country-filter-picker";
import { DateFilter } from "@/components/date-filter";
import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { formatArgentinaDateTime } from "@/lib/dates";
import { displayNameForTeam } from "@/lib/flags";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import { isMatchBlockedUntilOfficial, isPlaceholderTeamName } from "@/lib/match-availability";
import { dateKey, matchFitsBasicFilters } from "@/lib/match-filters";
import { matchStatus } from "@/lib/scoring";
import { teamOptionsFromMatches, type TeamOption } from "@/lib/team-options";
import type { Match, MatchStage, Prediction } from "@/lib/types";
import { Calculator, Check, CircleDot, ClipboardPaste, GitBranch, Lock, LogIn, Save, Table2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type PredictionWithUpdated = Prediction & { updated_at?: string | null };
type PodiumDraft = {
  champion_team?: string | null;
  runner_up_team?: string | null;
  third_place_team?: string | null;
  points?: number | null;
  updated_at?: string | null;
};
type BoardProps = {
  matches: Match[];
  demoMode: boolean;
};

type SessionUser = {
  displayName: string;
  phone: string | null;
  paid: boolean;
};

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

const stageLabels: Record<MatchStage, string> = {
  GROUP: "Grupos",
  R32: "16vos",
  R16: "8vos",
  QF: "4tos",
  SF: "Semis",
  THIRD_PLACE: "3ros",
  FINAL: "Final"
};

const knockoutOrder: MatchStage[] = ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const group = key(item);
    acc[group] ??= [];
    acc[group].push(item);
    return acc;
  }, {});
}

function byId(predictions: PredictionWithUpdated[]) {
  return predictions.reduce<Record<string, PredictionWithUpdated>>((acc, prediction) => {
    acc[prediction.match_id] = prediction;
    return acc;
  }, {});
}

function formatKickoff(value: string) {
  return formatArgentinaDateTime(value);
}

function matchFitsFilters(match: Match, teamFilter: string, dateFilter: string) {
  return matchFitsBasicFilters(match, teamFilter, dateFilter);
}

function parseGoalInput(value: string) {
  if (!/^\d*$/.test(value)) return null;
  if (value === "") return "";
  return Number(value);
}

function parseBulkLine(line: string) {
  const clean = line
    .replace(/\s*\|\s*Ganador:.+$/i, "")
    .replace(/\s+Ganador:.+$/i, "")
    .trim();
  const match = clean.match(/^(.+?)\s+(\d+)\s*[-:]\s*(\d+)\s+(.+)$/);
  if (!match) return null;
  return {
    homeTeam: match[1].trim(),
    homeGoals: Number(match[2]),
    awayGoals: Number(match[3]),
    awayTeam: match[4].trim()
  };
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

function projectedGroupTable(matches: Match[], predictions: Record<string, PredictionWithUpdated>) {
  const rows = new Map<string, GroupRow>();
  const group = matches[0]?.group_name ?? null;
  const ensure = (team: string, code?: string | null) => {
    if (!rows.has(team)) rows.set(team, { team, code, group, order: fifaGroupTeamOrder(group, team, rows.size), played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 });
    return rows.get(team)!;
  };

  for (const match of matches) {
    ensure(match.home_team, match.home_country_code);
    ensure(match.away_team, match.away_country_code);
    const prediction = predictions[match.id];
    if (!prediction) continue;

    const home = ensure(match.home_team, match.home_country_code);
    const away = ensure(match.away_team, match.away_country_code);
    home.played += 1;
    away.played += 1;
    home.goalsFor += prediction.home_goals;
    home.goalsAgainst += prediction.away_goals;
    away.goalsFor += prediction.away_goals;
    away.goalsAgainst += prediction.home_goals;

    if (prediction.home_goals > prediction.away_goals) home.points += 3;
    else if (prediction.away_goals > prediction.home_goals) away.points += 3;
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
  return isPlaceholderTeamName(team.name);
}

function isMatchUnavailable(match: Match, display?: DisplayMatch) {
  if (isMatchBlockedUntilOfficial(match)) return true;
  if (match.stage === "GROUP") return false;
  const home = display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = display?.away ?? { name: match.away_team, code: match.away_country_code };
  return isPlaceholderTeam(home) || isPlaceholderTeam(away);
}

function lockedDisplay(match: Match, display?: DisplayMatch): DisplayMatch | undefined {
  if (match.stage === "GROUP") return display;
  if (!isMatchUnavailable(match, display)) return display;
  return {
    home: { name: isPlaceholderTeamName(match.home_team) ? match.home_team : "Por definir" },
    away: { name: isPlaceholderTeamName(match.away_team) ? match.away_team : "Por definir" }
  };
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

function winnerFromPrediction(display: DisplayMatch, prediction?: PredictionWithUpdated): DisplayTeam | null {
  if (!prediction) return null;
  if (prediction.home_goals > prediction.away_goals) return display.home;
  if (prediction.away_goals > prediction.home_goals) return display.away;
  if (prediction.penalty_winner === "HOME" || prediction.penalty_winner === display.home.name) return display.home;
  if (prediction.penalty_winner === "AWAY" || prediction.penalty_winner === display.away.name) return display.away;
  return null;
}

function loserFromPrediction(display: DisplayMatch, prediction?: PredictionWithUpdated): DisplayTeam | null {
  if (!prediction) return null;
  if (prediction.home_goals > prediction.away_goals) return display.away;
  if (prediction.away_goals > prediction.home_goals) return display.home;
  if (prediction.penalty_winner === "HOME" || prediction.penalty_winner === display.home.name) return display.away;
  if (prediction.penalty_winner === "AWAY" || prediction.penalty_winner === display.away.name) return display.home;
  return null;
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

function deriveBracket(
  groupMatches: Match[],
  knockoutMatches: Match[],
  predictions: Record<string, PredictionWithUpdated>
) {
  const grouped = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const groupTables = Object.fromEntries(
    Object.entries(grouped).map(([group, items]) => [group, projectedGroupTable(items, predictions)])
  );
  const bestThirds = Object.values(groupTables)
    .map((table) => table[2])
    .filter(Boolean)
    .sort((a, b) => {
      const goalDiff = (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
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
    const prediction = predictions[match.id];
    const winner = winnerFromPrediction(display, prediction);
    const loser = loserFromPrediction(display, prediction);
    if (winner) winners[number] = winner;
    if (loser) losers[number] = loser;
  }

  return { displays, groupTables, bestThirds };
}

function PredictionCard({
  match,
  prediction,
  display,
  loggedIn,
  onSaved
}: {
  match: Match;
  prediction?: PredictionWithUpdated;
  display?: DisplayMatch;
  loggedIn: boolean;
  onSaved: (prediction: PredictionWithUpdated) => void;
}) {
  const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status);
  const safeDisplay = lockedDisplay(match, display);
  const unavailable = isMatchUnavailable(match, safeDisplay);
  const locked = status === "locked" || status === "closed" || unavailable;
  const [homeGoals, setHomeGoals] = useState<number | "">(prediction?.home_goals ?? "");
  const [awayGoals, setAwayGoals] = useState<number | "">(prediction?.away_goals ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHomeGoals(prediction?.home_goals ?? "");
    setAwayGoals(prediction?.away_goals ?? "");
  }, [prediction?.home_goals, prediction?.away_goals]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loggedIn || locked) return;
    if (homeGoals === "" || awayGoals === "") {
      setMessage("Carga los dos goles.");
      return;
    }
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId: match.id, homeGoals, awayGoals, penaltyWinner: null })
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudo guardar.");
      return;
    }

    onSaved(data.prediction);
    setMessage("Guardada");
  }

  const hasResult = match.home_goals != null && match.away_goals != null;
  const realResult = hasResult ? `${match.home_goals}-${match.away_goals}` : "Pendiente";
  const pointsText = prediction && hasResult ? `${prediction.points} Pts` : hasResult ? "Sin apuesta" : "0 Pts";
  const pointsReady = prediction && hasResult;
  const home = safeDisplay?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = safeDisplay?.away ?? { name: match.away_team, code: match.away_country_code };
  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="badge">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage]}</span>
          <p className="mt-2 text-xs font-bold text-ink/60">{formatKickoff(match.kickoff_at)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {prediction?.updated_at && <span className="self-center text-[11px] italic text-ink/45">Actualizado - {formatKickoff(prediction.updated_at)}</span>}
          <StatusPill status={unavailable ? "locked" : status} label={unavailable ? "Bloqueado" : undefined} />
        </div>
      </div>

      <form className="grid gap-3" onSubmit={save}>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_68px] items-center gap-3">
            <TeamOrLock team={home} />
            <input
              aria-label={`Goles ${home.name}`}
              className="field text-center font-black"
              disabled={!loggedIn || locked}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              type="text"
              value={homeGoals}
              onChange={(event) => {
                const value = parseGoalInput(event.target.value);
                if (value !== null && (value === "" || value <= 30)) setHomeGoals(value);
              }}
            />
          </div>
          <div className="grid grid-cols-[1fr_68px] items-center gap-3">
            <TeamOrLock team={away} />
            <input
              aria-label={`Goles ${away.name}`}
              className="field text-center font-black"
              disabled={!loggedIn || locked}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              type="text"
              value={awayGoals}
              onChange={(event) => {
                const value = parseGoalInput(event.target.value);
                if (value !== null && (value === "" || value <= 30)) setAwayGoals(value);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="rounded-md bg-field p-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block font-bold text-ink/60">Resultado</span>
                <span className="font-black">{realResult}</span>
              </div>
              <div className="text-right">
                <span className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-black ${pointsReady ? "bg-mint text-grass" : "bg-field text-ink/55"}`}>{pointsText}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn min-w-11 px-0" disabled={!loggedIn || locked || saving} title="Guardar prediccion" type="submit">
              {message === "Guardada" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {unavailable && <p className="text-xs font-bold text-slate-500">Bloqueado hasta que se definan los clasificados.</p>}
        {message && <p className="text-xs font-bold text-grass">{message}</p>}
      </form>
    </article>
  );
}

function GroupProjection({ group, matches, predictions }: { group: string; matches: Match[]; predictions: Record<string, PredictionWithUpdated> }) {
  const table = projectedGroupTable(matches, predictions);
  const completed = matches.filter((match) => predictions[match.id]).length;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-field p-3">
        <h4 className="font-black">Tabla proyectada</h4>
        <span className="badge">{completed}/{matches.length}</span>
      </div>
      <div className="grid gap-2 p-3 text-xs">
        {table.map((row, index) => (
          <div className="grid grid-cols-[32px_1fr_34px_34px_34px] items-center gap-2 rounded-lg border border-line bg-white p-2" key={`${group}-${row.team}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full font-black ${index < 2 ? "bg-mint text-grass" : index === 2 ? "bg-amber-50 text-gold" : "bg-field text-ink/45"}`}>{index + 1}</span>
            <TeamLabel name={row.team} code={row.code} />
            <span className="text-center font-bold">{row.points}</span>
            <span className="text-center text-ink/60">{row.played}</span>
            <span className="text-center text-ink/60">{row.goalsFor - row.goalsAgainst}</span>
          </div>
        ))}
        <div className="grid grid-cols-[32px_1fr_34px_34px_34px] gap-2 px-2 text-[11px] font-bold uppercase text-ink/45">
          <span />
          <span>Equipo</span>
          <span className="text-center">Pts</span>
          <span className="text-center">PJ</span>
          <span className="text-center">DG</span>
        </div>
      </div>
    </div>
  );
}

function PodiumPicker({
  label,
  value,
  disabled,
  teams,
  onChange
}: {
  label: string;
  value: string;
  disabled: boolean;
  teams: TeamOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative grid gap-1 text-sm font-bold text-ink/70">
      <span>{label}</span>
      <CountryFilterPicker disabled={disabled} options={teams} value={value} onChange={onChange} />
    </div>
  );
}

function BracketCard({ match, prediction, display }: { match: Match; prediction?: PredictionWithUpdated; display?: DisplayMatch }) {
  const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status);
  const hasResult = match.home_goals != null && match.away_goals != null;
  const realResult = hasResult ? `${match.home_goals}-${match.away_goals}` : "Pendiente";
  const pointsText = prediction && hasResult ? `${prediction.points} Pts` : hasResult ? "Sin apuesta" : "0 Pts";
  const pointsReady = prediction && hasResult;
  const home = display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = display?.away ?? { name: match.away_team, code: match.away_country_code };
  const winner = winnerFromPrediction({ home, away }, prediction);

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-ink/60">{formatKickoff(match.kickoff_at)}</span>
        <StatusPill status={status} />
      </div>
      <div className="grid gap-2">
        <div className={`flex items-center justify-between gap-3 rounded-md p-2 ${winner?.name === home.name ? "bg-mint" : "bg-field"}`}>
          <TeamOrLock team={home} />
          <span className="flex items-center gap-2 text-xs font-bold text-ink/40">
            {winner?.name === home.name && <span className="badge">Ganador</span>}
            {match.home_goals ?? ""}
          </span>
        </div>
        <div className={`flex items-center justify-between gap-3 rounded-md p-2 ${winner?.name === away.name ? "bg-mint" : "bg-field"}`}>
          <TeamOrLock team={away} />
          <span className="flex items-center gap-2 text-xs font-bold text-ink/40">
            {winner?.name === away.name && <span className="badge">Ganador</span>}
            {match.away_goals ?? ""}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-field p-2">
          <span className="block font-bold text-ink/60">Resultado</span>
          <span className="font-black">{realResult}</span>
          {prediction && <span className="block text-ink/55">Apuesta: {prediction.home_goals}-{prediction.away_goals}</span>}
          {winner && prediction?.home_goals === prediction?.away_goals && <span className="block font-black text-grass">Ganador: {winner.name}</span>}
        </div>
        <div className="rounded-md bg-field p-2 text-right">
          <span className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-black ${pointsReady ? "bg-mint text-grass" : "bg-field text-ink/55"}`}>{pointsText}</span>
        </div>
      </div>
      {match.stadium && <p className="mt-2 text-xs font-semibold text-ink/55">{match.stadium}</p>}
    </article>
  );
}

export function PredictionBoard({ matches, demoMode }: BoardProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [predictions, setPredictions] = useState<PredictionWithUpdated[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"todos" | "cargar" | "tablas" | "llave">("todos");
  const [activeKnockoutStage, setActiveKnockoutStage] = useState<MatchStage>("R32");
  const [activeGroup, setActiveGroup] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [podium, setPodium] = useState<PodiumDraft | null>(null);
  const [podiumLocked, setPodiumLocked] = useState(false);
  const [podiumLockReason, setPodiumLockReason] = useState<string | null>(null);
  const [podiumMessage, setPodiumMessage] = useState("");
  const [podiumSaving, setPodiumSaving] = useState(false);
  const predictionMap = useMemo(() => byId(predictions), [predictions]);

  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  const knockoutMatches = matches.filter((match) => match.stage !== "GROUP");
  const byGroup = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const byStage = groupBy(knockoutMatches, (match) => match.stage);
  const bracket = useMemo(() => deriveBracket(groupMatches, knockoutMatches, predictionMap), [groupMatches, knockoutMatches, predictionMap]);
  const availableKnockoutStages = knockoutOrder.filter((stage) => byStage[stage]?.length);
  const selectedKnockoutStage = availableKnockoutStages.includes(activeKnockoutStage) ? activeKnockoutStage : availableKnockoutStages[0];
  const selectedKnockoutMatches = selectedKnockoutStage ? (byStage[selectedKnockoutStage] ?? []).filter((match) => matchFitsFilters(match, teamFilter, dateFilter)) : [];
  const allFilteredMatches = matches.filter((match) => matchFitsFilters(match, teamFilter, dateFilter));
  const teamOptions = useMemo(() => teamOptionsFromMatches(groupMatches), [groupMatches]);
  const loaded = predictions.length;
  const pending = matches.filter((match) => {
    if (predictionMap[match.id]) return false;
    if (isMatchUnavailable(match)) return false;
    return matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status) === "open" || matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status) === "closing_soon";
  }).length;
  const podiumPossiblePoints = podium?.champion_team && podium.runner_up_team && podium.third_place_team && !podium.points ? 6 : (podium?.points ?? 0);
  const totalPoints = predictions.reduce((sum, prediction) => sum + (prediction.points ?? 0), 0) + podiumPossiblePoints;
  const availableGroups = Object.keys(byGroup).sort();
  const selectedGroup = activeGroup && availableGroups.includes(activeGroup) ? activeGroup : availableGroups[0];
  const groupEntries = activeTab === "tablas" ? Object.entries(byGroup) : selectedGroup ? Object.entries(byGroup).filter(([group]) => group === selectedGroup) : [];
  const filteredGroupEntries = groupEntries
    .map(([group, items]) => [group, items.filter((match) => matchFitsFilters(match, teamFilter, dateFilter))] as const)
    .filter(([, items]) => items.length);

  async function loadPredictions() {
    const res = await fetch("/api/predictions", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setPredictions(data.predictions ?? []);
  }

  async function loadPodium() {
    const res = await fetch("/api/podium", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setPodium(data.podium ?? { champion_team: "", runner_up_team: "", third_place_team: "", points: 0 });
      setPodiumLocked(Boolean(data.locked));
      setPodiumLockReason(data.reason ?? null);
    }
  }

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user ?? null);
        if (data.user) {
          void loadPredictions();
          void loadPodium();
        } else {
          setPredictions([]);
          setPodium(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function upsertSaved(prediction: PredictionWithUpdated) {
    setPredictions((current) => {
      const rest = current.filter((item) => item.match_id !== prediction.match_id);
      return [...rest, prediction];
    });
  }

  function matchIsEditable(match: Match, display?: DisplayMatch) {
    if (!user) return false;
    const safeDisplay = lockedDisplay(match, display);
    if (isMatchUnavailable(match, safeDisplay)) return false;
    const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null, new Date(), match.status);
    return status === "open" || status === "closing_soon";
  }

  async function applyBulk() {
    if (!user) {
      setBulkMessage("Entra con tu usuario para cargar pronosticos.");
      return;
    }

    const lines = bulk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let saved = 0;
    let skipped = 0;
    let invalid = 0;
    const savedPredictions: PredictionWithUpdated[] = [];

    for (const line of lines) {
      const parsed = parseBulkLine(line);
      if (!parsed) {
        invalid += 1;
        continue;
      }

      const match = matches.find((item) => {
        const display = item.stage === "GROUP" ? undefined : bracket.displays[item.id];
        const home = display?.home.name ?? item.home_team;
        const away = display?.away.name ?? item.away_team;
        return teamMatchesBulk(home, parsed.homeTeam) && teamMatchesBulk(away, parsed.awayTeam);
      });

      if (!match || !matchIsEditable(match, match.stage === "GROUP" ? undefined : bracket.displays[match.id])) {
        skipped += 1;
        continue;
      }

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          homeGoals: parsed.homeGoals,
          awayGoals: parsed.awayGoals,
          penaltyWinner: null
        })
      });
      const data = await res.json();

      if (!res.ok) {
        skipped += 1;
        continue;
      }

      saved += 1;
      savedPredictions.push(data.prediction);
    }

    if (savedPredictions.length) {
      setPredictions((current) => {
        const savedByMatch = byId(savedPredictions);
        const rest = current.filter((item) => !savedByMatch[item.match_id]);
        return [...rest, ...savedPredictions];
      });
    }

    setBulkMessage(`Cargadas: ${saved}. Omitidas: ${skipped}. Lineas invalidas: ${invalid}.`);
    if (saved > 0) {
      setBulk("");
      setBulkOpen(false);
    }
  }

  async function savePodium() {
    if (!user) {
      setPodiumMessage("Entra con tu usuario para guardar el podio.");
      return;
    }

    setPodiumSaving(true);
    setPodiumMessage("");
    try {
      const res = await fetch("/api/podium", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          championTeam: podium?.champion_team || null,
          runnerUpTeam: podium?.runner_up_team || null,
          thirdPlaceTeam: podium?.third_place_team || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el podio.");
      setPodium(data.podium);
      setPodiumLocked(Boolean(data.locked));
      setPodiumLockReason(data.reason ?? null);
      setPodiumMessage("Podio guardado.");
    } catch (error) {
      setPodiumMessage(error instanceof Error ? error.message : "No se pudo guardar el podio.");
    } finally {
      setPodiumSaving(false);
    }
  }

  function updatePodium(field: keyof PodiumDraft, value: string) {
    setPodium((current) => ({ ...(current ?? {}), [field]: value }));
  }

  if (!matches.length) return <EmptyState title="Sin partidos" text="Carga el calendario para ver el prode completo." />;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Predicciones cargadas</span>
          <strong className="block text-3xl">{loaded}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Pendientes</span>
          <strong className="block text-3xl">{pending}</strong>
        </div>
        <div className="panel p-4">
          <span className="text-sm font-bold text-ink/60">Puntos acumulados</span>
          <strong className="block text-3xl">{totalPoints} Pts</strong>
        </div>
      </section>
      {!user && !loading && (
        <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm font-semibold text-ink/70">Para guardar tus predicciones desde la web, entra con apodo y WhatsApp.</p>
          <Link className="btn" href="/login">
            <LogIn className="h-4 w-4" />
            Entrar
          </Link>
        </section>
      )}

      {demoMode && <p className="text-sm font-semibold text-gold">Partidos de muestra.</p>}

      <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-xl font-black">Carga rapida</h2>
          <p className="mt-1 text-sm font-semibold text-ink/60">Pega un bloque de pronosticos y guardalos de una sola vez.</p>
        </div>
        <button className="btn secondary" onClick={() => setBulkOpen(true)} type="button">
          <ClipboardPaste className="h-4 w-4" />
          Carga masiva
        </button>
        {bulkMessage && <p className="basis-full text-sm font-bold text-grass">{bulkMessage}</p>}
      </section>

      <section className="panel grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Trophy className="h-5 w-5 text-gold" />
              Podio anticipado
            </h2>
            {podiumLocked && <span className="badge bg-field text-sky-100">Cerrado</span>}
          </div>
          <p className="mt-1 text-sm font-semibold text-ink/60">
            Elegí tu podio antes de que se habiliten los 16vos.
          </p>
          {podiumLockReason && <p className="mt-2 text-sm font-bold text-sky-200">{podiumLockReason}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["champion_team", "Campeon"],
              ["runner_up_team", "Subcampeon"],
              ["third_place_team", "Tercero"]
            ].map(([field, label]) => (
              <PodiumPicker
                disabled={!user || podiumLocked}
                key={field}
                label={label}
                teams={teamOptions}
                value={(podium?.[field as keyof PodiumDraft] as string | null | undefined) ?? ""}
                onChange={(value) => updatePodium(field as keyof PodiumDraft, value)}
              />
            ))}
          </div>
          {podiumMessage && <p className="mt-3 text-sm font-bold text-grass">{podiumMessage}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="inline-flex min-h-11 items-center rounded-lg bg-field px-4 text-base font-black text-ink/55">{podiumPossiblePoints} Pts</span>
          <button className="btn" disabled={!user || podiumSaving || podiumLocked} onClick={savePodium} type="button">
            <Save className="h-4 w-4" />
            {podiumSaving ? "Guardando" : "Guardar"}
          </button>
        </div>
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

      <section className="panel grid gap-2 p-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto] lg:grid-cols-[240px_112px_44px] lg:items-center">
        <CountryFilterPicker value={teamFilter} options={teamOptions} onChange={setTeamFilter} />
        <DateFilter value={dateFilter} onChange={setDateFilter} />
        <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => { setTeamFilter(""); setDateFilter(""); }}>
          <X className="h-4 w-4" />
        </button>
      </section>

      {activeTab === "todos" && (
        <section className="grid gap-4">
          <div>
            <h3 className="text-2xl font-black">Todos</h3>
            <p className="mb-3 mt-1 text-sm font-semibold text-ink/60">Todos los partidos en grilla, filtrables por pais y fecha.</p>
          </div>
          <div className="match-card-grid">
            {allFilteredMatches.map((match) => (
              <PredictionCard
                display={match.stage === "GROUP" ? undefined : bracket.displays[match.id]}
                loggedIn={Boolean(user)}
                match={match}
                onSaved={upsertSaved}
                prediction={predictionMap[match.id]}
                key={match.id}
              />
            ))}
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
          <p className="mb-3 mt-1 text-sm font-semibold text-ink/60">Carga tus marcadores y mira abajo como se mueve tu torneo proyectado.</p>
          <div className="grid gap-4">
            {filteredGroupEntries.map(([group, items]) => (
              <div className="grid gap-3" key={group}>
                <h4 className="text-xl font-black">Grupo {group}</h4>
                <div className="match-card-grid">
                  {items.map((match) => (
                    <PredictionCard loggedIn={Boolean(user)} match={match} onSaved={upsertSaved} prediction={predictionMap[match.id]} key={match.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>
      )}

      {activeTab === "tablas" && (
      <section className="grid gap-4">
        <div>
          <h2 className="mb-3 text-2xl font-black">Tablas proyectadas</h2>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredGroupEntries.map(([group, items]) => (
              <div className="panel overflow-hidden p-4" key={`table-${group}`}>
                <h3 className="text-xl font-black">Grupo {group}</h3>
                <GroupProjection group={group} matches={items} predictions={predictionMap} />
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {activeTab === "llave" && (
      <section className="grid gap-4">
        <div>
          <h2 className="mb-3 text-2xl font-black">Llaves del Mundial</h2>
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
                  <PredictionCard
                    match={match}
                    loggedIn={Boolean(user)}
                    onSaved={upsertSaved}
                    prediction={predictionMap[match.id]}
                    key={match.id}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="panel p-6 text-sm text-ink/70">
              Las llaves aparecen cuando esten disponibles los cruces de cada fase.
            </div>
          )}
        </div>
      </section>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4">
          <section className="panel w-full max-w-3xl p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <ClipboardPaste className="h-5 w-5 text-grass" />
                  Carga masiva
                </h2>
                <p className="mt-1 text-sm text-ink/60">Pega el texto de $pronosticos o usa formato por linea: Argentina 2-1 Mexico</p>
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
              <button className="btn" onClick={applyBulk} type="button">
                <Calculator className="h-4 w-4" />
                Aplicar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
