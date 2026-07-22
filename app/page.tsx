import { EmptyState } from "@/components/empty-state";
import { HomeMatchControls } from "@/components/home-match-controls";
import { HomePrimaryAction } from "@/components/home-primary-action";
import { NotificationBody } from "@/components/notification-body";
import { RankingDescription } from "@/components/ranking-description";
import { ScoreWithPenalty } from "@/components/score-with-penalty";
import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { getAppUserFromServerCookies } from "@/lib/app-auth";
import { getMatches, getPaymentSummary, getRanking } from "@/lib/data";
import { argentinaDateKey, formatArgentinaDateTime } from "@/lib/dates";
import { liveMinuteLabel } from "@/lib/live-minute";
import { isMatchBlockedUntilOfficial, isPlaceholderTeamName } from "@/lib/match-availability";
import { getLatestNotifications } from "@/lib/notifications";
import { rankingRankForIndex } from "@/lib/ranking-position";
import { isPredictionLocked, matchStatus } from "@/lib/scoring";
import { stageLabel } from "@/lib/stage-labels";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { CalendarDays, CheckCircle2, CircleDot, LockKeyhole, Target, Trophy, UnlockKeyhole, UsersRound } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function addArgentinaDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return argentinaDateKey(date);
}

function isBetweenDateKeys(value: string, from: string, to: string) {
  const key = argentinaDateKey(value);
  return key >= from && key <= to;
}

function upcoming(matches: Awaited<ReturnType<typeof getMatches>>, limit: number) {
  const now = Date.now();
  const today = argentinaDateKey(new Date());
  const until = addArgentinaDays(today, 3);
  return matches
    .filter((match) => {
      const status = homeMatchStatus(match);
      const isOpenSoonOrLive = status === "open" || status === "closing_soon" || status === "playing";
      return isOpenSoonOrLive && (status === "playing" || (isBetweenDateKeys(match.kickoff_at, today, until) && new Date(match.kickoff_at).getTime() >= now));
    })
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    .slice(0, limit);
}

function homeMatchStatus(match: Awaited<ReturnType<typeof getMatches>>[number]) {
  const hasResult = match.home_goals != null && match.away_goals != null;
  const status = matchStatus(match.kickoff_at, match.locked, hasResult, new Date(), match.status);
  const kickoff = new Date(match.kickoff_at).getTime();
  const now = Date.now();

  if (!hasResult && (match.status === "closed" || match.locked)) {
    if (now >= kickoff) return "playing";
    return "closing_soon";
  }

  return status;
}

function finalized(matches: Awaited<ReturnType<typeof getMatches>>, limit: number) {
  const today = argentinaDateKey(new Date());
  const yesterday = addArgentinaDays(today, -1);
  return matches
    .filter((match) => {
      const status = matchStatus(match.kickoff_at, match.locked, match.home_goals != null && match.away_goals != null, new Date(), match.status);
      return isBetweenDateKeys(match.kickoff_at, yesterday, today) && status === "closed" && match.home_goals != null && match.away_goals != null;
    })
    .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
    .slice(0, limit);
}

function isHomeCounterBlocked(match: Awaited<ReturnType<typeof getMatches>>[number]) {
  if (isMatchBlockedUntilOfficial(match)) return true;
  if (match.stage === "GROUP") return false;
  return isPlaceholderTeamName(match.home_team) || isPlaceholderTeamName(match.away_team);
}

function homeMatchCounters(matches: Awaited<ReturnType<typeof getMatches>>) {
  const now = new Date();
  const isCounterClosed = (match: Awaited<ReturnType<typeof getMatches>>[number]) =>
    (match.home_goals != null && match.away_goals != null) ||
    match.status === "closed" ||
    match.status === "playing" ||
    isPredictionLocked(match.kickoff_at, match.locked, now);
  const blocked = matches.filter((match) => isHomeCounterBlocked(match)).length;
  const closed = matches.filter((match) => !isHomeCounterBlocked(match) && isCounterClosed(match)).length;
  const open = matches.filter((match) => (match.home_goals == null || match.away_goals == null) && !isHomeCounterBlocked(match) && !isCounterClosed(match)).length;
  return { total: matches.length, open, closed, blocked };
}

