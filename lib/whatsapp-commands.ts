import { getMatches, getRanking, type RankingRow } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { displayNameForTeam, flagEmojiForTeam, searchKeysForTeam } from "@/lib/flags";
import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { formatScoreWithPenalties } from "@/lib/match-score";
import { getPodiumLockState, recalculateAllPodiumPoints, validatePodiumTeams } from "@/lib/podium";
import { rankingRankForIndex, rankingPrefix } from "@/lib/ranking-position";
import { isPredictionLocked } from "@/lib/scoring";
import { stageLabel } from "@/lib/stage-labels";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { ICONS } from "@/lib/message-icons";

function argentinaDisplayDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}`;
}

function argentinaMatchDate(value: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}`;
}

type PendingMatch = {
  id?: string;
  home_team: string;
  away_team: string;
  home_country_code?: string | null;
  away_country_code?: string | null;
  kickoff_at: string;
  stage?: string | null;
  group_name?: string | null;
  home_goals?: number | null;
  away_goals?: number | null;
  home_penalty_goals?: number | null;
  away_penalty_goals?: number | null;
  locked?: boolean | null;
  status?: string | null;
};

type MatchLite = PendingMatch & {
  id: string;
  stage: string;
};

function isPendingPredictionCandidate(match: PendingMatch) {
  if (match.status === "locked" || match.status === "scheduled" || match.status === "closed" || match.status === "final") return false;
  if (isMatchBlockedUntilOfficial({ stage: match.stage ?? "GROUP", status: match.status, home_team: match.home_team, away_team: match.away_team })) return false;
  if (isPredictionLocked(match.kickoff_at, Boolean(match.locked))) return false;
  return true;
}

export function stripSelfCommandPrefix(text: string) {
  return text.trim().replace(/^\$\s*/, "");
}

export function isWhatsAppCommand(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("$")) return false;
  const clean = normalizeText(stripSelfCommandPrefix(trimmed));
  return (
    /\b(predigo|apuesto|pronostico)\b/.test(clean) ||
    clean.includes("ranking") ||
    clean.includes("tabla") ||
    clean.includes("pendiente") ||
    clean.includes("pronostico") ||
    clean.includes("pronosticos") ||
    clean.includes("podio") ||
    clean.includes("regla") ||
    clean.includes("partido") ||
    clean.includes("fixture") ||
    clean.includes("calendario") ||
    clean.includes("resultado") ||
    clean.includes("marcador") ||
    clean.includes("ayuda") ||
    clean.includes("carga") ||
    clean.includes("comando")
  );
}

function parsePrediction(text: string) {
  const input = stripSelfCommandPrefix(text);
  const match = input.match(/(?:predigo|apuesto|pronostico)\s+(.+?)\s+(?:vs|v|contra)\s+(.+?)\s+(\d+)\s*[-:]\s*(\d+)/i);
  if (!match) return null;
  return {
    homeTeam: match[1].trim(),
    awayTeam: match[2].trim(),
    homeGoals: Number(match[3]),
    awayGoals: Number(match[4])
  };
}

function parseBulkPredictionLine(line: string) {
  const clean = line
    .replace(/\s*\|\s*Ganador:.+$/i, "")
    .replace(/\s+Ganador:.+$/i, "")
    .trim();
  const match = clean.match(/^(.+?)\s+(\d+)\s*[-:]\s*(\d+)\s+(.+)$/);
  if (!match) return null;
  return {
    homeTeam: match[1].trim(),
    homeGoals: Number(match[2]),
    awayGoals: Number(match[3]),
    awayTeam: match[4].trim()
  };
}

function extractBulkPayload(text: string) {
  return stripSelfCommandPrefix(text)
    .replace(/^carga\b[:\s-]*/i, "")
    .trim();
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function teamSearchAliases(value: string) {
  const compact = normalizeText(value).replace(/[.\s_-]+/g, "");
  if (compact === "usa" || compact === "eeuu" || compact === "estadosunidos") {
    return ["usa", "eeuu", "estados unidos", "united states"];
  }
  return [value];
}

function normalizePhone(value: string) {
  return value
    .replace(/@.+$/, "")
    .replace(/:.+$/, "")
    .replace(/\D/g, "");
}

function phonesMatch(left: string, right: string) {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && b && (a === b || a.endsWith(b) || b.endsWith(a)));
}

