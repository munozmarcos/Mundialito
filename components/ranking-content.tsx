"use client";

import { CountryFilterPicker } from "@/components/country-filter-picker";
import { DateFilter } from "@/components/date-filter";
import { EmptyState } from "@/components/empty-state";
import { PointsPill, pointsInputClass, pointsPillClass } from "@/components/points-pill";
import { RankingDescription } from "@/components/ranking-description";
import { TeamLabel } from "@/components/team-label";
import { formatArgentinaDateTime } from "@/lib/dates";
import { matchFitsBasicFilters } from "@/lib/match-filters";
import { teamOptionsFromMatches } from "@/lib/team-options";
import type { RankingDetails, RankingPredictionDetail, RankingRow } from "@/lib/data";
import type { Match, MatchStage } from "@/lib/types";
import { Eye, ListChecks, Medal, Target, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  ranking: RankingRow[];
  details: RankingDetails;
};

type DetailMatch = {
  id: string;
  home_team: string;
  away_team: string;
  home_country_code?: string | null;
  away_country_code?: string | null;
  kickoff_at: string;
  stage: string;
  group_name?: string | null;
  home_goals?: number | null;
  away_goals?: number | null;
  penalty_winner?: string | null;
};

const stageLabels: Record<string, string> = {
  GROUP: "Grupos",
  R32: "16vos",
  R16: "8vos",
  QF: "4tos",
  SF: "Semis",
  THIRD_PLACE: "3er Puesto",
  FINAL: "Final"
};

const stageOrder: MatchStage[] = ["GROUP", "R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function podiumClass(index: number) {
  if (index === 0) return "border-yellow-300/50 bg-yellow-300/12 text-yellow-200";
  if (index === 1) return "border-slate-200/50 bg-slate-200/12 text-slate-100";
  if (index === 2) return "border-orange-300/50 bg-orange-400/12 text-orange-200";
  return "border-line";
}

function asMatch(value: RankingPredictionDetail["matches"]): DetailMatch | null {
  if (!value) return null;
  return (Array.isArray(value) ? (value[0] ?? null) : value) as DetailMatch | null;
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const group = key(item);
    acc[group] ??= [];
    acc[group].push(item);
    return acc;
  }, {});
}

function ScoreBox({ value, className = "" }: { value: number | string | null | undefined; className?: string }) {
  return (
    <input
      className={`field min-h-10 px-2 text-center font-black leading-none disabled:opacity-100 ${className}`}
      disabled
      readOnly
      value={value ?? ""}
    />
  );
}

function DetailCard({ detail }: { detail: RankingPredictionDetail }) {
  const match = asMatch(detail.matches);
  if (!match) return null;
  const resultTone = pointsPillClass(detail.points);
  const resultInputTone = pointsInputClass(detail.points);
  return (
    <article className="rounded-lg border border-line bg-field p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="badge">{match.group_name ? `Grupo ${match.group_name}` : stageLabels[match.stage] ?? match.stage}</span>
          <p className="mt-2 text-xs font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</p>
        </div>
        <PointsPill points={detail.points} className="min-h-8 rounded-full py-1" />
      </div>
      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_72px_72px] gap-2 px-2 text-[11px] font-black uppercase text-ink/45">
          <span />
          <span />
          <span className="rounded-full border border-line bg-field px-2 py-1 text-center text-ink/55">Final</span>
        </div>
        <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2 rounded-md border border-line bg-slate-950/25 p-2">
          <TeamLabel name={match.home_team} code={match.home_country_code} />
          <ScoreBox value={detail.home_goals} />
          <ScoreBox className={resultInputTone} value={match.home_goals} />
        </div>
        <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2 rounded-md border border-line bg-slate-950/25 p-2">
          <TeamLabel name={match.away_team} code={match.away_country_code} />
          <ScoreBox value={detail.away_goals} />
          <ScoreBox className={resultInputTone} value={match.away_goals} />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-ink/60">
        {detail.exact_hit ? "Exacto" : detail.trend_hit ? "Tendencia" : "Puntos"} logrado.
      </p>
    </article>
  );
}

function PodiumHit({ label, team, points, colorClass }: { label: string; team?: string | null; points: number; colorClass: string }) {
  if (!team || !points) return null;
  return (
    <article className="rounded-lg border border-line bg-field p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`flex items-center gap-2 text-sm font-black ${colorClass}`}>
          <Trophy className="h-4 w-4" />
          {label}
        </span>
        <PointsPill points={points} className="min-h-8 rounded-full py-1" />
      </div>
      <TeamLabel name={team} />
    </article>
  );
}

