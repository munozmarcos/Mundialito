import { getMatches, getRanking } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { countryCodeForTeam, displayNameForTeam } from "@/lib/flags";
import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { getPodiumLockState, recalculateAllPodiumPoints, validatePodiumTeams } from "@/lib/podium";
import { isPredictionLocked } from "@/lib/scoring";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";

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

function normalizePhone(value: string) {
  return value.replace(/@.+$/, "").replace(/\D/g, "");
}

function phonesMatch(left: string, right: string) {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && b && (a === b || a.endsWith(b) || b.endsWith(a)));
}

function teamsAreClose(query: string, team: string) {
  const q = normalizeText(query);
  const t = normalizeText(team);
  return t.includes(q) || q.includes(t) || t.split(/\s+/).some((part) => part.length >= 3 && q.includes(part));
}

function flagEmoji(team: string, explicit?: string | null) {
  const code = countryCodeForTeam(team, explicit);
  if (!code) return "🏳️";
  if (code === "gb-sct") return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f);
  if (code === "gb-eng") return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function matchLabel(match: Pick<MatchLite, "home_team" | "away_team" | "home_country_code" | "away_country_code">) {
  return `${flagEmoji(match.home_team, match.home_country_code)} ${displayNameForTeam(match.home_team)} vs ${flagEmoji(match.away_team, match.away_country_code)} ${displayNameForTeam(match.away_team)}`;
}

function extractTeamQuery(text: string) {
  return stripSelfCommandPrefix(text)
    .replace(/^(partidos?|fixture|calendario|resultados?|pendientes?|pronosticos?|podioanticipado|podio|ranking|tabla|reglas?|comandos?|ayuda)\b/gi, "")
    .replace(/^(de|del|para|ver|quiero|como va|cómo va)\s+/gi, "")
    .trim();
}

function answerRules() {
  return [
    "📋 *Reglas del Mundialito*",
    "✅ Tendencia correcta = *1 punto*",
    "Gana local, gana visitante o empate.",
    "🎯 Resultado exacto = *+2 puntos extra*",
    "Aplica igual en grupos y eliminatorias.",
    "En eliminatorias cuenta el resultado de los *120 minutos*.",
    "",
    "🏆 *Podio anticipado*",
    "Campeón = *3 pts*, Subcampeón = *2 pts*, 3er puesto = *1 pt*.",
    "Se carga en fase de grupos y se cierra cuando se habilitan los 16vos o 15 minutos antes del primer partido de esa fase.",
    "",
    "*Ejemplos*",
    "🇦🇷 Argentina 2-1 🇲🇽 Mexico",
    "Tu apuesta 1-0 = *1 punto*",
    "🇧🇷 Brazil 3-1 🇲🇦 Morocco",
    "Tu apuesta 3-1 = *3 puntos*",
    "🤝 Si el real es 0-0 y pusiste 1-1: *1 punto* por empate."
  ].join("\n");
}

function answerCommands() {
  return [
    "⚽ *Comandos Mundialito*",
    "🏆 *$ranking*",
    "Sin parámetro: _$ranking_",
    "📋 *$reglas*",
    "Sin parámetro: _$reglas_",
    "📅 *$partidos*",
    "Sin parámetro: _$partidos_",
    "Con parámetro: _$partidos Argentina_",
    "🏁 *$resultados*",
    "Sin parámetro: _$resultados_",
    "Con parámetro: _$resultados Brasil_",
    "⏳ *$pendientes*",
    "Sin parámetro: _$pendientes_",
    "⚽ *$pronosticos*",
    "Sin parámetro: _$pronosticos_",
    "🏆 *$podioanticipado*",
    "Sin parámetro: _$podioanticipado_",
    "Con parámetro: _$podioanticipado Argentina | Brasil | Uruguay_",
    "✍️ *$carga*",
    "Con parámetro multilinea: _$carga_ y abajo pegá Argentina 2-1 Mexico",
    "🧭 *$comandos*",
    "Sin parámetro: _$comandos_"
  ].join("\n");
}

function extractPodiumPayload(text: string) {
  return stripSelfCommandPrefix(text).replace(/^podio(?:anticipado)?\b[:\s-]*/i, "").trim();
}