function teamsAreClose(query: string, team: string) {
  const queryAliases = teamSearchAliases(query).map(normalizeText);
  const teamAliases = teamSearchAliases(team).map(normalizeText);
  const t = normalizeText(team);
  return queryAliases.some((q) =>
    teamAliases.some((candidate) => candidate.includes(q) || q.includes(candidate)) ||
    t.includes(q) ||
    q.includes(t) ||
    t.split(/\s+/).some((part) => part.length >= 3 && q.includes(part))
  );
}

function matchTeamQuery(query: string, team: string, code?: string | null) {
  if (!query) return true;
  const queryAliases = teamSearchAliases(query).map((item) => normalizeText(item).replace(/[.\s_-]+/g, ""));
  const keys = searchKeysForTeam(team, code);
  return queryAliases.some((q) => {
    if (q.length <= 3) return keys.some((key) => key === q);
    return keys.some((key) => key === q || key.startsWith(q));
  });
}

function matchQueryAgainstMatch(query: string, match: Pick<MatchLite, "home_team" | "away_team" | "home_country_code" | "away_country_code">) {
  return matchTeamQuery(query, match.home_team, match.home_country_code) || matchTeamQuery(query, match.away_team, match.away_country_code);
}

function flagEmoji(team: string, explicit?: string | null) {
  return flagEmojiForTeam(team, explicit);
}

function matchLabel(match: Pick<MatchLite, "home_team" | "away_team" | "home_country_code" | "away_country_code">) {
  return `${flagEmoji(match.home_team, match.home_country_code)} ${displayNameForTeam(match.home_team)} vs ${flagEmoji(match.away_team, match.away_country_code)} ${displayNameForTeam(match.away_team)}`;
}

function extractTeamQuery(text: string) {
  return stripSelfCommandPrefix(text)
    .replace(/^(partidos?|fixture|calendario|resultados?|pendientes?|pronosticos?|podioanticipado|podio|ranking|tabla|reglas?|comandos?|ayuda)\b/gi, "")
    .replace(/^(de|del|para|ver|quiero|como va|cÃ³mo va)\s+/gi, "")
    .trim();
}

function answerRules() {
  return [
    "ðŸ“‹ *Reglas del Mundialito*",
    "",
    "âœ… *Tendencia correcta*",
    "Gana local, gana visitante o empate = *1 punto*.",
    "",
    "ðŸŽ¯ *Resultado exacto*",
    "Si ademÃ¡s acertÃ¡s los goles exactos = *+2 puntos extra*.",
    "Aplica igual en grupos y eliminatorias.",
    "En eliminatorias cuenta el resultado de los *120 minutos*.",
    "",
    "ðŸ† *Podio anticipado*",
    "CampeÃ³n = *3 pts*, SubcampeÃ³n = *2 pts*, 3er puesto = *1 pt*.",
    "Se carga hasta 15 minutos antes del primer partido de 16vos.",
    "",
    "âš½ *Ejemplos*",
    "ðŸ‡¦ðŸ‡· Argentina 2-1 ðŸ‡²ðŸ‡½ Mexico",
    "_Tu apuesta 1-0 = 1 punto_",
    "",
    "ðŸ‡§ðŸ‡· Brasil 3-1 ðŸ‡²ðŸ‡¦ Marruecos",
    "_Tu apuesta 3-1 = 3 puntos_",
    "",
    "ðŸ¤ Real 0-0 y apuesta 1-1 = *1 punto* por empate."
  ].join("\n");
}

