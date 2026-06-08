"use client";

import { TeamLabel } from "@/components/team-label";
import { PointsPill } from "@/components/points-pill";
import { countryCodeForTeam, displayNameForTeam } from "@/lib/flags";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import { isMatchBlockedUntilOfficial, isPlaceholderTeamName } from "@/lib/match-availability";
import { scorePrediction } from "@/lib/scoring";
import type { Match, MatchStage, Prediction, Profile } from "@/lib/types";
import { Calculator, GitBranch, Medal, Save, Table2, Trash2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

type AdminPrediction = Prediction & { profiles?: Pick<Profile, "display_name"> | null };
type AdminPodium = {
  user_id: string;
  champion_team?: string | null;
  runner_up_team?: string | null;
  third_place_team?: string | null;
  champion_points?: number | null;
  runner_up_points?: number | null;
  third_place_points?: number | null;
  points?: number | null;
};

type Props = {
  initialMatches: Match[];
  profiles: Profile[];
  predictions: AdminPrediction[];
  podiums: AdminPodium[];
};

type ScoreDraft = Record<string, { home: number | ""; away: number | ""; penaltyWinner?: string | null }>;
type PredictionDraft = Record<string, { home: number | ""; away: number | ""; penaltyWinner?: string | null }>;
type PodiumDraft = Record<string, { championTeam: string; runnerUpTeam: string; thirdPlaceTeam: string }>;

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

function initialScores(matches: Match[]) {
  return matches.reduce<ScoreDraft>((acc, match) => {
    acc[match.id] = { home: match.home_goals ?? "", away: match.away_goals ?? "", penaltyWinner: match.penalty_winner ?? null };
    return acc;
  }, {});
}

function predictionKey(userId: string, matchId: string) {
  return `${userId}:${matchId}`;
}

function initialPredictionDrafts(predictions: AdminPrediction[]) {
  return predictions.reduce<PredictionDraft>((acc, prediction) => {
    acc[predictionKey(prediction.user_id, prediction.match_id)] = {
      home: prediction.home_goals,
      away: prediction.away_goals,
      penaltyWinner: prediction.penalty_winner ?? null
    };
    return acc;
  }, {});
}

function parseGoalInput(value: string) {
  if (!/^\d*$/.test(value)) return null;
  if (value === "") return "";
  return Number(value);
}

function initialPodiumDrafts(podiums: AdminPodium[]) {
  return podiums.reduce<PodiumDraft>((acc, podium) => {
    acc[podium.user_id] = {
      championTeam: podium.champion_team ?? "",
      runnerUpTeam: podium.runner_up_team ?? "",
      thirdPlaceTeam: podium.third_place_team ?? ""
    };
    return acc;
  }, {});
}

function flagEmoji(team: string) {
  const code = countryCodeForTeam(team);
  if (!code) return "🏳️";
  if (code === "gb-eng") return "🏴";
  if (code === "gb-sct") return "🏴";
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

export function AdminResultsControl({ initialMatches, profiles, predictions, podiums }: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [scores, setScores] = useState<ScoreDraft>(() => initialScores(initialMatches));
  const [drafts, setDrafts] = useState<PredictionDraft>(() => initialPredictionDrafts(predictions));
  const [podiumRows, setPodiumRows] = useState<AdminPodium[]>(podiums);
  const [podiumDrafts, setPodiumDrafts] = useState<PodiumDraft>(() => initialPodiumDrafts(podiums));
  const [activeTab, setActiveTab] = useState<"podio" | "grupos" | "tablas" | "llaves">("grupos");
  const [activeGroup, setActiveGroup] = useState("");
  const [activeKnockoutStage, setActiveKnockoutStage] = useState<MatchStage>("R32");
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatches[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const groupMatches = matches.filter((match) => match.stage === "GROUP");
  const knockoutMatches = matches.filter((match) => match.stage !== "GROUP");
  const byGroup = groupBy(groupMatches, (match) => match.group_name || "Sin grupo");
  const byStage = groupBy(knockoutMatches, (match) => match.stage);
  const availableGroups = Object.keys(byGroup).sort();
  const selectedGroup = activeGroup && availableGroups.includes(activeGroup) ? activeGroup : availableGroups[0];
  const availableKnockoutStages = knockoutOrder.filter((stage) => byStage[stage]?.length);
  const selectedKnockoutStage = availableKnockoutStages.includes(activeKnockoutStage) ? activeKnockoutStage : availableKnockoutStages[0];
  const tabMatches =
    activeTab === "llaves"
      ? selectedKnockoutStage ? byStage[selectedKnockoutStage] ?? [] : []
      : selectedGroup ? byGroup[selectedGroup] ?? [] : groupMatches;
  const selectedMatch = tabMatches.find((match) => match.id === selectedMatchId) ?? tabMatches[0] ?? matches[0];
  const predictionMap = useMemo(() => {
    return predictions.reduce<Record<string, AdminPrediction>>((acc, prediction) => {
      acc[predictionKey(prediction.user_id, prediction.match_id)] = prediction;
      return acc;
    }, {});
  }, [predictions]);
  const podiumMap = useMemo(() => {
    return podiumRows.reduce<Record<string, AdminPodium>>((acc, podium) => {
      acc[podium.user_id] = podium;
      return acc;
    }, {});
  }, [podiumRows]);
  const teamOptions = useMemo(() => {
    const teams = new Map<string, string>();
    for (const match of matches) {
      if (match.home_team && !isPlaceholderTeamName(match.home_team)) teams.set(match.home_team, displayNameForTeam(match.home_team));
      if (match.away_team && !isPlaceholderTeamName(match.away_team)) teams.set(match.away_team, displayNameForTeam(match.away_team));
    }
    return [...teams.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [matches]);

  function updateLocalMatch(matchId: string, patch: Partial<Match>) {
    setMatches((current) => current.map((match) => (match.id === matchId ? { ...match, ...patch } : match)));
  }

  async function request(path: string, method: string, body: unknown) {
    const res = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
    return data;
  }

  async function saveResult(match: Match) {
    const score = scores[match.id];
    if (!score || score.home === "" || score.away === "") {
      setMessage("Carga ambos goles antes de guardar el resultado.");
      return;
    }
    if (match.stage !== "GROUP" && score.home === score.away && !score.penaltyWinner) {
      setMessage("En eliminatorias empatadas tenés que marcar el ganador.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await request("/api/results", "POST", { matchId: match.id, homeGoals: score.home, awayGoals: score.away, penaltyWinner: score.penaltyWinner ?? null });
      updateLocalMatch(match.id, { home_goals: score.home, away_goals: score.away, penalty_winner: score.penaltyWinner ?? null, locked: true, status: "closed" });
      const notification = await request("/api/admin/run-job", "POST", { path: "/api/jobs/notify-results", matchId: match.id });
      setMessage(`Resultado guardado y puntos recalculados. WhatsApp enviados: ${notification.data?.sent ?? 0}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function changeState(match: Match, action: "lock" | "block" | "open" | "clear") {
    setSaving(true);
    setMessage("");
    try {
      await request("/api/results", "PATCH", { matchId: match.id, action });
      if (action === "lock") updateLocalMatch(match.id, { locked: true, status: "closed" });
      if (action === "block") updateLocalMatch(match.id, { locked: true, status: "locked" });
      if (action === "open") updateLocalMatch(match.id, { locked: false, status: "open" });
      if (action === "clear") {
        updateLocalMatch(match.id, { locked: false, status: "open", home_goals: null, away_goals: null, penalty_winner: null });
        setScores((current) => ({ ...current, [match.id]: { home: "", away: "", penaltyWinner: null } }));
      }
      setMessage(action === "lock" ? "Partido cerrado." : action === "block" ? "Partido bloqueado." : action === "open" ? "Partido abierto." : "Resultado eliminado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function savePrediction(userId: string, matchId: string) {
    const draft = drafts[predictionKey(userId, matchId)];
    if (!draft || draft.home === "" || draft.away === "") {
      setMessage("Carga ambos goles de la apuesta.");
      return;
    }
    const match = matches.find((item) => item.id === matchId);
    if (match?.stage !== "GROUP" && draft.home === draft.away && !draft.penaltyWinner) {
      setMessage("En apuestas empatadas de eliminatorias tenés que marcar el ganador.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await request("/api/admin/predictions", "PUT", { userId, matchId, homeGoals: draft.home, awayGoals: draft.away, penaltyWinner: draft.penaltyWinner ?? null });
      setMessage("Apuesta guardada y puntos recalculados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePrediction(userId: string, matchId: string) {
    setSaving(true);
    setMessage("");
    try {
      await request("/api/admin/predictions", "DELETE", { userId, matchId });
      setDrafts((current) => ({ ...current, [predictionKey(userId, matchId)]: { home: "", away: "", penaltyWinner: null } }));
      setMessage("Apuesta eliminada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  }

  async function savePodium(userId: string) {
    const draft = podiumDrafts[userId] ?? { championTeam: "", runnerUpTeam: "", thirdPlaceTeam: "" };
    const chosen = [draft.championTeam, draft.runnerUpTeam, draft.thirdPlaceTeam].filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      setMessage("No se puede repetir selección en el podio.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const data = await request("/api/admin/podium", "PUT", {
        userId,
        championTeam: draft.championTeam || null,
        runnerUpTeam: draft.runnerUpTeam || null,
        thirdPlaceTeam: draft.thirdPlaceTeam || null
      });
      setPodiumRows((current) => {
        const next = current.filter((row) => row.user_id !== userId);
        return [...next, data.podium];
      });
      setMessage("Podio anticipado guardado y puntos recalculados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePodium(userId: string) {
    setSaving(true);
    setMessage("");
    try {
      await request("/api/admin/podium", "DELETE", { userId });
      setPodiumRows((current) => current.filter((row) => row.user_id !== userId));
      setPodiumDrafts((current) => ({ ...current, [userId]: { championTeam: "", runnerUpTeam: "", thirdPlaceTeam: "" } }));
      setMessage("Podio anticipado eliminado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  }

  function podiumSelect(userId: string, field: keyof PodiumDraft[string]) {
    const draft = podiumDrafts[userId] ?? { championTeam: "", runnerUpTeam: "", thirdPlaceTeam: "" };
    return (
      <select
        className="field h-11 text-center font-bold"
        disabled={saving}
        value={draft[field]}
        onChange={(event) => setPodiumDrafts((current) => ({ ...current, [userId]: { ...draft, [field]: event.target.value } }))}
      >
        <option value="">Selección</option>
        {teamOptions.map(([team, label]) => (
          <option key={team} value={team}>
            {flagEmoji(team)} {label}
          </option>
        ))}
      </select>
    );
  }

  function matchButton(match: Match) {
    const score = scores[match.id];
    const selected = selectedMatch.id === match.id;
    const blocked = isMatchBlockedUntilOfficial(match);
    const tieNeedsWinner =
      match.stage !== "GROUP" &&
      score?.home !== "" &&
      score?.away !== "" &&
      score?.home === score?.away;
    const statusText = match.status as string;
    const statusValue = blocked || statusText === "locked" || statusText === "scheduled" ? "blocked" : statusText === "closed" || statusText === "final" || match.locked ? "closed" : "open";
    return (
      <article
        className={`rounded-lg border p-3 shadow-sm transition ${selected ? "border-grass bg-field ring-2 ring-grass/35" : "border-line bg-field hover:border-grass/60"}`}
        key={match.id}
        onClick={() => setSelectedMatchId(match.id)}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-ink/55">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage]}</span>
          <select
            className="field min-h-9 w-28 px-2 text-xs font-black"
            disabled={saving}
            value={statusValue}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "open") void changeState(match, "open");
              if (value === "closed") void changeState(match, "lock");
              if (value === "blocked") void changeState(match, "block");
            }}
          >
            <option value="open">Abierto</option>
            <option value="closed">Cerrado</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>

        <div className="grid gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3 rounded-lg border border-line bg-slate-950/25 p-2">
            <TeamLabel name={match.home_team} code={match.home_country_code} />
            <input
              className="field h-10 px-2 text-center font-black"
              disabled={saving}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              type="text"
              value={score?.home ?? ""}
              onChange={(event) => {
                const value = parseGoalInput(event.target.value);
                if (value !== null && (value === "" || value <= 30)) setScores((current) => ({ ...current, [match.id]: { ...current[match.id], home: value } }));
              }}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3 rounded-lg border border-line bg-slate-950/25 p-2">
            <TeamLabel name={match.away_team} code={match.away_country_code} />
            <input
              className="field h-10 px-2 text-center font-black"
              disabled={saving}
              inputMode="numeric"
              maxLength={2}
              pattern="[0-9]*"
              type="text"
              value={score?.away ?? ""}
              onChange={(event) => {
                const value = parseGoalInput(event.target.value);
                if (value !== null && (value === "" || value <= 30)) setScores((current) => ({ ...current, [match.id]: { ...current[match.id], away: value } }));
              }}
            />
          </div>
        </div>

        {tieNeedsWinner && (
          <div className="mt-3 grid gap-2 rounded-lg border border-line bg-slate-950/25 p-2">
            <span className="text-xs font-black uppercase text-ink/45">Ganador</span>
            <div className="flex flex-wrap gap-2">
              <button
                className={`btn min-h-9 ${score?.penaltyWinner === match.home_team ? "" : "secondary"}`}
                disabled={saving}
                onClick={(event) => {
                  event.stopPropagation();
                  setScores((current) => ({ ...current, [match.id]: { ...current[match.id], penaltyWinner: match.home_team } }));
                }}
                type="button"
              >
                <TeamLabel name={match.home_team} code={match.home_country_code} />
              </button>
              <button
                className={`btn min-h-9 ${score?.penaltyWinner === match.away_team ? "" : "secondary"}`}
                disabled={saving}
                onClick={(event) => {
                  event.stopPropagation();
                  setScores((current) => ({ ...current, [match.id]: { ...current[match.id], penaltyWinner: match.away_team } }));
                }}
                type="button"
              >
                <TeamLabel name={match.away_team} code={match.away_country_code} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn min-h-9 px-3"
            disabled={saving}
            onClick={(event) => {
              event.stopPropagation();
              void saveResult(match);
            }}
            type="button"
          >
            <Save className="h-4 w-4" />
            Guardar
          </button>
          <button
            className="btn secondary min-h-9 px-3"
            disabled={saving}
            onClick={(event) => {
              event.stopPropagation();
              void changeState(match, "clear");
            }}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </article>
    );
  }

  const groupTables = useMemo(() => {
    const rowsByGroup = new Map<string, Map<string, { team: string; code?: string | null; order: number; points: number; played: number; diff: number }>>();
    for (const match of matches.filter((item) => item.stage === "GROUP")) {
      const group = match.group_name || "Sin grupo";
      if (!rowsByGroup.has(group)) rowsByGroup.set(group, new Map());
      const rows = rowsByGroup.get(group)!;
      const ensure = (team: string, code?: string | null) => {
        if (!rows.has(team)) rows.set(team, { team, code, order: fifaGroupTeamOrder(group, team, rows.size), points: 0, played: 0, diff: 0 });
        return rows.get(team)!;
      };
      const home = ensure(match.home_team, match.home_country_code);
      const away = ensure(match.away_team, match.away_country_code);
      const score = scores[match.id];
      if (!score || score.home === "" || score.away === "") continue;
      home.played += 1;
      away.played += 1;
      home.diff += score.home - score.away;
      away.diff += score.away - score.home;
      if (score.home > score.away) home.points += 3;
      else if (score.away > score.home) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    }
    return [...rowsByGroup.entries()].map(([group, rows]) => ({
      group,
      rows: [...rows.values()].sort((a, b) => b.points - a.points || b.diff - a.diff || a.order - b.order)
    }));
  }, [matches, scores]);
  if (!selectedMatch) return null;
  return (
    <div className="grid gap-4">
      <section className="panel flex flex-wrap gap-2 p-2">
        {[
          ["podio", "Podio", Medal],
          ["grupos", "Grupos", Calculator],
          ["tablas", "Tablas", Table2],
          ["llaves", "Llaves", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            className={`btn ${activeTab === key ? "" : "secondary"}`}
            key={key as string}
            onClick={() => setActiveTab(key as "podio" | "grupos" | "tablas" | "llaves")}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </section>

      {activeTab === "podio" && (
        <section className="grid gap-4">
          {message && <p className="panel p-3 text-sm font-bold text-ink/70">{message}</p>}
          <article className="panel overflow-hidden">
            <div className="border-b border-line p-4">
              <h2 className="flex items-center gap-2 text-xl font-black"><Medal className="h-5 w-5 text-gold" />Podio anticipado por jugador</h2>
              <p className="mt-1 text-sm text-ink/60">Edita campeón, subcampeón y 3er puesto de cada participante.</p>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {profiles.map((profile) => {
                const podium = podiumMap[profile.id];
                return (
                  <article className="rounded-lg border border-line bg-field p-4" key={profile.id}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <strong className="text-xl font-black">{profile.display_name}</strong>
                      <PointsPill points={podium?.points ?? 0} className="min-h-8 rounded-full py-1" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1">
                        <span className="text-xs font-black uppercase text-yellow-200">Campeón</span>
                        {podiumSelect(profile.id, "championTeam")}
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs font-black uppercase text-slate-100">Subcampeón</span>
                        {podiumSelect(profile.id, "runnerUpTeam")}
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs font-black uppercase text-orange-200">3er puesto</span>
                        {podiumSelect(profile.id, "thirdPlaceTeam")}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
                        <span className="rounded-full border border-yellow-300/35 bg-yellow-300/10 px-2 py-1 text-yellow-200">{podium?.champion_points ?? 0} campeón</span>
                        <span className="rounded-full border border-slate-200/35 bg-slate-200/10 px-2 py-1 text-slate-100">{podium?.runner_up_points ?? 0} sub</span>
                        <span className="rounded-full border border-orange-300/35 bg-orange-400/10 px-2 py-1 text-orange-200">{podium?.third_place_points ?? 0} 3er</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn min-h-9 px-3" disabled={saving} onClick={() => savePodium(profile.id)} type="button">
                          <Save className="h-4 w-4" />
                          Guardar
                        </button>
                        <button className="btn secondary min-h-9 px-3" disabled={saving || !podium} onClick={() => deletePodium(profile.id)} type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
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

      {activeTab === "llaves" && (
        <section className="panel flex flex-wrap gap-2 p-2">
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
        </section>
      )}

      {activeTab === "tablas" ? (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {groupTables.map(({ group, rows }) => (
            <article className="panel p-4" key={group}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xl font-black">Grupo {group}</h2>
              </div>
              <div className="grid gap-2 text-sm">
                {rows.map((row, index) => (
                  <div className="grid grid-cols-[28px_1fr_42px_42px_42px] items-center gap-2 rounded-lg border border-line bg-field p-2" key={`${group}-${row.team}`}>
                    <span className="font-black text-gold">{index + 1}</span>
                    <TeamLabel name={row.team} code={row.code} />
                    <strong className="text-center">{row.points}</strong>
                    <span className="text-center text-ink/60">{row.played}</span>
                    <span className="text-center text-ink/60">{row.diff}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : activeTab !== "podio" ? (
    <section className="grid gap-4">
      <div className="grid gap-3">
        <h2 className="text-xl font-black">{activeTab === "llaves" ? (selectedKnockoutStage ? stageLabels[selectedKnockoutStage] : "Llaves") : `Grupo ${selectedGroup}`}</h2>
        <div className="match-card-grid">
          {tabMatches.map((match) => matchButton(match))}
        </div>
      </div>

      <section className="grid gap-4 content-start">
        {message && <p className="panel p-3 text-sm font-bold text-ink/70">{message}</p>}

        <article className="panel overflow-hidden">
          <div className="border-b border-line p-4">
            <h2 className="text-xl font-black">Apuestas de jugadores</h2>
          </div>
          <div className="match-card-grid p-4">
            {profiles.map((profile) => {
              const key = predictionKey(profile.id, selectedMatch.id);
              const existing = predictionMap[key];
              const draft = drafts[key] ?? { home: existing?.home_goals ?? "", away: existing?.away_goals ?? "", penaltyWinner: existing?.penalty_winner ?? null };
              const score =
                selectedMatch.home_goals != null &&
                selectedMatch.away_goals != null &&
                draft.home !== "" &&
                draft.away !== ""
                  ? scorePrediction({
                      stage: selectedMatch.stage,
                      predictedHomeGoals: draft.home,
                      predictedAwayGoals: draft.away,
                      actualHomeGoals: selectedMatch.home_goals,
                      actualAwayGoals: selectedMatch.away_goals
                    }).points
                  : existing?.points ?? 0;
              const predictionTieNeedsWinner =
                selectedMatch.stage !== "GROUP" &&
                draft.home !== "" &&
                draft.away !== "" &&
                draft.home === draft.away;
              return (
                <article className="rounded-lg border border-line bg-field p-4" key={profile.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <strong className="text-lg">{profile.display_name}</strong>
                    <PointsPill points={score} className="min-h-8 rounded-full py-1" />
                  </div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3 rounded-lg border border-line bg-slate-950/25 p-2">
                      <TeamLabel name={selectedMatch.home_team} code={selectedMatch.home_country_code} />
                      <input
                        className="field h-10 px-2 text-center font-black"
                        inputMode="numeric"
                        maxLength={2}
                        pattern="[0-9]*"
                        type="text"
                        value={draft.home}
                        onChange={(event) => {
                          const value = parseGoalInput(event.target.value);
                          if (value !== null && (value === "" || value <= 30)) setDrafts((current) => ({ ...current, [key]: { ...draft, home: value } }));
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3 rounded-lg border border-line bg-slate-950/25 p-2">
                      <TeamLabel name={selectedMatch.away_team} code={selectedMatch.away_country_code} />
                      <input
                        className="field h-10 px-2 text-center font-black"
                        inputMode="numeric"
                        maxLength={2}
                        pattern="[0-9]*"
                        type="text"
                        value={draft.away}
                        onChange={(event) => {
                          const value = parseGoalInput(event.target.value);
                          if (value !== null && (value === "" || value <= 30)) setDrafts((current) => ({ ...current, [key]: { ...draft, away: value } }));
                        }}
                      />
                    </div>
                  </div>
                  {predictionTieNeedsWinner && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="self-center text-xs font-black uppercase text-ink/45">Ganador</span>
                      <button
                        className={`badge ${draft.penaltyWinner === "HOME" ? "bg-mint text-grass" : ""}`}
                        disabled={saving}
                        onClick={() => setDrafts((current) => ({ ...current, [key]: { ...draft, penaltyWinner: "HOME" } }))}
                        type="button"
                      >
                        {selectedMatch.home_team}
                      </button>
                      <button
                        className={`badge ${draft.penaltyWinner === "AWAY" ? "bg-mint text-grass" : ""}`}
                        disabled={saving}
                        onClick={() => setDrafts((current) => ({ ...current, [key]: { ...draft, penaltyWinner: "AWAY" } }))}
                        type="button"
                      >
                        {selectedMatch.away_team}
                      </button>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button className="btn secondary min-h-9 px-3" disabled={saving} onClick={() => savePrediction(profile.id, selectedMatch.id)} type="button">
                      Guardar
                    </button>
                    <button className="btn secondary min-h-9 px-3" disabled={saving || !existing} onClick={() => deletePrediction(profile.id, selectedMatch.id)} type="button">
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      </section>
    </section>
      ) : null}
    </div>
  );
}