function splitPodiumTeams(payload: string) {
  return payload
    .split(/\s*(?:\||,|>|;|\n)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
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
  if (!supabaseConfigured()) return "⚽ *Mundialito*\nTodavía no está lista la base. Probá de nuevo en unos minutos.";

  const profile = await findProfileByPhone(from);
  if (!profile) return "⚽ *Podio anticipado*\nNo tengo registrado tu WhatsApp como participante.";

  const db = supabaseAdmin();
  const payload = extractPodiumPayload(text);
  const lockState = await getPodiumLockState(db);

  if (!payload) {
    const { data, error } = await db.from("podium_predictions").select("*").eq("user_id", profile.id).maybeSingle();
    if (error) throw error;
    return [
      "🏆 *Podio anticipado*",
      podiumTeamLine("Campeón +3", data?.champion_team, data?.champion_points),
      podiumTeamLine("Subcampeón +2", data?.runner_up_team, data?.runner_up_points),
      podiumTeamLine("3er puesto +1", data?.third_place_team, data?.third_place_points),
      "",
      lockState.locked ? "El podio ya está cerrado." : "Para cargarlo:",
      lockState.locked ? "" : "_$podioanticipado Argentina | Brasil | Uruguay_"
    ].join("\n");
  }

  if (lockState.locked) {
    return `🏆 *Podio anticipado*\n${lockState.reason ?? "El podio ya está cerrado."}`;
  }

  const rawTeams = splitPodiumTeams(payload);
  if (rawTeams.length !== 3) {
    return [
      "🏆 *Podio anticipado*",
      "Mandame 3 selecciones separadas por |",
      "Ejemplo:",
      "_$podioanticipado Argentina | Brasil | Uruguay_"
    ].join("\n");
  }

  const selectableTeams = await getSelectableTeams(db);
  const selected = rawTeams.map((team) => findSelectableTeam(team, selectableTeams));
  if (selected.some((team) => !team)) {
    return [
      "🏆 *Podio anticipado*",
      "No encontré una de esas selecciones en el fixture.",
      "Probá con nombres como Argentina, Brasil, Francia."
    ].join("\n");
  }

  const [champion, runnerUp, thirdPlace] = selected as Array<{ name: string; code?: string | null }>;
  if (!validatePodiumTeams(champion.name, runnerUp.name, thirdPlace.name)) {
    return "🏆 *Podio anticipado*\nNo podés repetir selección en el podio.";
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
    "✅ *Podio guardado*",
    podiumTeamLine("Campeón +3", champion.name),
    podiumTeamLine("Subcampeón +2", runnerUp.name),
    podiumTeamLine("3er puesto +1", thirdPlace.name),
    "",
    "Podés verlo cuando quieras con *$podioanticipado*."
  ].join("\n");
}

function rankingLine(row: { display_name: string; total_points: number }, index: number) {
  const prefix = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

async function findProfileByPhone(from?: string) {
  if (!from || !supabaseConfigured()) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.from("profiles").select("*").not("phone", "is", null);
  if (error) throw error;
  return (data ?? []).find((profile) => phonesMatch(from, profile.phone ?? "")) ?? null;
}

async function savePredictionFromWhatsApp(text: string, from?: string) {
  const prediction = parsePrediction(text);
  if (!prediction) return null;
  if (!supabaseConfigured()) return "⚽ *Mundialito*\nTodavía no está lista la base. Probá de nuevo en unos minutos.";

  const profile = await findProfileByPhone(from);
  if (!profile) return "⚽ *Mundialito*\nNo tengo registrado tu WhatsApp como participante.";

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
  if (match && isMatchBlockedUntilOfficial(match)) return "⚽ *Mundialito*\nEse cruce todavía no está confirmado oficialmente.";
  if (!match) return `⚽ *Mundialito*\nNo encontré partido abierto para ${prediction.homeTeam} vs ${prediction.awayTeam}.`;
  if (isPredictionLocked(match.kickoff_at, match.locked)) return `⚽ *Mundialito*\nEse partido ya está cerrado: ${displayNameForTeam(match.home_team)} vs ${displayNameForTeam(match.away_team)}.`;

  const { error } = await db.from("predictions").upsert(
    {
      user_id: profile.id,
      match_id: match.id,
      home_goals: prediction.homeGoals,
      away_goals: prediction.awayGoals,
      penalty_winner: null
    },
    { onConflict: "user_id,match_id" }
  );
  if (error) throw error;

  return [
    "✅ *Predicción guardada*",
    matchLabel(match),
    `Tu apuesta: *${prediction.homeGoals}-${prediction.awayGoals}*`,
    `Jugador: ${profile.display_name}`
  ].join("\n");
}

async function saveBulkPredictionsFromWhatsApp(text: string, from?: string) {
  const payload = extractBulkPayload(text);
  if (!payload) {
    return [
      "⚽ *Carga masiva*",
      "Mandame el bloque en el mismo mensaje, así:",
      "",
      "*$carga*",
      "🇦🇷 Argentina 2-1 🇲🇽 Mexico",
      "🇧🇷 Brazil 3-1 🇲🇦 Morocco"
    ].join("\n");
  }

  if (!supabaseConfigured()) return "⚽ *Mundialito*\nTodavía no está lista la base. Probá de nuevo en unos minutos.";

  const profile = await findProfileByPhone(from);
  if (!profile) return "⚽ *Mundialito*\nNo tengo registrado tu WhatsApp como participante.";

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
  }> = [];

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
      penalty_winner: null
    });
  }

  const dedupedRows = [...new Map(rows.map((row) => [row.match_id, row])).values()];
  if (dedupedRows.length) {
    const { error } = await db.from("predictions").upsert(dedupedRows, { onConflict: "user_id,match_id" });
    if (error) throw error;
  }

  return [
    "✅ *Carga masiva procesada*",
    `Jugador: ${profile.display_name}`,
    `Guardadas: *${dedupedRows.length}*`,
    `Omitidas: *${skipped}*`,
    `Líneas inválidas: *${invalid}*`,
    "",
    "Podés revisar con *$pronosticos*."
  ].join("\n");
}

