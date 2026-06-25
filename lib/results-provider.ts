export type ProviderResult = {
  providerMatchId: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  penaltyWinner?: string | null;
  status: "playing" | "closed";
  playedAt?: string | null;
  statusOnly?: boolean;
};

export type ProviderFixture = {
  providerMatchId: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCode?: string | null;
  awayCode?: string | null;
  kickoffAt: string;
  stadium?: string | null;
  stage: "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD_PLACE" | "FINAL";
  groupName?: string | null;
};

type WorldCupApiMatch = {
  id?: number | string;
  fixture_id?: number | string;
  status?: string;
  date?: string;
  home?: { name?: string };
  away?: { name?: string };
  scores?: {
    score?: string;
    ft_score?: string;
    et_score?: string;
    ps_score?: string;
  };
  outcomes?: {
    penalty_shootout?: "1" | "2" | "X" | null;
  };
};

function parseScore(score: string | null | undefined) {
  if (!score) return null;
  const match = score.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return { home: Number(match[1]), away: Number(match[2]) };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const footballDataTlaToIso2: Record<string, string> = {
  ARG: "ar",
  AUS: "au",
  BEL: "be",
  BRA: "br",
  CAN: "ca",
  CHI: "cl",
  COL: "co",
  CRO: "hr",
  DEN: "dk",
  ECU: "ec",
  ENG: "gb-eng",
  ESP: "es",
  FRA: "fr",
  GER: "de",
  IRN: "ir",
  ITA: "it",
  JPN: "jp",
  KOR: "kr",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NZL: "nz",
  PAR: "py",
  POL: "pl",
  POR: "pt",
  QAT: "qa",
  KSA: "sa",
  SCO: "gb-sct",
  SEN: "sn",
  SRB: "rs",
  SUI: "ch",
  TUN: "tn",
  URU: "uy",
  USA: "us",
  WAL: "gb-wls"
};

function footballDataCodeToFlagCode(tla: string | null | undefined) {
  if (!tla) return null;
  return footballDataTlaToIso2[tla.toUpperCase()] ?? null;
}

export function teamsMatch(a: string, b: string) {
  return normalizeName(a) === normalizeName(b);
}

function normalizeWorldCupApiMatch(match: WorldCupApiMatch): ProviderResult | null {
  if (match.status !== "FINISHED") return null;
  const homeTeam = match.home?.name;
  const awayTeam = match.away?.name;
  const score = parseScore(match.scores?.et_score || match.scores?.ft_score || match.scores?.score);
  if (!homeTeam || !awayTeam || !score) return null;

  let penaltyWinner: string | null = null;
  if (match.outcomes?.penalty_shootout === "1") penaltyWinner = homeTeam;
  if (match.outcomes?.penalty_shootout === "2") penaltyWinner = awayTeam;

  return {
    providerMatchId: String(match.fixture_id ?? match.id ?? `${homeTeam}-${awayTeam}-${match.date ?? ""}`),
    homeTeam,
    awayTeam,
    homeGoals: score.home,
    awayGoals: score.away,
    penaltyWinner,
    status: "closed",
    playedAt: match.date ?? null
  };
}

export async function fetchWorldCupApiResults() {
  const key = process.env.WORLD_CUP_API_KEY;
  if (!key) throw new Error("Missing WORLD_CUP_API_KEY");

  const dateTo = new Date().toISOString().slice(0, 10);
  const url = new URL("https://api.worldcupapi.com/history");
  url.searchParams.set("key", key);
  url.searchParams.set("date_to", dateTo);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`WorldCupAPI history failed: ${res.status}`);
  const data = (await res.json()) as WorldCupApiMatch[];
  return data.map(normalizeWorldCupApiMatch).filter((item): item is ProviderResult => Boolean(item));
}

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage?: string;
  group?: string;
  homeTeam?: { name?: string; tla?: string };
  awayTeam?: { name?: string; tla?: string };
  score?: {
    winner?: string;
    fullTime?: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
};

type ApiFootballFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string | null;
      elapsed?: number | null;
    };
  };
  league?: {
    id?: number;
    season?: number;
    name?: string | null;
    round?: string | null;
  };
  teams?: {
    home?: { name?: string | null; code?: string | null };
    away?: { name?: string | null; code?: string | null };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
};