function answerCommands() {
  return [
    "âš½ *Comandos Mundialito*",
    "",
    "ðŸ† *$ranking*",
    "Tabla completa del prode.",
    "",
    "_Sin filtro:_",
    "_$ranking_",
    "",
    "ðŸ“‹ *$reglas*",
    "Puntos, estados y podio anticipado.",
    "",
    "_Sin filtro:_",
    "_$reglas_",
    "",
    `${ICONS.calendar} *$partidos*`,
    "Próximos partidos.",
    "",
    "_Sin filtro:_",
    "_$partidos_",
    "",
    "_Con filtro:_",
    "_$partidos Argentina_",
    "",
    "ðŸ *$resultados*",
    "Marcadores reales cargados.",
    "",
    "_Sin filtro:_",
    "_$resultados_",
    "",
    "_Con filtro:_",
    "_$resultados Brasil_",
    "",
    "â³ *$pendientes*",
    "PronÃ³sticos abiertos que te faltan cargar. No incluye cerrados, bloqueados ni partidos que ya cargaste.",
    "",
    "_Sin filtro:_",
    "_$pendientes_",
    "",
    "âš½ *$pronosticos*",
    "Tu historia cargada para copiar.",
    "",
    "_Sin filtro:_",
    "_$pronosticos_",
    "",
    "ðŸ† *$podio*",
    "CampeÃ³n, subcampeÃ³n y 3er puesto.",
    "",
    "_Sin cargar:_",
    "_$podio_",
    "",
    "_Para cargar:_",
    "_$podio Argentina Brasil Uruguay_",
    "",
    "âœï¸ *$carga*",
    "Carga masiva de pronÃ³sticos.",
    "",
    "_Sin carga:_",
    "_$carga_",
    "",
    "_Con carga:_",
    "_$carga_",
    "_Argentina 2-1 Mexico_",
    "_Brasil 3-1 Marruecos_",
    "",
    "ðŸ§­ *$comandos*",
    "Ver esta ayuda.",
    "",
    "_Sin filtro:_",
    "_$comandos_"
  ].join("\n");
}
function extractPodiumPayload(text: string) {
  return stripSelfCommandPrefix(text).replace(/^podio(?:anticipado)?\b[:\s-]*/i, "").trim();
}