async function answerUpcoming(text: string) {
  const query = normalizeText(extractTeamQuery(text));
  const matches = (await getMatches()) as MatchLite[];
  const upcoming = matches
    .filter((match) => match.home_goals == null)
    .filter((match) => !query || teamsAreClose(query, match.home_team) || teamsAreClose(query, match.away_team))
    .slice(0, 8);

  if (!upcoming.length && query) {
    return `📅 *Próximos partidos*\nNo encontré pendientes para "${extractTeamQuery(text)}".\nProbá *$partidos* o *$resultados*.`;
  }

  if (!upcoming.length) {
    const recent = matches
      .filter((match) => match.home_goals != null && match.away_goals != null)
      .slice(-5)
      .reverse();
    if (!recent.length) return "📅 *Próximos partidos*\nTodavía no hay partidos cargados.";
    return [
      "📅 *Próximos partidos*",
      "No quedan pendientes. Últimos resultados:",
      ...recent.map((match) => `${matchLabel(match)}\nMarcador: *${match.home_goals}-${match.away_goals}*`)
    ].join("\n");
  }

  return [
    "📅 *Próximos partidos*",
    ...upcoming.map((match) => [
      matchLabel(match),
      `🕒 ${formatArgentinaDateTime(match.kickoff_at)}`,
      match.group_name ? `Grupo ${match.group_name}` : match.stage
    ].join("\n"))
  ].join("\n");
}

async function answerResults(text: string) {
  const query = normalizeText(extractTeamQuery(text));
  const matches = (await getMatches()) as MatchLite[];
  const results = matches
    .filter((match) => match.home_goals != null && match.away_goals != null)
    .filter((match) => !query || teamsAreClose(query, match.home_team) || teamsAreClose(query, match.away_team))
    .slice(0, 8);

  if (!results.length) return "🏁 *Resultados reales*\nTodavía no hay resultados reales para esa búsqueda.";
  return [
    "🏁 *Resultados reales*",
    ...results.map((match) => `${matchLabel(match)}\nMarcador: *${match.home_goals}-${match.away_goals}*`)
  ].join("\n");
}

async function answerPending(from?: string) {
  const profile = await findProfileByPhone(from);
  if (!profile || !supabaseConfigured()) {
    const matches = (await getMatches()) as MatchLite[];
    const pending = matches.filter((match) => match.home_goals == null && isPendingPredictionCandidate(match)).slice(0, 5);
    if (!pending.length) return "⏳ *Pendientes*\nNo hay nada pendiente.";
    return [
      "⏳ *Pendientes*",
      ...pending.map((match) => `${matchLabel(match)}\n🕒 ${formatArgentinaDateTime(match.kickoff_at)}`)
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
  const pending = ((matches ?? []) as PendingMatch[]).filter((match) => match.id && !predicted.has(match.id) && isPendingPredictionCandidate(match));
  if (!pending.length) return "⏳ *Pendientes*\nNo hay nada pendiente.";

  return [
    "⏳ *Pendientes*",
    ...pending.slice(0, 8).map((match) => `${matchLabel(match)}\n🕒 ${formatArgentinaDateTime(match.kickoff_at)}`)
  ].join("\n");
}

async function answerPronosticos(from?: string) {
  const profile = await findProfileByPhone(from);
  if (!profile || !supabaseConfigured()) return "⚽ *Pronósticos*\nNo tengo registrado tu WhatsApp como participante.";

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
        "🏆 *Podio anticipado*",
        podiumTeamLine("Campeón +3", podium?.champion_team),
        podiumTeamLine("Subcampeón +2", podium?.runner_up_team),
        podiumTeamLine("3er puesto +1", podium?.third_place_team),
        `Puntos actuales: *${podium?.points ?? 0} pts*`
      ]
    : [];

  if (!rows.length && !podiumLines.length) return "⚽ *Pronósticos*\nTodavía no tenés predicciones cargadas.";

  return [
    `⚽ *Pronósticos de ${profile.display_name}*`,
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
    if (!ranking.length) return "🏆 *Ranking Mundialito*\nTodavía no hay participantes en el ranking.";
    return [
      "🏆 *Ranking Mundialito*",
      "",
      ...ranking.map((row, index) => rankingLine(row, index))
    ].join("\n");
  }

  if (clean.includes("pendiente")) return answerPending(from);
  return answerCommands();
}