function podiumClass(index: number) {
  if (index === 0) return "border-yellow-300/50 bg-yellow-300/12 text-yellow-200";
  if (index === 1) return "border-[#cfd6e6]/60 bg-[#cfd6e6]/14 text-[#c9ced8]";
  if (index === 2) return "border-orange-300/50 bg-orange-400/12 text-orange-200";
  return "border-line";
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

type HomePrediction = {
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  updated_at?: string | null;
  user_updated_at?: string | null;
};

async function getUserPredictionsForMatches(userId: string | undefined, matchIds: string[]) {
  const predictions = new Map<string, HomePrediction>();
  if (!userId || !matchIds.length || !supabaseConfigured()) return predictions;

  try {
    const { data, error } = await supabaseAdmin()
      .from("predictions")
      .select("match_id,home_goals,away_goals,updated_at,user_updated_at")
      .eq("user_id", userId)
      .in("match_id", matchIds);
    if (error) throw error;
    for (const prediction of data ?? []) {
      predictions.set(prediction.match_id, prediction as HomePrediction);
    }
  } catch (error) {
    console.warn("[home:predictions]", error);
  }

  return predictions;
}

export default async function Home() {
  const [allMatches, ranking, paymentSummary, newsItems, currentUser] = await Promise.all([
    getMatches(),
    getRanking(),
    getPaymentSummary(),
    getLatestNotifications(5),
    getAppUserFromServerCookies()
  ]);
  const matches = upcoming(allMatches, 6);
  const finishedMatches = finalized(allMatches, 6);
  const currentUserPredictions = await getUserPredictionsForMatches(currentUser?.id, matches.map((match) => match.id));
  const currentUserPoints = currentUser ? ranking.find((row) => row.user_id === currentUser.id)?.total_points ?? 0 : 0;
  const matchCounters = homeMatchCounters(allMatches);
  const freshNewsItems = newsItems.filter((item) => {
    const createdAt = new Date(item.created_at).getTime();
    return item.type !== "closed" && Number.isFinite(createdAt) && Date.now() - createdAt <= 24 * 60 * 60 * 1000;
  });

  return (
    <div className="grid gap-6">
      <section className="panel hero-pitch p-5 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <h1 className="max-w-3xl font-black leading-tight">
            <span className="block text-5xl sm:text-7xl">Mundialito</span>
            <span className="mt-2 block text-3xl sm:text-5xl">Prode entre amigos</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold text-white/86">
            La experiencia de vivir el Mundial de manera divertida, con un fin solidario y una interfaz unica.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomePrimaryAction />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="panel p-4">
          <span className="flex items-center gap-2 text-sm font-bold text-ink/60">
            <CircleDot className="h-4 w-4 text-blue-300" />
            Totales
          </span>
          <strong className="block text-3xl">{matchCounters.total}</strong>
        </article>
        <article className="panel p-4">
          <span className="flex items-center gap-2 text-sm font-bold text-ink/60">
            <UnlockKeyhole className="h-4 w-4 text-grass" />
            Abiertos
          </span>
          <strong className="block text-3xl">{matchCounters.open}</strong>
        </article>
        <article className="panel p-4">
          <span className="flex items-center gap-2 text-sm font-bold text-ink/60">
            <CheckCircle2 className="h-4 w-4 text-slate-200" />
            Cerrados
          </span>
          <strong className="block text-3xl">{matchCounters.closed}</strong>
        </article>
        <article className="panel p-4">
          <span className="flex items-center gap-2 text-sm font-bold text-ink/60">
            <LockKeyhole className="h-4 w-4 text-sky-200" />
            Bloqueados
          </span>
          <strong className="block text-3xl">{matchCounters.blocked}</strong>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="grid content-start gap-4">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="text-xl font-black">Próximos partidos</h2>
            </div>
            {!matches.length ? (
              <EmptyState title="Todavía no hay partidos" text="Cargá el calendario desde Admin para empezar." />
            ) : (
              <div className="grid">
                {matches.map((match) => (
                  <article className="home-upcoming-card grid gap-3 border-b border-line p-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center" key={match.id}>
                    <div>
                      <div className="text-sm font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</div>
                      <h3 className="flex flex-wrap items-center gap-2 text-xl font-black">
                        <TeamLabel name={match.home_team} code={match.home_country_code} />
                        <span className="text-ink/40">vs</span>
                        <TeamLabel name={match.away_team} code={match.away_country_code} />
                      </h3>
                      <p className="text-sm text-ink/70">{[match.group_name ? `Grupo ${match.group_name}` : stageLabel(match.stage), match.stadium].filter(Boolean).join(" - ")}</p>
                    </div>
                    <HomeMatchControls
                      actualAwayGoals={homeMatchStatus(match) === "playing" ? match.away_goals ?? 0 : match.away_goals}
                      actualAwayPenaltyGoals={match.away_penalty_goals}
                      actualHomeGoals={homeMatchStatus(match) === "playing" ? match.home_goals ?? 0 : match.home_goals}
                      actualHomePenaltyGoals={match.home_penalty_goals}
                      disabled={
                        !currentUser ||
                        isMatchBlockedUntilOfficial(match) ||
                        isPredictionLocked(match.kickoff_at, Boolean(match.locked)) ||
                        homeMatchStatus(match) === "playing"
                      }
                      initialPrediction={currentUser ? currentUserPredictions.get(match.id) : undefined}
                      isPlaying={homeMatchStatus(match) === "playing"}
                      liveMinute={liveMinuteLabel(match.kickoff_at)}
                      matchId={match.id}
                      matchUpdatedAt={match.result_updated_at}
                      status={isMatchBlockedUntilOfficial(match) ? "locked" : homeMatchStatus(match)}
                      statusLabel={isMatchBlockedUntilOfficial(match) ? "Bloqueado" : undefined}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="text-xl font-black">Partidos finalizados</h2>
            </div>
            {!finishedMatches.length ? (
              <EmptyState title="Sin finalizados recientes" text="Cuando terminen partidos de hoy o ayer, aparecen aca." />
            ) : (
              <div className="grid">
                {finishedMatches.map((match) => (
                  <article className="home-upcoming-card grid gap-3 border-b border-line p-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center" key={match.id}>
                    <div>
                      <div className="text-sm font-bold text-ink/60">{formatArgentinaDateTime(match.kickoff_at)}</div>
                      <h3 className="flex flex-wrap items-center gap-2 text-xl font-black">
                        <TeamLabel name={match.home_team} code={match.home_country_code} />
                        <span className="text-ink/40">vs</span>
                        <TeamLabel name={match.away_team} code={match.away_country_code} />
                      </h3>
                      <p className="text-sm text-ink/70">{[match.group_name ? `Grupo ${match.group_name}` : stageLabel(match.stage), match.stadium].filter(Boolean).join(" - ")}</p>
                    </div>
                    <div className="grid justify-items-start gap-2 sm:justify-items-end">
                      <div className="home-match-status-row flex w-full flex-nowrap items-center justify-end gap-2">
                        <StatusPill status="closed" label="Cerrado" />
                      </div>
                      <div className="grid grid-cols-[52px_52px] gap-2">
                        <div className="grid h-10 place-items-center rounded-lg border border-line bg-field text-sm font-black text-ink" aria-label={`Goles ${match.home_team}`}>
                          <ScoreWithPenalty penalty={match.home_penalty_goals} score={match.home_goals ?? ""} />
                        </div>
                        <div className="grid h-10 place-items-center rounded-lg border border-line bg-field text-sm font-black text-ink" aria-label={`Goles ${match.away_team}`}>
                          <ScoreWithPenalty penalty={match.away_penalty_goals} score={match.away_goals ?? ""} />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

        </div>

        <div className="grid content-start gap-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="panel grid min-h-[108px] content-center justify-items-center border-grass/30 bg-grass/10 p-3 text-center">
              <Trophy className="h-6 w-6 text-grass" />
              <p className="mt-2 whitespace-nowrap text-lg font-black text-grass sm:text-xl xl:text-2xl">{money(paymentSummary.prizePool)}</p>
            </article>
            <article className="panel grid min-h-[108px] content-center justify-items-center border-blue-300/30 bg-blue-950/20 p-3 text-center">
              <UsersRound className="h-6 w-6 text-blue-300" />
              <p className="mt-2 whitespace-nowrap text-lg font-black text-blue-300 sm:text-xl xl:text-2xl">{paymentSummary.totalParticipants}</p>
            </article>
            <article className="panel grid min-h-[108px] content-center justify-items-center border-red-400/30 bg-red-950/20 p-3 text-center">
              <Target className="h-6 w-6 text-red-400" />
              <p className="mt-2 whitespace-nowrap text-lg font-black text-red-400 sm:text-xl xl:text-2xl">{currentUserPoints} Pts</p>
            </article>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <Trophy className="h-5 w-5 text-gold" />
              <h2 className="text-xl font-black">Ranking</h2>
            </div>
            {!ranking.length ? (
              <p className="p-5 text-sm font-semibold text-ink/65">Todavía no hay ranking.</p>
            ) : (
              ranking.slice(0, 3).map((row, index) => {
                const rank = rankingRankForIndex(ranking, index);
                return (
                <div className={`grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b p-4 last:border-0 ${podiumClass(rank - 1)}`} key={row.user_id}>
                  <strong className="text-xl font-black">#{rank}</strong>
                  <div>
                    <strong className="text-xl font-black">{row.display_name}</strong>
                    <RankingDescription
                      className="mt-0.5 flex text-xs text-ink/60"
                      exacts={row.exact_hits}
                      trends={row.trend_hits}
                      championPoints={row.podium_champion_points}
                      runnerUpPoints={row.podium_runner_up_points}
                      thirdPlacePoints={row.podium_third_place_points}
                    />
                  </div>
                  <div className="text-right">
                    <strong className="block text-2xl font-black">{row.total_points}</strong>
                    <span className="text-xs font-black uppercase text-ink/45">Pts</span>
                  </div>
                </div>
                );
              })
            )}
            <div className="p-4">
              <Link className="btn secondary w-full" href="/ranking">Ver ranking completo</Link>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <CalendarDays className="h-5 w-5 text-gold" />
              <h2 className="text-xl font-black">Novedades</h2>
            </div>
            {!freshNewsItems.length ? (
              <p className="p-5 text-sm font-semibold text-ink/65">No hay novedades de las ultimas 24 horas.</p>
            ) : (
              freshNewsItems.map((item) => (
                <div className="border-b border-line p-4 last:border-0" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-black">{item.title}</h3>
                    <time className="text-xs font-black text-ink/45" dateTime={item.created_at}>
                      {formatArgentinaDateTime(item.created_at)}
                    </time>
                  </div>
                  <NotificationBody item={item} compact />
                </div>
              ))
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
