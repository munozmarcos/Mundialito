"use client";

import { TeamLabel } from "@/components/team-label";
import { fifaGroupTeamOrder } from "@/lib/group-order";
import type { Match, Prediction, Profile } from "@/lib/types";
import { GitBranch, Lock, LockOpen, Save, Table2, Trash2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

type AdminPrediction = Prediction & { profiles?: Pick<Profile, "display_name"> | null };

type Props = {
  initialMatches: Match[];
  profiles: Profile[];
  predictions: AdminPrediction[];
};

type ScoreDraft = Record<string, { home: number | ""; away: number | ""; penaltyWinner?: string | null }>;
type PredictionDraft = Record<string, { home: number | ""; away: number | ""; penaltyWinner?: string | null }>;

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

export function AdminResultsControl({ initialMatches, profiles, predictions }: Props) {
  const [matches, setMatches] = useState(initialMatches);
  const [scores, setScores] = useState<ScoreDraft>(() => initialScores(initialMatches));
  const [drafts, setDrafts] = useState<PredictionDraft>(() => initialPredictionDrafts(predictions));
  const [activeTab, setActiveTab] = useState<"grupos" | "tablas" | "llaves">("grupos");
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatches[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const tabMatches = activeTab === "llaves" ? matches.filter((match) => match.stage !== "GROUP") : matches.filter((match) => match.stage === "GROUP");
  const selectedMatch = tabMatches.find((match) => match.id === selectedMatchId) ?? tabMatches[0] ?? matches[0];
  const predictionMap = useMemo(() => {
    return predictions.reduce<Record<string, AdminPrediction>>((acc, prediction) => {
      acc[predictionKey(prediction.user_id, prediction.match_id)] = prediction;
      return acc;
    }, {});
  }, [predictions]);

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
      updateLocalMatch(match.id, { home_goals: score.home, away_goals: score.away, penalty_winner: score.penaltyWinner ?? null, locked: true, status: "final" });
      const notification = await request("/api/admin/run-job", "POST", { path: "/api/jobs/notify-results", matchId: match.id });
      setMessage(`Resultado guardado y puntos recalculados. WhatsApp enviados: ${notification.data?.sent ?? 0}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function changeState(match: Match, action: "lock" | "open" | "clear") {
    setSaving(true);
    setMessage("");
    try {
      await request("/api/results", "PATCH", { matchId: match.id, action });
      if (action === "lock") updateLocalMatch(match.id, { locked: true, status: "locked" });
      if (action === "open") updateLocalMatch(match.id, { locked: false, status: "open" });
      if (action === "clear") {
        updateLocalMatch(match.id, { locked: false, status: "open", home_goals: null, away_goals: null, penalty_winner: null });
        setScores((current) => ({ ...current, [match.id]: { home: "", away: "", penaltyWinner: null } }));
      }
      setMessage(action === "lock" ? "Partido cerrado." : action === "open" ? "Partido abierto." : "Resultado eliminado.");
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
  const selectedScore = scores[selectedMatch.id];
  const selectedTieNeedsWinner =
    selectedMatch.stage !== "GROUP" &&
    selectedScore?.home !== "" &&
    selectedScore?.away !== "" &&
    selectedScore?.home === selectedScore?.away;

  return (
    <div className="grid gap-4">
      <section className="panel flex flex-wrap gap-2 p-2">
        {[
          ["grupos", "Grupos", Trophy],
          ["tablas", "Tablas", Table2],
          ["llaves", "Llaves", GitBranch]
        ].map(([key, label, Icon]) => (
          <button
            className={`btn ${activeTab === key ? "" : "secondary"}`}
            key={key as string}
            onClick={() => setActiveTab(key as "grupos" | "tablas" | "llaves")}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </section>

      {activeTab === "tablas" ? (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {groupTables.map(({ group, rows }) => (
            <article className="panel p-4" key={group}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xl font-black">Grupo {group}</h2>
                <span className="badge">Tabla</span>
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
      ) : (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4">
          <h2 className="text-xl font-black">{activeTab === "llaves" ? "Llaves" : "Grupos"}</h2>
        </div>
        <div className="max-h-[760px] overflow-y-auto">
          {tabMatches.map((match) => (
            <button
              className={`w-full border-b border-line p-3 text-left last:border-0 ${selectedMatch.id === match.id ? "bg-mint" : "bg-white"}`}
              key={match.id}
              onClick={() => setSelectedMatchId(match.id)}
              type="button"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm font-black">
                <TeamLabel name={match.home_team} code={match.home_country_code} />
                <span className="text-ink/40">vs</span>
                <TeamLabel name={match.away_team} code={match.away_country_code} />
              </div>
              <p className="mt-1 text-xs font-semibold text-ink/55">
                {match.group_name ? `Grupo ${match.group_name}` : match.stage} - {match.status}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 content-start">
        <article className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex flex-wrap items-center gap-2 text-2xl font-black">
              <TeamLabel name={selectedMatch.home_team} code={selectedMatch.home_country_code} />
              <span className="text-ink/40">vs</span>
              <TeamLabel name={selectedMatch.away_team} code={selectedMatch.away_country_code} />
            </h2>
            <span className="badge">{selectedMatch.locked ? "Cerrado" : "Abierto"}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[90px_90px_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-bold">
              Local
              <input
                className="field text-center"
                min={0}
                type="number"
                value={scores[selectedMatch.id]?.home ?? ""}
                onChange={(event) => setScores((current) => ({ ...current, [selectedMatch.id]: { ...current[selectedMatch.id], home: event.target.value === "" ? "" : Number(event.target.value) } }))}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Visitante
              <input
                className="field text-center"
                min={0}
                type="number"
                value={scores[selectedMatch.id]?.away ?? ""}
                onChange={(event) => setScores((current) => ({ ...current, [selectedMatch.id]: { ...current[selectedMatch.id], away: event.target.value === "" ? "" : Number(event.target.value) } }))}
              />
            </label>
            <button className="btn" disabled={saving} onClick={() => saveResult(selectedMatch)} type="button">
              <Save className="h-4 w-4" />
              Guardar resultado
            </button>
          </div>

          {selectedTieNeedsWinner && (
            <div className="mt-4 rounded-lg border border-line bg-field p-3">
              <div className="mb-2 text-xs font-black uppercase text-ink/45">Ganador</div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`btn ${selectedScore?.penaltyWinner === selectedMatch.home_team ? "" : "secondary"}`}
                  disabled={saving}
                  onClick={() => setScores((current) => ({ ...current, [selectedMatch.id]: { ...current[selectedMatch.id], penaltyWinner: selectedMatch.home_team } }))}
                  type="button"
                >
                  <TeamLabel name={selectedMatch.home_team} code={selectedMatch.home_country_code} />
                </button>
                <button
                  className={`btn ${selectedScore?.penaltyWinner === selectedMatch.away_team ? "" : "secondary"}`}
                  disabled={saving}
                  onClick={() => setScores((current) => ({ ...current, [selectedMatch.id]: { ...current[selectedMatch.id], penaltyWinner: selectedMatch.away_team } }))}
                  type="button"
                >
                  <TeamLabel name={selectedMatch.away_team} code={selectedMatch.away_country_code} />
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn secondary" disabled={saving} onClick={() => changeState(selectedMatch, selectedMatch.locked ? "open" : "lock")} type="button">
              {selectedMatch.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {selectedMatch.locked ? "Abrir partido" : "Cerrar partido"}
            </button>
            <button className="btn secondary" disabled={saving} onClick={() => changeState(selectedMatch, "clear")} type="button">
              <Trash2 className="h-4 w-4" />
              Quitar resultado
            </button>
          </div>
          {message && <p className="mt-3 text-sm font-bold text-ink/70">{message}</p>}
        </article>

        <article className="panel overflow-hidden">
          <div className="border-b border-line p-4">
            <h2 className="text-xl font-black">Apuestas de jugadores</h2>
          </div>
          <div className="grid">
            {profiles.map((profile) => {
              const key = predictionKey(profile.id, selectedMatch.id);
              const existing = predictionMap[key];
              const draft = drafts[key] ?? { home: existing?.home_goals ?? "", away: existing?.away_goals ?? "", penaltyWinner: existing?.penalty_winner ?? null };
              const predictionTieNeedsWinner =
                selectedMatch.stage !== "GROUP" &&
                draft.home !== "" &&
                draft.away !== "" &&
                draft.home === draft.away;
              return (
                <div className="grid gap-3 border-b border-line p-4 last:border-0 md:grid-cols-[1fr_78px_78px_auto_auto] md:items-center" key={profile.id}>
                  <div>
                    <strong>{profile.display_name}</strong>
                    <p className="text-xs text-ink/55">
                      {existing ? `${existing.points} pts` : "Sin cargar"}
                      {existing?.penalty_winner ? ` - ganador: ${existing.penalty_winner}` : ""}
                    </p>
                  </div>
                  <input
                    className="field text-center"
                    min={0}
                    type="number"
                    value={draft.home}
                    onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, home: event.target.value === "" ? "" : Number(event.target.value) } }))}
                  />
                  <input
                    className="field text-center"
                    min={0}
                    type="number"
                    value={draft.away}
                    onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, away: event.target.value === "" ? "" : Number(event.target.value) } }))}
                  />
                  {predictionTieNeedsWinner && (
                    <div className="flex flex-wrap gap-1 md:col-span-3">
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
                  <button className="btn secondary min-h-9 px-3" disabled={saving} onClick={() => savePrediction(profile.id, selectedMatch.id)} type="button">
                    Guardar
                  </button>
                  <button className="btn secondary min-h-9 px-3" disabled={saving || !existing} onClick={() => deletePrediction(profile.id, selectedMatch.id)} type="button">
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </div>
      )}
    </div>
  );
}
