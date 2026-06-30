import { StatusPill } from "@/components/status-pill";
import { ScoreWithPenalty } from "@/components/score-with-penalty";
import { TeamLabel } from "@/components/team-label";
import { formatArgentinaDateTime } from "@/lib/dates";
import { liveMinuteLabel } from "@/lib/live-minute";
import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { formatScoreWithPenalties } from "@/lib/match-score";
import { matchStatus } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export function MatchCard({ match }: { match: Match }) {
  const blocked = isMatchBlockedUntilOfficial(match);
  const hasResult = match.home_goals != null && match.away_goals != null;
  const status = blocked ? "locked" : matchStatus(match.kickoff_at, match.locked, hasResult, new Date(), match.status);
  const result = formatScoreWithPenalties(match);

  return (
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {status === "playing" && (
            <span className="text-[11px] italic text-ink/45">
              {match.result_updated_at ? formatArgentinaDateTime(match.result_updated_at) : "En vivo"}
            </span>
          )}
          {status === "playing" && (
            <span className="w-12 rounded-full border border-red-400/70 bg-[#7f1020] px-0 py-1 text-center text-xs font-black text-white">
              {liveMinuteLabel(match.kickoff_at)}
            </span>
          )}
          <StatusPill status={status} label={blocked ? "Bloqueado" : undefined} />
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <TeamLabel name={match.home_team} code={match.home_country_code} />
          <ScoreWithPenalty penalty={match.home_penalty_goals} score={match.home_goals ?? "-"} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <TeamLabel name={match.away_team} code={match.away_country_code} />
          <ScoreWithPenalty penalty={match.away_penalty_goals} score={match.away_goals ?? "-"} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-field p-2">
          <span className="block font-bold text-ink/60">Prediccion</span>
          <span className="font-black">Sin cargar</span>
        </div>
        <div className="rounded-md bg-field p-2">
          <span className="block font-bold text-ink/60">Resultado</span>
          <span className="font-black">{result ?? "Pendiente"}</span>
        </div>
      </div>
    </article>
  );
}
