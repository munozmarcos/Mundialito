"use client";

import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { formatArgentinaDateTime } from "@/lib/dates";
import { matchStatus } from "@/lib/scoring";
import type { Match, MatchStage, Prediction } from "@/lib/types";
import { Calculator, Check, GitBranch, Lock, LogIn, Save, Table2, Trophy } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type PredictionWithUpdated = Prediction & { updated_at?: string | null };
type WinnerSide = "HOME" | "AWAY";

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
  THIRD_PLACE: "Tercer puesto",
  FINAL: "Final"
};

const knockoutOrder: MatchStage[] = ["R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

function normalizeFilter(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function dateKey(value: string) {
  return value.slice(0, 10);
}

function matchFitsFilters(match: Match, teamFilter: string, dateFilter: string) {
  const team = normalizeFilter(teamFilter);
  const teamOk =
    !team ||
    normalizeFilter(match.home_team).includes(team) ||
    normalizeFilter(match.away_team).includes(team);
  const dateOk = !dateFilter || dateKey(match.kickoff_at) === dateFilter;
  return teamOk && dateOk;
}

function projectedGroupTable(matches: Match[], predictions: Record<string, PredictionWithUpdated>) {
  const rows = new Map<string, GroupRow>();
  const group = matches[0]?.group_name ?? null;
  const ensure = (team: string, code?: string | null) => {
    if (!rows.has(team)) rows.set(team, { team, code, group, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 });
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
    return b.points - a.points || goalDiff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team);
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
  const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null);
  const unavailable = isMatchUnavailable(match, display);
  const locked = status === "locked" || status === "final" || unavailable;
  const [homeGoals, setHomeGoals] = useState(prediction?.home_goals ?? 0);
  const [awayGoals, setAwayGoals] = useState(prediction?.away_goals ?? 0);
  const [winnerSide, setWinnerSide] = useState<WinnerSide | "">(
    prediction?.penalty_winner === "HOME" || prediction?.penalty_winner === "AWAY" ? prediction.penalty_winner : ""
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHomeGoals(prediction?.home_goals ?? 0);
    setAwayGoals(prediction?.away_goals ?? 0);
    setWinnerSide(prediction?.penalty_winner === "HOME" || prediction?.penalty_winner === "AWAY" ? prediction.penalty_winner : "");
  }, [prediction?.home_goals, prediction?.away_goals, prediction?.penalty_winner]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loggedIn || locked) return;
    const needsWinner = match.stage !== "GROUP" && homeGoals === awayGoals;
    if (needsWinner && !winnerSide) {
      setMessage("Elegí ganador.");
      return;
    }
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId: match.id, homeGoals, awayGoals, penaltyWinner: needsWinner ? winnerSide : null })
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
  const hitLabel = prediction?.exact_hit ? "Exacto" : prediction?.trend_hit ? "Tendencia" : hasResult && prediction ? "Sin puntos" : "";
  const pointsText = prediction && hasResult ? `${prediction.points} pts${hitLabel ? ` - ${hitLabel}` : ""}` : hasResult ? "Sin apuesta" : "0 pts";
  const pointsReady = prediction && hasResult;
  const home = display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = display?.away ?? { name: match.away_team, code: match.away_country_code };
  const needsWinner = match.stage !== "GROUP" && homeGoals === awayGoals;

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-ink/60">{formatKickoff(match.kickoff_at)}</span>
        <div className="flex flex-wrap justify-end gap-2">
          {prediction && <span className="badge bg-mint text-grass">Cargado</span>}
          <StatusPill status={unavailable ? "locked" : status} />
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
              min={0}
              max={30}
              type="number"
              value={homeGoals}
              onChange={(event) => setHomeGoals(Number(event.target.value))}
            />
          </div>
          <div className="grid grid-cols-[1fr_68px] items-center gap-3">
            <TeamOrLock team={away} />
            <input
              aria-label={`Goles ${away.name}`}
              className="field text-center font-black"
              disabled={!loggedIn || locked}
              min={0}
              max={30}
              type="number"
              value={awayGoals}
              onChange={(event) => setAwayGoals(Number(event.target.value))}
            />
          </div>
        </div>

        {needsWinner && (
          <div className="rounded-lg border border-line bg-field p-3">
            <div className="mb-2 text-xs font-black uppercase text-ink/45">Ganador</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                className={`btn ${winnerSide === "HOME" ? "" : "secondary"}`}
                disabled={!loggedIn || locked}
                onClick={() => setWinnerSide("HOME")}
                type="button"
              >
                <TeamLabel name={home.name} code={home.code} />
              </button>
              <button
                className={`btn ${winnerSide === "AWAY" ? "" : "secondary"}`}
                disabled={!loggedIn || locked}
                onClick={() => setWinnerSide("AWAY")}
                type="button"
              >
                <TeamLabel name={away.name} code={away.code} />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="rounded-md bg-field p-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block font-bold text-ink/60">Resultado</span>
                <span className="font-black">{realResult}</span>
              </div>
              <div className="text-right">
                <span className="block font-bold text-ink/60">Puntos</span>
                <span className={`font-black ${pointsReady ? "text-grass" : "text-ink/55"}`}>{pointsText}</span>
              </div>
            </div>
          </div>
          <button className="btn min-w-11 px-0" disabled={!loggedIn || locked || saving} title="Guardar predicción" type="submit">
            {message === "Guardada" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          </button>
        </div>
        {unavailable && <p className="text-xs font-bold text-slate-500">Cerrado hasta que se definan los clasificados.</p>}
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

function BracketCard({ match, prediction, display }: { match: Match; prediction?: PredictionWithUpdated; display?: DisplayMatch }) {
  const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null);
  const hasResult = match.home_goals != null && match.away_goals != null;
  const realResult = hasResult ? `${match.home_goals}-${match.away_goals}` : "Pendiente";
  const hitLabel = prediction?.exact_hit ? "Exacto" : prediction?.trend_hit ? "Tendencia" : hasResult && prediction ? "Sin puntos" : "";
  const pointsText = prediction && hasResult ? `${prediction.points} pts${hitLabel ? ` - ${hitLabel}` : ""}` : hasResult ? "Sin apuesta" : "0 pts";
  const pointsReady = prediction && hasResult;
  const home = display?.home ?? { name: match.home_team, code: match.home_country_code };
  const away = display?.away ?? { name: match.away_team, code: match.away_country_code };
  const winner = winnerFromPrediction({ home, away }, prediction);

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-ink/60">{formatKickoff(match.kickoff_at)}</span>
        <div className="flex flex-wrap justify-end gap-2">
          {prediction && <span className="badge bg-mint text-grass">Cargado</span>}
          <StatusPill status={status} />
        </div>
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
          <span className="block font-bold text-ink/60">Puntos</span>
          <span className={`font-black ${pointsReady ? "text-grass" : "text-ink/55"}`}>{pointsText}</span>
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
  const [activeTab, setActiveTab] = useState<"cargar" | "tablas" | "llave">("cargar");
  const [activeKnockoutStage, setActiveKnockoutStage] = useState<MatchStage>("R32");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const predictionMap = useMemo(() => byId(predictions), [predictions]);

  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  const knockoutMatches = matches.filter((match) => match.stage !== "GROUP");
  const byGroup = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const byStage = groupBy(knockoutMatches, (match) => match.stage);
  const availableKnockoutStages = knockoutOrder.filter((stage) => byStage[stage]?.length);
  const selectedKnockoutStage = availableKnockoutStages.includes(activeKnockoutStage) ? activeKnockoutStage : availableKnockoutStages[0];
  const selectedKnockoutMatches = selectedKnockoutStage ? (byStage[selectedKnockoutStage] ?? []).filter((match) => matchFitsFilters(match, teamFilter, dateFilter)) : [];
  const bracket = useMemo(() => deriveBracket(groupMatches, knockoutMatches, predictionMap), [groupMatches, knockoutMatches, predictionMap]);
  const loaded = predictions.length;
  const pending = matches.filter((match) => !predictionMap[match.id] && matchStatus(match.kickoff_at, match.locked, match.home_goals != null) !== "final").length;
  const groupEntries = Object.entries(byGroup).filter(([group]) => groupFilter === "ALL" || group === groupFilter);
  const filteredGroupEntries = groupEntries
    .map(([group, items]) => [group, items.filter((match) => matchFitsFilters(match, teamFilter, dateFilter))] as const)
    .filter(([, items]) => items.length);
  const availableGroups = Object.keys(byGroup).sort();

  async function loadPredictions() {
    const res = await fetch("/api/predictions", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setPredictions(data.predictions ?? []);
  }

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user ?? null);
        if (data.user) void loadPredictions();
        else setPredictions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function upsertSaved(prediction: PredictionWithUpdated) {
    setPredictions((current) => {
      const rest = current.filter((item) => item.match_id !== prediction.match_id);
      return [...rest, prediction];
    });
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
          <span className="text-sm font-bold text-ink/60">Sesion</span>
          <strong className="block truncate text-lg">{user?.displayName || "Sin login"}</strong>
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

      <section className="panel flex flex-wrap gap-2 p-2">
        {[
          ["cargar", "Grupos", Calculator],
          ["tablas", "Tablas", Table2],
          ["llave", "Llaves", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            className={`btn ${activeTab === key ? "" : "secondary"}`}
            key={key as string}
            onClick={() => setActiveTab(key as "cargar" | "tablas" | "llave")}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </section>

      <section className="panel grid gap-3 p-3 md:grid-cols-[180px_1fr_180px_auto]">
        <select className="field" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
          <option value="ALL">Todos los grupos</option>
          {availableGroups.map((group) => (
            <option key={group} value={group}>Grupo {group}</option>
          ))}
        </select>
        <input
          className="field"
          placeholder="Filtrar por seleccion"
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
        />
        <input className="field" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        <button className="btn secondary" type="button" onClick={() => { setGroupFilter("ALL"); setTeamFilter(""); setDateFilter(""); }}>
          Limpiar
        </button>
      </section>

      {activeTab === "cargar" && (
      <section className="grid gap-4">
        <div>
          <h3 className="text-2xl font-black">Partidos de grupos</h3>
          <p className="mb-3 mt-1 text-sm font-semibold text-ink/60">Carga tus marcadores y mira abajo como se mueve tu torneo proyectado.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredGroupEntries.map(([group, items]) => (
              <div className="panel overflow-hidden" key={group}>
                <div className="border-b border-line bg-field p-4">
                  <span className="badge">Grupo {group}</span>
                </div>
                <div className="grid gap-3 p-4">
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
                <span className="badge">Grupo {group}</span>
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
              <div className="panel overflow-hidden">
                <h3 className="flex items-center gap-2 border-b border-line bg-field p-4 text-lg font-black">
                  <Trophy className="h-4 w-4 text-gold" />
                  {selectedKnockoutStage ? stageLabels[selectedKnockoutStage] : "Llaves"}
                </h3>
                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {selectedKnockoutMatches.map((match) => (
                    <PredictionCard
                      match={match}
                      display={bracket.displays[match.id]}
                      loggedIn={Boolean(user)}
                      onSaved={upsertSaved}
                      prediction={predictionMap[match.id]}
                      key={match.id}
                    />
                  ))}
                </div>
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
    </div>
  );
}
