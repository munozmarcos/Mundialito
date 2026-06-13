"use client";

import { Check, Save } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Prediction = {
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  updated_at?: string | null;
  user_updated_at?: string | null;
};

type Props = {
  matchId: string;
  initialPrediction?: Prediction;
  disabled: boolean;
  actualHomeGoals?: number | null;
  actualAwayGoals?: number | null;
  showActualScore?: boolean;
  realScoreTone?: boolean;
  onSavedAt?: (value: string) => void;
};

function parseGoalInput(value: string) {
  if (value === "") return "";
  if (!/^\d{1,2}$/.test(value)) return null;
  return Number(value);
}

function ScoreBox({ value, muted = false, real = false }: { value: number | null | undefined; muted?: boolean; real?: boolean }) {
  return (
    <div
      className={`grid h-10 w-12 place-items-center rounded-lg border text-sm font-black ${
        real ? "border-red-400/70 bg-[#7f1020] text-white" : muted ? "border-line bg-field text-ink/45" : "border-line bg-field text-ink"
      }`}
    >
      {value ?? ""}
    </div>
  );
}

export function HomePredictionEditor({
  matchId,
  initialPrediction,
  disabled,
  actualHomeGoals,
  actualAwayGoals,
  showActualScore = true,
  realScoreTone = false,
  onSavedAt
}: Props) {
  const [homeGoals, setHomeGoals] = useState<number | "">(initialPrediction?.home_goals ?? "");
  const [awayGoals, setAwayGoals] = useState<number | "">(initialPrediction?.away_goals ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedKey, setSavedKey] = useState(predictionKey(initialPrediction?.home_goals ?? "", initialPrediction?.away_goals ?? ""));

  useEffect(() => {
    setHomeGoals(initialPrediction?.home_goals ?? "");
    setAwayGoals(initialPrediction?.away_goals ?? "");
    setSavedKey(predictionKey(initialPrediction?.home_goals ?? "", initialPrediction?.away_goals ?? ""));
  }, [initialPrediction?.home_goals, initialPrediction?.away_goals]);

  if (disabled) {
    const hasPrediction = initialPrediction?.home_goals != null && initialPrediction?.away_goals != null;

    if (realScoreTone) {
      return (
        <div className="flex items-center justify-end gap-2">
          <ScoreBox value={hasPrediction ? initialPrediction.home_goals : null} muted={!hasPrediction} />
          <ScoreBox value={hasPrediction ? initialPrediction.away_goals : null} muted={!hasPrediction} />
          <span className="mx-1 text-xs font-black text-ink/35">|</span>
          <ActualScoreGroup awayGoals={actualAwayGoals} homeGoals={actualHomeGoals} realScoreTone />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2">
        {showActualScore && (
          <>
            <ActualScoreGroup awayGoals={actualAwayGoals} homeGoals={actualHomeGoals} realScoreTone={realScoreTone} />
            <span className="mx-1 text-xs font-black text-ink/35">|</span>
          </>
        )}
        <ScoreBox value={hasPrediction ? initialPrediction.home_goals : null} muted={!hasPrediction} />
        <ScoreBox value={hasPrediction ? initialPrediction.away_goals : null} muted={!hasPrediction} />
      </div>
    );
  }

  const saveDraft = useCallback(async (showErrors: boolean) => {
    if (disabled || saving) return;
    setSaved(false);

    if (homeGoals === "" || awayGoals === "") {
      if (showErrors) window.alert("Carga ambos goles.");
      return;
    }

    const currentKey = predictionKey(homeGoals, awayGoals);
    if (!showErrors && currentKey === savedKey) return;

    setSaving(true);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, homeGoals, awayGoals, penaltyWinner: null })
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      if (showErrors) window.alert(data.error ?? "No se pudo guardar.");
      return;
    }

    const savedAt = data.prediction?.user_updated_at ?? data.prediction?.updated_at ?? new Date().toISOString();
    onSavedAt?.(savedAt);
    setSavedKey(currentKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }, [awayGoals, disabled, homeGoals, matchId, onSavedAt, savedKey, saving]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveDraft(true);
  }

  useEffect(() => {
    if (disabled || homeGoals === "" || awayGoals === "") return;
    const timer = window.setInterval(() => {
      void saveDraft(false);
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [awayGoals, disabled, homeGoals, saveDraft]);

  return (
    <form className="flex items-center justify-end gap-2" onSubmit={save}>
      {showActualScore && (
        <>
          <ActualScoreGroup awayGoals={actualAwayGoals} homeGoals={actualHomeGoals} realScoreTone={realScoreTone} />
          <span className="mx-1 text-xs font-black text-ink/35">|</span>
        </>
      )}
      <input
        aria-label="Tu pronostico local"
        className="field h-10 w-12 px-0 text-center text-sm font-black"
        disabled={disabled}
        inputMode="numeric"
        maxLength={2}
        pattern="[0-9]*"
        type="text"
        value={homeGoals}
        onChange={(event) => {
          const value = parseGoalInput(event.target.value);
          if (value !== null && (value === "" || value <= 30)) {
            setHomeGoals(value);
            setSaved(false);
          }
        }}
      />
      <input
        aria-label="Tu pronostico visitante"
        className="field h-10 w-12 px-0 text-center text-sm font-black"
        disabled={disabled}
        inputMode="numeric"
        maxLength={2}
        pattern="[0-9]*"
        type="text"
        value={awayGoals}
        onChange={(event) => {
          const value = parseGoalInput(event.target.value);
          if (value !== null && (value === "" || value <= 30)) {
            setAwayGoals(value);
            setSaved(false);
          }
        }}
      />
      <button className="btn h-10 min-h-10 w-11 px-0" disabled={disabled || saving} title="Guardar pronostico" type="submit">
        {saved ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />}
      </button>
    </form>
  );
}

function predictionKey(homeGoals: number | "" | null | undefined, awayGoals: number | "" | null | undefined) {
  return `${homeGoals ?? ""}-${awayGoals ?? ""}`;
}

function ActualScoreGroup({
  awayGoals,
  homeGoals,
  realScoreTone
}: {
  awayGoals: number | null | undefined;
  homeGoals: number | null | undefined;
  realScoreTone: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <ScoreBox value={homeGoals} real={realScoreTone} />
      <ScoreBox value={awayGoals} real={realScoreTone} />
    </div>
  );
}