function DetailCounter({
  icon: Icon,
  label,
  value,
  className
}: {
  icon: typeof ListChecks;
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className={`rounded-lg bg-field px-4 py-3 text-center ${className}`}>
      <div className="flex items-center justify-center gap-2">
        <strong className="block text-2xl">{value}</strong>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-black uppercase text-ink/55">{label}</span>
    </div>
  );
}

export function RankingContent({ ranking, details }: Props) {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const normalizedQuery = normalize(query);
  const normalizedRanking = useMemo(() => {
    const detailStats = new Map<string, { points: number; exacts: number; trends: number }>();
    for (const detail of details.predictions) {
      const current = detailStats.get(detail.user_id) ?? { points: 0, exacts: 0, trends: 0 };
      current.points += detail.points ?? 0;
      if (detail.exact_hit) current.exacts += 1;
      else if (detail.trend_hit) current.trends += 1;
      detailStats.set(detail.user_id, current);
    }

    const podiumStats = new Map(details.podium.map((item) => [item.user_id, item]));
    return ranking
      .map((row) => {
        const detail = detailStats.get(row.user_id);
        const podium = podiumStats.get(row.user_id);
        if (!detail && !podium) return row;
        return {
          ...row,
          total_points: (detail?.points ?? 0) + (podium?.points ?? 0),
          exact_hits: detail?.exacts ?? 0,
          trend_hits: detail?.trends ?? 0,
          podium_points: podium?.points ?? 0,
          podium_champion_points: podium?.champion_points ?? 0,
          podium_runner_up_points: podium?.runner_up_points ?? 0,
          podium_third_place_points: podium?.third_place_points ?? 0
        };
      })
      .sort((a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits || b.trend_hits - a.trend_hits || a.display_name.localeCompare(b.display_name));
  }, [details.podium, details.predictions, ranking]);
  const selectedRow = normalizedRanking.find((row) => row.user_id === selectedUserId) ?? null;
  const selectedSummary = selectedUserId ? details.summaries.find((summary) => summary.user_id === selectedUserId) : null;
  const fallbackAvailable = details.summaries.find((summary) => summary.available_predictions > 0)?.available_predictions ?? 0;
  const detailRows = useMemo(
    () => details.predictions.filter((detail) => detail.user_id === selectedUserId),
    [details.predictions, selectedUserId]
  );
  const podiumDetail = details.podium.find((item) => item.user_id === selectedUserId);
  const teamOptions = useMemo(() => {
    const matches = detailRows.map((detail) => asMatch(detail.matches)).filter(Boolean).map((match) => ({
      ...(match as DetailMatch),
      id: (match as DetailMatch).id,
      status: "closed",
      locked: true
    })) as Match[];
    return teamOptionsFromMatches(matches);
  }, [detailRows]);
  const filteredDetails = detailRows.filter((detail) => {
    const match = asMatch(detail.matches);
    return match ? matchFitsBasicFilters(match as Match, teamFilter, dateFilter) : false;
  });
  const detailsByStage = groupBy(filteredDetails, (detail) => asMatch(detail.matches)?.stage ?? "GROUP");
  const filteredRanking = useMemo(
    () => normalizedRanking.filter((row) => !normalizedQuery || normalize(row.display_name).includes(normalizedQuery)),
    [normalizedQuery, normalizedRanking]
  );

  useEffect(() => {
    if (!selectedRow) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedUserId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRow]);

  return (
    <section className="grid gap-4">
      <article className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-2xl font-black">Ranking</h2>
          <p className="mt-1 text-sm text-ink/60">Puntos por exactos, tendencias y aciertos del podio anticipado cuando ya exista resultado real.</p>
          <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-[minmax(280px,1fr)_44px]">
            <input className="field" placeholder="Buscar apodo" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => setQuery("")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!filteredRanking.length ? (
          <div className="p-5">
            <EmptyState title="Ranking vacío" text="No hay participantes para ese filtro." />
          </div>
        ) : (
          filteredRanking.map((row, index) => (
            <div className={`grid gap-3 border-b p-4 last:border-0 sm:grid-cols-[48px_1fr_auto] sm:items-center ${podiumClass(index)}`} key={row.user_id}>
              <div className={`text-xl font-black sm:text-2xl ${index < 3 ? "" : "text-gold"}`}>#{index + 1}</div>
              <div>
                <h3 className="text-xl font-black sm:text-2xl">{row.display_name}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <RankingDescription
                    exacts={row.exact_hits}
                    trends={row.trend_hits}
                    championPoints={row.podium_champion_points}
                    runnerUpPoints={row.podium_runner_up_points}
                    thirdPlacePoints={row.podium_third_place_points}
                  />
                  <button className="btn secondary min-h-8 w-fit px-3 text-xs" onClick={() => setSelectedUserId(row.user_id)} type="button">
                    <Eye className="h-3.5 w-3.5" />
                    Detalles
                  </button>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <strong className="block text-2xl font-black">{row.total_points}</strong>
                <span className="text-xs font-black uppercase text-ink/45">pts</span>
              </div>
            </div>
          ))
        )}
      </article>

      {selectedRow && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-3">
          <section className="panel dark-scrollbar max-h-[92vh] w-full max-w-6xl overflow-y-auto p-4 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <span className="badge">Detalles</span>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <h2 className="text-2xl font-black">{selectedRow.display_name}</h2>
                </div>
                <RankingDescription
                  className="mt-1 text-sm text-ink/60"
                  exacts={selectedRow.exact_hits}
                  trends={selectedRow.trend_hits}
                  championPoints={selectedRow.podium_champion_points}
                  runnerUpPoints={selectedRow.podium_runner_up_points}
                  thirdPlacePoints={selectedRow.podium_third_place_points}
                />
              </div>
              <div className="flex flex-wrap items-start justify-end gap-2">
                <DetailCounter
                  className="border border-red-400/25 text-red-400"
                  icon={Target}
                  label="puntos"
                  value={`${selectedRow.total_points} Pts`}
                />
                <DetailCounter
                  className="border border-grass/25 text-grass"
                  icon={ListChecks}
                  label="predicciones"
                  value={`${selectedSummary?.loaded_predictions ?? 0}/${selectedSummary?.available_predictions ?? fallbackAvailable}`}
                />
                <DetailCounter
                  className="border border-gold/25 text-gold"
                  icon={Medal}
                  label="podio"
                  value={`${selectedSummary?.podium_loaded ?? 0}/3`}
                />
                <button className="btn secondary min-w-11 px-0" onClick={() => setSelectedUserId(null)} type="button" aria-label="Cerrar detalles">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <section className="mt-4 grid gap-2 p-0 sm:grid-cols-[minmax(280px,1fr)_150px_auto] lg:grid-cols-[320px_150px_44px] lg:items-center">
              <CountryFilterPicker className="min-w-[260px]" value={teamFilter} options={teamOptions} onChange={setTeamFilter} />
              <DateFilter value={dateFilter} onChange={setDateFilter} />
              <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => { setTeamFilter(""); setDateFilter(""); }}>
                <X className="h-4 w-4" />
              </button>
            </section>

            {podiumDetail && podiumDetail.points > 0 && (
              <section className="mt-5 grid gap-3">
                <h3 className="flex items-center gap-2 text-xl font-black"><Medal className="h-5 w-5 text-gold" />Podio anticipado</h3>
                <div className="match-card-grid">
                  <PodiumHit colorClass="text-yellow-200" label="Campeón" team={podiumDetail.champion_team} points={podiumDetail.champion_points} />
                  <PodiumHit colorClass="text-slate-100" label="Subcampeón" team={podiumDetail.runner_up_team} points={podiumDetail.runner_up_points} />
                  <PodiumHit colorClass="text-orange-200" label="3er Puesto" team={podiumDetail.third_place_team} points={podiumDetail.third_place_points} />
                </div>
              </section>
            )}

            {!filteredDetails.length && (!podiumDetail || !podiumDetail.points) ? (
              <div className="mt-5">
                <EmptyState title="Sin puntos" text="No hay partidos con puntos para mostrar." />
              </div>
            ) : (
              <div className="mt-5 grid gap-5">
                {stageOrder.map((stage) => {
                  const rows = detailsByStage[stage] ?? [];
                  if (!rows.length) return null;
                  if (stage === "GROUP") {
                    const byGroup = groupBy(rows, (detail) => asMatch(detail.matches)?.group_name ?? "Sin grupo");
                    return Object.entries(byGroup).map(([group, items]) => (
                      <section className="grid gap-3" key={`${stage}-${group}`}>
                        <h3 className="text-xl font-black">Grupo {group}</h3>
                        <div className="match-card-grid">{items.map((detail) => <DetailCard detail={detail} key={detail.id} />)}</div>
                      </section>
                    ));
                  }
                  return (
                    <section className="grid gap-3" key={stage}>
                      <h3 className="flex items-center gap-2 text-xl font-black"><Trophy className="h-4 w-4 text-gold" />{stageLabels[stage]}</h3>
                      <div className="match-card-grid">{rows.map((detail) => <DetailCard detail={detail} key={detail.id} />)}</div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}