function splitPodiumTeams(payload: string, teams?: Array<{ name: string; code?: string | null }>) {
  const separated = payload
    .split(/\s*(?:\||,|>|;|\n)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (separated.length >= 3 || !teams?.length) return separated;

  const words = payload.trim().split(/\s+/).filter(Boolean);
  const normalizedTeams = teams.map((team) => ({
    ...team,
    displayKey: normalizeText(displayNameForTeam(team.name)),
    key: normalizeText(team.name)
  }));
  const isKnownTeam = (value: string) => {
    const key = normalizeText(value);
    return normalizedTeams.some((team) => key === team.key || key === team.displayKey);
  };

  for (let first = 1; first <= words.length - 2; first += 1) {
    for (let second = first + 1; second <= words.length - 1; second += 1) {
      const candidates = [
        words.slice(0, first).join(" "),
        words.slice(first, second).join(" "),
        words.slice(second).join(" ")
      ];
      if (candidates.every(isKnownTeam)) return candidates;
    }
  }

  return separated;
}

async function getSelectableTeams(db: ReturnType<typeof supabaseAdmin>) {
  const { data, error } = await db
    .from("matches")
    .select("home_team,away_team,home_country_code,away_country_code,stage")
    .eq("stage", "GROUP");
  if (error) throw error;

  const teams = new Map<string, { name: string; code?: string | null }>();
  for (const match of data ?? []) {
    [
      { name: match.home_team, code: match.home_country_code },
      { name: match.away_team, code: match.away_country_code }
    ].forEach((team) => {
      const display = displayNameForTeam(team.name);
      const key = normalizeText(display);
      if (!teams.has(key)) teams.set(key, { name: display, code: team.code });
    });
  }
  return [...teams.values()];
}

function findSelectableTeam(query: string, teams: Array<{ name: string; code?: string | null }>) {
  return teams.find((team) => teamsAreClose(query, team.name) || teamsAreClose(query, displayNameForTeam(team.name))) ?? null;
}

function podiumTeamLine(label: string, team?: string | null, points?: number | null) {
  if (!team) return `${label}: _sin cargar_`;
  return `${label}: ${flagEmoji(team)} ${displayNameForTeam(team)}${points != null ? ` - *${points} pts*` : ""}`;
}

async function answerPodio(text: string, from?: string) {
  if (!supabaseConfigured()) return "âš½ *Mundialito*\nTodavÃ­a no estÃ¡ lista la base. ProbÃ¡ de nuevo en unos minutos.";

  const profile = await findProfileByPhone(from);
  if (!profile) return "âš½ *Podio anticipado*\nNo tengo registrado tu WhatsApp como participante.";
  if (!profile.paid) return "ðŸ† *Podio anticipado*\nTenÃ©s el pago pendiente. Cuando quede confirmado, se habilita la carga.";

  const db = supabaseAdmin();
  const payload = extractPodiumPayload(text);
  const lockState = await getPodiumLockState(db);

  if (!payload) {
    const { data, error } = await db.from("podium_predictions").select("*").eq("user_id", profile.id).maybeSingle();
    if (error) throw error;
    return [
      "ðŸ† *Podio anticipado*",
      podiumTeamLine("CampeÃ³n +3", data?.champion_team, data?.champion_points),
      podiumTeamLine("SubcampeÃ³n +2", data?.runner_up_team, data?.runner_up_points),
      podiumTeamLine("3er puesto +1", data?.third_place_team, data?.third_place_points),
      "",
      lockState.locked ? "El podio ya estÃ¡ cerrado." : "Para cargarlo:",
      lockState.locked ? "" : "_$podio Argentina Brasil Uruguay_"
    ].join("\n");
  }

  if (lockState.locked) {
    return `ðŸ† *Podio anticipado*\n${lockState.reason ?? "El podio ya estÃ¡ cerrado."}`;
  }

  const selectableTeams = await getSelectableTeams(db);
  const rawTeams = splitPodiumTeams(payload, selectableTeams);
  if (rawTeams.length !== 3) {
    return [
      "ðŸ† *Podio anticipado*",
      "Mandame 3 selecciones en orden: campeÃ³n, subcampeÃ³n y 3er puesto.",
      "",
      "Ejemplo:",
      "_$podio Argentina Brasil Uruguay_"
    ].join("\n");
  }

  const selected = rawTeams.map((team) => findSelectableTeam(team, selectableTeams));
  if (selected.some((team) => !team)) {
    return [
      "ðŸ† *Podio anticipado*",
      "No encontrÃ© una de esas selecciones en el fixture.",
      "ProbÃ¡ con nombres como Argentina, Brasil, Francia."
    ].join("\n");
  }

  const [champion, runnerUp, thirdPlace] = selected as Array<{ name: string; code?: string | null }>;
  if (!validatePodiumTeams(champion.name, runnerUp.name, thirdPlace.name)) {
    return "ðŸ† *Podio anticipado*\nNo podÃ©s repetir selecciÃ³n en el podio.";
  }

  const { error } = await db
    .from("podium_predictions")
    .upsert(
      {
        user_id: profile.id,
        champion_team: champion.name,
        runner_up_team: runnerUp.name,
        third_place_team: thirdPlace.name
      },
      { onConflict: "user_id" }
    );
  if (error) throw error;

  await recalculateAllPodiumPoints(db);

  return [
    "âœ… *Podio guardado*",
    podiumTeamLine("CampeÃ³n +3", champion.name),
    podiumTeamLine("SubcampeÃ³n +2", runnerUp.name),
    podiumTeamLine("3er puesto +1", thirdPlace.name),
    "",
    "PodÃ©s verlo cuando quieras con *$podio*."
  ].join("\n");
}

function rankingLine(
  ranking: Pick<RankingRow, "user_id" | "display_name" | "total_points" | "exact_hits" | "trend_hits">[],
  row: Pick<RankingRow, "user_id" | "display_name" | "total_points" | "exact_hits" | "trend_hits">,
  index: number,
  highlightedUserId?: string | null
) {
  const rank = rankingRankForIndex(ranking, index);
  const prefix = rankingPrefix(rank);
  if (highlightedUserId && row.user_id === highlightedUserId) return `*${prefix} ${row.display_name} - ${row.total_points} pts*`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

function rankingLineForGroupCommand(
  ranking: Pick<RankingRow, "user_id" | "display_name" | "total_points" | "exact_hits" | "trend_hits">[],
  row: Pick<RankingRow, "user_id" | "display_name" | "total_points" | "exact_hits" | "trend_hits">,
  index: number
) {
  const rank = rankingRankForIndex(ranking, index);
  const prefix = rankingPrefix(rank);
  if (rank <= 3) return `*${prefix} ${row.display_name} - ${row.total_points} pts*`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

export async function findProfileByPhone(from?: string) {
  if (!from || !supabaseConfigured()) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.from("profiles").select("*").not("phone", "is", null);
  if (error) throw error;
  return (data ?? []).find((profile) => phonesMatch(from, profile.phone ?? "")) ?? null;
}

async function savePredictionFromWhatsApp(text: string, from?: string) {
  const prediction = parsePrediction(text);
  if (!prediction) return null;
  if (!supabaseConfigured()) return "âš½ *Mundialito*\nTodavÃ­a no estÃ¡ lista la base. ProbÃ¡ de nuevo en unos minutos.";

  const profile = await findProfileByPhone(from);
  if (!profile) return "âš½ *Mundialito*\nNo tengo registrado tu WhatsApp como participante.";
  if (!profile.paid) return "âš½ *Mundialito*\nTenÃ©s el pago pendiente. Cuando quede confirmado, se habilita la carga de pronÃ³sticos.";

  const db = supabaseAdmin();
  const { data: matches, error: matchesError } = await db
    .from("matches")
    .select("*")
    .is("home_goals", null)
    .order("kickoff_at", { ascending: true });
  if (matchesError) throw matchesError;

  const match = (matches ?? []).find(
    (item) => teamsAreClose(prediction.homeTeam, item.home_team) && teamsAreClose(prediction.awayTeam, item.away_team)
  );
  if (match && isMatchBlockedUntilOfficial(match)) return "âš½ *Mundialito*\nEse cruce todavÃ­a no estÃ¡ confirmado oficialmente.";
  if (!match) return `âš½ *Mundialito*\nNo encontrÃ© partido abierto para ${prediction.homeTeam} vs ${prediction.awayTeam}.`;
  if (isPredictionLocked(match.kickoff_at, match.locked)) return `âš½ *Mundialito*\nEse partido ya estÃ¡ cerrado: ${displayNameForTeam(match.home_team)} vs ${displayNameForTeam(match.away_team)}.`;

  const savedAt = new Date().toISOString();
  const { error } = await db.from("predictions").upsert(
    {
      user_id: profile.id,
      match_id: match.id,
      home_goals: prediction.homeGoals,
      away_goals: prediction.awayGoals,
      penalty_winner: null,
      user_updated_at: savedAt
    },
    { onConflict: "user_id,match_id" }
  );
  if (error) throw error;

  return [
    "âœ… *PredicciÃ³n guardada*",
    matchLabel(match),
    `Tu apuesta: *${prediction.homeGoals}-${prediction.awayGoals}*`,
    `Jugador: ${profile.display_name}`
  ].join("\n");
}

async function saveBulkPredictionsFromWhatsApp(text: string, from?: string) {
  const payload = extractBulkPayload(text);
  if (!payload) {
    return [
      "âš½ *Carga masiva*",
      "Mandame el bloque en el mismo mensaje, asÃ­:",
      "",
      "*$carga*",
      "ðŸ‡¦ðŸ‡· Argentina 2-1 ðŸ‡²ðŸ‡½ Mexico",
      "ðŸ‡§ðŸ‡· Brazil 3-1 ðŸ‡²ðŸ‡¦ Morocco"
    ].join("\n");
  }

  if (!supabaseConfigured()) return "âš½ *Mundialito*\nTodavÃ­a no estÃ¡ lista la base. ProbÃ¡ de nuevo en unos minutos.";

  const profile = await findProfileByPhone(from);
  if (!profile) return "âš½ *Mundialito*\nNo tengo registrado tu WhatsApp como participante.";
  if (!profile.paid) return "âš½ *Carga masiva*\nTenÃ©s el pago pendiente. Cuando quede confirmado, se habilita la carga.";

  const db = supabaseAdmin();
  const { data: matches, error: matchesError } = await db
    .from("matches")
    .select("*")
    .is("home_goals", null)
    .order("kickoff_at", { ascending: true });
  if (matchesError) throw matchesError;

  let skipped = 0;
  let invalid = 0;
  const rows: Array<{
    user_id: string;
    match_id: string;
    home_goals: number;
    away_goals: number;
    penalty_winner: null;
    user_updated_at: string;
  }> = [];
  const savedAt = new Date().toISOString();

  for (const rawLine of payload.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parsed = parseBulkPredictionLine(line);
    if (!parsed || parsed.homeGoals > 30 || parsed.awayGoals > 30) {
      invalid += 1;
      continue;
    }

    const match = (matches ?? []).find(
      (item) =>
        (teamsAreClose(parsed.homeTeam, item.home_team) || teamsAreClose(parsed.homeTeam, displayNameForTeam(item.home_team))) &&
        (teamsAreClose(parsed.awayTeam, item.away_team) || teamsAreClose(parsed.awayTeam, displayNameForTeam(item.away_team)))
    );

    if (!match || !isPendingPredictionCandidate(match)) {
      skipped += 1;
      continue;
    }

    rows.push({
      user_id: profile.id,
      match_id: match.id,
      home_goals: parsed.homeGoals,
      away_goals: parsed.awayGoals,
      penalty_winner: null,
      user_updated_at: savedAt
    });
  }

  const dedupedRows = [...new Map(rows.map((row) => [row.match_id, row])).values()];
  if (dedupedRows.length) {
    const { error } = await db.from("predictions").upsert(dedupedRows, { onConflict: "user_id,match_id" });
    if (error) throw error;
  }

  return [
    "âœ… *Carga masiva procesada*",
    `Jugador: ${profile.display_name}`,
    `Guardadas: *${dedupedRows.length}*`,
    `Omitidas: *${skipped}*`,
    `LÃ­neas invÃ¡lidas: *${invalid}*`,
    "",
    "PodÃ©s revisar con *$pronosticos*."
  ].join("\n");
}

async function answerUpcoming(text: string) {
  const query = normalizeText(extractTeamQuery(text));
  const matches = (await getMatches()) as MatchLite[];
  const upcoming = matches
    .filter((match) => match.home_goals == null)
    .filter((match) => !query || matchQueryAgainstMatch(query, match))
    .slice(0, 8);

  if (!upcoming.length && query) {
    return `${ICONS.calendar} *Próximos partidos*\nNo encontré pendientes para "${extractTeamQuery(text)}".\nProbá *$partidos* o *$resultados*.`;
  }

  if (!upcoming.length) {
    const recent = matches
      .filter((match) => match.home_goals != null && match.away_goals != null)
      .slice(-5)
      .reverse();
    if (!recent.length) return `${ICONS.calendar} *Próximos partidos*\nTodavía no hay partidos cargados.`;
    return [
      `${ICONS.calendar} *Próximos partidos*`,
      "No quedan pendientes. Últimos resultados:",
      ...recent.map((match) => `${matchLabel(match)}\nMarcador: *${formatScoreWithPenalties(match)}*`)
    ].join("\n");
  }

  return [
    `${ICONS.calendar} *Próximos partidos*`,
    ...upcoming.map((match) => [
      matchLabel(match),
      `${ICONS.clock} ${formatArgentinaDateTime(match.kickoff_at)}`,
      match.group_name ? `Grupo ${match.group_name}` : stageLabel(match.stage)
    ].join("\n"))
  ].join("\n");
}

async function answerResults(text: string) {
  const query = normalizeText(extractTeamQuery(text));
  const matches = (await getMatches()) as MatchLite[];
  const results = matches
    .filter((match) => match.home_goals != null && match.away_goals != null)
    .filter((match) => !query || matchQueryAgainstMatch(query, match));

  if (!results.length) return `${ICONS.checkeredFlag} *Resultados*\nTodavía no hay resultados para esa búsqueda.`;
  const lines: string[] = [];
  let currentDate = "";
  for (const match of results) {
    const date = argentinaMatchDate(match.kickoff_at);
    if (date !== currentDate) {
      if (lines.length) lines.push("");
      lines.push(`*${date}*`);
      currentDate = date;
    }
    lines.push(`${flagEmoji(match.home_team, match.home_country_code)} ${displayNameForTeam(match.home_team)} *${formatScoreWithPenalties(match)}* ${flagEmoji(match.away_team, match.away_country_code)} ${displayNameForTeam(match.away_team)}`);
  }

  return [
    `${ICONS.checkeredFlag} *Resultados*`,
    ...lines
  ].join("\n");
}

async function answerPending(from?: string) {
  const profile = await findProfileByPhone(from);
  if (!profile || !supabaseConfigured()) {
    return [
      "â³ *Pendientes de predicciÃ³n*",
      "No pude identificar tu WhatsApp como participante.",
      "Escribile al admin para revisar que tu nÃºmero estÃ© bien cargado."
    ].join("\n");
  }

  const db = supabaseAdmin();
  const { data: matches, error: matchesError } = await db
    .from("matches")
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name,home_goals,away_goals,locked,status")
    .is("home_goals", null)
    .order("kickoff_at", { ascending: true });
  if (matchesError) throw matchesError;

  const { data: predictions, error: predictionsError } = await db
    .from("predictions")
    .select("match_id")
    .eq("user_id", profile.id);
  if (predictionsError) throw predictionsError;

  const predicted = new Set((predictions ?? []).map((prediction) => prediction.match_id));
  const available = ((matches ?? []) as PendingMatch[]).filter((match) => match.id && isPendingPredictionCandidate(match));
  const pending = available.filter((match) => match.id && !predicted.has(match.id));
  const loaded = available.length - pending.length;
  if (!pending.length) {
    return [
      "â³ *Pendientes de predicciÃ³n*",
      `Cargados: *${loaded} / ${available.length}* pronÃ³sticos disponibles.`,
      "No tenÃ©s partidos pendientes para predecir.",
      "Los partidos cerrados o bloqueados no cuentan."
    ].join("\n");
  }

  return [
    "â³ *Pendientes de predicciÃ³n*",
    `Cargados: *${loaded} / ${available.length}* pronÃ³sticos disponibles.`,
    "PrÃ³ximos pendientes a jugarse:",
    "",
    ...pending.slice(0, 8).map((match) => `${matchLabel(match)}\nðŸ•’ ${formatArgentinaDateTime(match.kickoff_at)}`)
  ].join("\n");
}

async function answerPronosticos(from?: string) {
  const profile = await findProfileByPhone(from);
  if (!profile || !supabaseConfigured()) return "âš½ *PronÃ³sticos*\nNo tengo registrado tu WhatsApp como participante.";

  const db = supabaseAdmin();
  const [{ data, error }, { data: podium, error: podiumError }] = await Promise.all([
    db
      .from("predictions")
      .select("home_goals,away_goals,penalty_winner,matches(home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name)")
      .eq("user_id", profile.id),
    db.from("podium_predictions").select("champion_team,runner_up_team,third_place_team,points").eq("user_id", profile.id).maybeSingle()
  ]);
  if (error) throw error;
  if (podiumError) throw podiumError;

  const rows = (data ?? [])
    .map((prediction) => {
      const match = Array.isArray(prediction.matches) ? prediction.matches[0] : prediction.matches;
      return { prediction, match };
    })
    .filter((item) => item.match)
    .sort((a, b) => new Date(a.match!.kickoff_at).getTime() - new Date(b.match!.kickoff_at).getTime());

  const podiumLines = podium?.champion_team || podium?.runner_up_team || podium?.third_place_team
    ? [
        "",
        "ðŸ† *Podio anticipado*",
        podiumTeamLine("CampeÃ³n +3", podium?.champion_team),
        podiumTeamLine("SubcampeÃ³n +2", podium?.runner_up_team),
        podiumTeamLine("3er puesto +1", podium?.third_place_team),
        `Puntos actuales: *${podium?.points ?? 0} pts*`
      ]
    : [];

  if (!rows.length && !podiumLines.length) return "âš½ *PronÃ³sticos*\nTodavÃ­a no tenÃ©s predicciones cargadas.";

  return [
    `âš½ *PronÃ³sticos de ${profile.display_name}*`,
    "Copialo como historia o pegalo en la carga masiva del simulador:",
    "",
    ...rows.map(({ prediction, match }) => {
      const winner = prediction.penalty_winner ? ` | Ganador: ${prediction.penalty_winner}` : "";
      return `${flagEmoji(match!.home_team, match!.home_country_code)} ${displayNameForTeam(match!.home_team)} ${prediction.home_goals}-${prediction.away_goals} ${flagEmoji(match!.away_team, match!.away_country_code)} ${displayNameForTeam(match!.away_team)}${winner}`;
    }),
    ...podiumLines
  ].join("\n");
}

export async function answerWhatsAppCommand(text: string, from?: string) {
  const clean = stripSelfCommandPrefix(text).trim().toLowerCase();
  const normalized = normalizeText(clean);
  if (normalized.startsWith("carga")) return saveBulkPredictionsFromWhatsApp(text, from);
  if (normalized.startsWith("podio")) return answerPodio(text, from);

  const predictionAnswer = await savePredictionFromWhatsApp(text, from);
  if (predictionAnswer) return predictionAnswer;

  if (normalized.includes("comando") || normalized.includes("ayuda") || normalized === "help") return answerCommands();
  if (normalized.includes("pronostico")) return answerPronosticos(from);
  if (normalized.includes("podio")) return answerPodio(text, from);
  if (normalized.includes("regla")) return answerRules();
  if (normalized.includes("partido") || normalized.includes("proximo") || normalized.includes("fixture") || normalized.includes("calendario")) return answerUpcoming(text);
  if (normalized.includes("resultado") || normalized.includes("como va") || normalized.includes("marcador")) return answerResults(text);

  if (clean.includes("ranking") || clean.includes("tabla")) {
    const ranking = await getRanking();
    if (!ranking.length) return `${ICONS.trophy} *Ranking Mundialito*\nTodavía no hay participantes en el ranking.`;
    const profile = await findProfileByPhone(from);
    const podium: string[] = [];
    const others: string[] = [];
    ranking.forEach((row, index) => {
      const rank = rankingRankForIndex(ranking, index);
      const prefix = rankingPrefix(rank);
      const isHighlighted = profile?.id && row.user_id === profile.id;
      const line = rank <= 3 || isHighlighted
        ? `*${prefix} ${row.display_name} - ${row.total_points} pts*`
        : `${prefix} ${row.display_name} - *${row.total_points} pts*`;
      if (rank <= 3) podium.push(line);
      else others.push(line);
    });
    return [
      `${ICONS.trophy} *Ranking Mundialito*`,
      `${ICONS.calendar} ${argentinaDisplayDate()}`,
      "",
      ...podium,
      ...(others.length ? ["", ...others] : [])
    ].join("\n");
  }

  if (clean.includes("pendiente")) return answerPending(from);
  return answerCommands();
}


