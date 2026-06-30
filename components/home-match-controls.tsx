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
  actualAwayPenaltyGoals?: number | null;
  actualHomeGoals?: number | null;
  actualHomePenaltyGoals?: number | null;
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
  actualAwayPenaltyGoals,
  actualHomeGoals,
  actualHomePenaltyGoals,
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
    <div className="home-match-controls grid justify-items-start gap-2 sm:justify-items-end">
      <div className="home-match-status-row flex w-full flex-nowrap items-center justify-end gap-2">
        {updatedAt && <span className="min-w-0 truncate text-[11px] italic text-ink/45">{formatCompactDate(updatedAt)}</span>}
        {isPlaying && liveMinute && (
          <span className="w-12 rounded-full border border-red-400/70 bg-[#7f1020] px-0 py-0.5 text-center text-[11px] font-black text-white">
            {liveMinute}
          </span>
        )}
        <StatusPill label={statusLabel} status={status} />
      </div>
      <HomePredictionEditor
        actualAwayGoals={actualAwayGoals}
        actualAwayPenaltyGoals={actualAwayPenaltyGoals}
        actualHomeGoals={actualHomeGoals}
        actualHomePenaltyGoals={actualHomePenaltyGoals}
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
