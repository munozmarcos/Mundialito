"use client";

import { HomePredictionEditor } from "@/components/home-prediction-editor";
import { StatusPill } from "@/components/status-pill";
import type { MatchStatus } from "@/lib/types";
import { useState } from "react";

type Prediction = {
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  updated_at?: string | null;
  user_updated_at?: string | null;
};

type Props = {
  actualAwayGoals?: number | null;
  actualHomeGoals?: number | null;
  disabled: boolean;
  initialPrediction?: Prediction;
  isPlaying: boolean;
  liveMinute?: string | null;
  matchId: string;
  matchUpdatedAt?: string | null;
  status: MatchStatus;
  statusLabel?: string;
};

export function HomeMatchControls({
  actualAwayGoals,
  actualHomeGoals,
  disabled,
  initialPrediction,
  isPlaying,
  liveMinute,
  matchId,
  matchUpdatedAt,
  status,
  statusLabel
}: Props) {
  const [predictionUpdatedAt, setPredictionUpdatedAt] = useState(initialPrediction?.user_updated_at ?? initialPrediction?.updated_at ?? "");
  const updatedAt = isPlaying ? matchUpdatedAt : predictionUpdatedAt;

  return (
    <div className="grid justify-items-start gap-2 sm:justify-items-end">
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        {updatedAt && <span className="text-[11px] italic text-ink/45">Actualizado {formatCompactDate(updatedAt)}</span>}
        {isPlaying && liveMinute && (
          <span className="min-w-16 rounded-full border border-red-400/80 bg-red-950/85 px-2 py-0.5 text-center text-[11px] font-black text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.18)]">
            {liveMinute}
          </span>
        )}
        <StatusPill label={statusLabel} status={status} />
      </div>
      <HomePredictionEditor
        actualAwayGoals={actualAwayGoals}
        actualHomeGoals={actualHomeGoals}
        disabled={disabled}
        initialPrediction={initialPrediction}
        matchId={matchId}
        onSavedAt={setPredictionUpdatedAt}
        realScoreTone={isPlaying}
        showActualScore={isPlaying}
      />
    </div>
  );
}

function formatCompactDate(value: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} - ${get("hour")}:${get("minute")}`;
}