function mapFootballDataStage(stage?: string): ProviderFixture["stage"] {
  const clean = (stage ?? "").toUpperCase();
  if (clean.includes("LAST_32")) return "R32";
  if (clean.includes("LAST_16")) return "R16";
  if (clean.includes("QUARTER")) return "QF";
  if (clean.includes("SEMI")) return "SF";
  if (clean.includes("THIRD")) return "THIRD_PLACE";
  if (clean.includes("FINAL")) return "FINAL";
  return "GROUP";
}

function mapFootballDataGroup(group?: string | null) {
  if (!group) return null;
  const match = group.match(/^GROUP_?([A-L])$/i);
  return match ? match[1].toUpperCase() : group.replace(/^GROUP[_\s-]*/i, "");
}

function footballDataHeaders() {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) throw new Error("Missing FOOTBALL_DATA_API_KEY");
  return { "X-Auth-Token": token };
}

export async function fetchFootballDataFixtures(): Promise<ProviderFixture[]> {
  const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
  const res = await fetch(url, { headers: footballDataHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`football-data fixtures failed: ${res.status}`);
  const data = (await res.json()) as { matches?: FootballDataMatch[] };

  return (data.matches ?? [])
    .map((match) => {
      const stage = mapFootballDataStage(match.stage);
      const homeTeam = match.homeTeam?.name ?? null;
      const awayTeam = match.awayTeam?.name ?? null;
      return {
        providerMatchId: String(match.id),
        homeTeam,
        awayTeam,
        homeCode: footballDataCodeToFlagCode(match.homeTeam?.tla),
        awayCode: footballDataCodeToFlagCode(match.awayTeam?.tla),
        kickoffAt: match.utcDate,
        stadium: null,
        stage,
        groupName: mapFootballDataGroup(match.group)
      };
    })
    .filter((match) => (match.stage === "GROUP" ? Boolean(match.homeTeam && match.awayTeam) : Boolean(match.homeTeam || match.awayTeam)));
}

export async function fetchFootballDataResults(): Promise<ProviderResult[]> {
  const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
  const res = await fetch(url, { headers: footballDataHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`football-data results failed: ${res.status}`);
  const data = (await res.json()) as { matches?: FootballDataMatch[] };

  const results: ProviderResult[] = [];
  for (const match of data.matches ?? []) {
    if (!["IN_PLAY", "LIVE", "PAUSED", "FINISHED"].includes(match.status)) continue;
    const homeTeam = match.homeTeam?.name;
    const awayTeam = match.awayTeam?.name;
    const score = match.score?.fullTime ?? match.score?.regularTime;
    if (!homeTeam || !awayTeam) continue;
    if (score?.home == null || score.away == null) {
      results.push({
        providerMatchId: String(match.id),
        homeTeam,
        awayTeam,
        homeGoals: null,
        awayGoals: null,
        penaltyWinner: null,
        status: match.status === "FINISHED" ? "closed" : "playing",
        playedAt: match.utcDate,
        statusOnly: true
      });
      continue;
    }
    results.push({
      providerMatchId: String(match.id),
      homeTeam,
      awayTeam,
      homeGoals: score.home,
      awayGoals: score.away,
      penaltyWinner: null,
      status: match.status === "FINISHED" ? "closed" : "playing",
      playedAt: match.utcDate
    });
  }
  return results;
}

function apiFootballHeaders() {
  const token = process.env.API_FOOTBALL_KEY?.replace(/^\uFEFF/, "").trim();
  if (!token) throw new Error("Missing API_FOOTBALL_KEY");
  return { "x-apisports-key": token };
}

function apiFootballStatus(short?: string | null): ProviderResult["status"] | null {
  const clean = (short ?? "").toUpperCase();
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(clean)) return "playing";
  if (["FT", "AET", "PEN"].includes(clean)) return "closed";
  return null;
}

function apiFootballGoals(match: ApiFootballFixture, status: ProviderResult["status"]) {
  if (status === "closed") {
    const extra = match.score?.extratime;
    const full = match.score?.fulltime;
    if (extra?.home != null && extra.away != null) return { home: extra.home, away: extra.away };
    if (full?.home != null && full.away != null) return { home: full.home, away: full.away };
  }
  if (match.goals?.home != null && match.goals.away != null) return { home: match.goals.home, away: match.goals.away };
  return null;
}

function apiFootballPenaltyWinner(match: ApiFootballFixture, homeTeam: string, awayTeam: string) {
  const penalty = match.score?.penalty;
  if (penalty?.home == null || penalty.away == null || penalty.home === penalty.away) return null;
  return penalty.home > penalty.away ? homeTeam : awayTeam;
}

function isApiFootballWorldCupFixture(match: ApiFootballFixture) {
  const configuredLeagueId = process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID;
  const configuredSeason = process.env.API_FOOTBALL_SEASON ?? "2026";
  const leagueId = match.league?.id == null ? null : String(match.league.id);
  const season = match.league?.season == null ? null : String(match.league.season);
  const leagueName = normalizeName(match.league?.name ?? "");

  if (configuredLeagueId && leagueId !== configuredLeagueId) return false;
  if (season && season !== configuredSeason) return false;
  if (configuredLeagueId) return true;
  return leagueName.includes("world cup");
}

function normalizeApiFootballFixture(match: ApiFootballFixture): ProviderResult | null {
  if (!isApiFootballWorldCupFixture(match)) return null;
  const status = apiFootballStatus(match.fixture?.status?.short);
  if (!status) return null;
  const homeTeam = match.teams?.home?.name;
  const awayTeam = match.teams?.away?.name;
  if (!homeTeam || !awayTeam) return null;
  const goals = apiFootballGoals(match, status);
  if (!goals) return null;

  return {
    providerMatchId: String(match.fixture?.id ?? `${homeTeam}-${awayTeam}-${match.fixture?.date ?? ""}`),
    homeTeam,
    awayTeam,
    homeGoals: goals.home,
    awayGoals: goals.away,
    penaltyWinner: apiFootballPenaltyWinner(match, homeTeam, awayTeam),
    status,
    playedAt: match.fixture?.date ?? null
  };
}

async function fetchApiFootballFixturePage(params: Record<string, string>) {
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url, { headers: apiFootballHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`api-football results failed: ${res.status}`);
  const data = (await res.json()) as { response?: ApiFootballFixture[] };
  const errors = (data as { errors?: unknown }).errors;
  if (errors && JSON.stringify(errors) !== "[]" && JSON.stringify(errors) !== "{}") {
    throw new Error(`api-football results failed: ${JSON.stringify(errors)}`);
  }
  return data.response ?? [];
}

export async function fetchApiFootballResults(): Promise<ProviderResult[]> {
  const pages = [await fetchApiFootballFixturePage({ live: "all" })];

  const resultsByFixture = new Map<string, ProviderResult>();
  for (const match of pages.flat()) {
    const result = normalizeApiFootballFixture(match);
    if (!result) continue;
    const existing = resultsByFixture.get(result.providerMatchId);
    if (!existing || (existing.status === "playing" && result.status === "closed")) {
      resultsByFixture.set(result.providerMatchId, result);
    }
  }
  const liveResults = [...resultsByFixture.values()];
  const statusResults = await fetchFootballDataResults().catch(() => []);
  const liveIds = new Set(liveResults.map((item) => item.providerMatchId));
  return [...liveResults, ...statusResults.filter((item) => !liveIds.has(item.providerMatchId))];
}

export async function fetchProviderResults() {
  const detailed = await fetchProviderResultsDetailed();
  return detailed.results;
}

export async function fetchProviderResultsDetailed(options: { allowLiveProvider?: boolean } = {}): Promise<{ results: ProviderResult[]; provider: string; providerWarning?: string }> {
  const provider =
    options.allowLiveProvider === false
      ? "football-data"
      : options.allowLiveProvider === true && process.env.API_FOOTBALL_KEY
        ? "api-football"
        : (process.env.LIVE_RESULTS_PROVIDER ?? process.env.RESULTS_PROVIDER ?? "football-data");
  if (provider === "api-football") {
    try {
      return { results: await fetchApiFootballResults(), provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : "api-football failed";
      return {
        results: await fetchFootballDataResults(),
        provider: "football-data",
        providerWarning: `${message}. Se uso football-data como respaldo.`
      };
    }
  }
  if (provider === "football-data") return { results: await fetchFootballDataResults(), provider };
  if (provider === "worldcupapi") return { results: await fetchWorldCupApiResults(), provider };
  if (provider === "mock") return { results: [], provider };
  throw new Error(`Unsupported RESULTS_PROVIDER: ${provider}`);
}

export async function fetchProviderFixtures() {
  const provider = process.env.RESULTS_PROVIDER ?? "football-data";
  if (provider === "football-data") return fetchFootballDataFixtures();
  throw new Error(`Provider ${provider} does not support fixture import yet`);
}
