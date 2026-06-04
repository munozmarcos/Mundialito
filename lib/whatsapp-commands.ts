import { getMatches, getRanking } from "@/lib/data";
import { formatArgentinaDateTime } from "@/lib/dates";
import { countryCodeForTeam, displayNameForTeam } from "@/lib/flags";
import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
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
    clean.includes("regla") ||
    clean.includes("partido") ||
    clean.includes("fixture") ||
    clean.includes("calendario") ||
    clean.includes("resultado") ||
    clean.includes("marcador") ||
    clean.includes("ayuda") ||
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
    .replace(/^(partidos?|fixture|calendario|resultados?|pendientes?|pronosticos?|ranking|tabla|reglas?|comandos?|ayuda)\b/gi, "")
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
    "Ver el top. Ejemplo: _$ranking_",
    "📋 *$reglas*",
    "Ver puntuación. Ejemplo: _$reglas_",
    "📅 *$partidos*",
    "Próximos partidos. Ejemplo: _$partidos_",
    "Filtro: _$partidos Argentina_",
    "🏁 *$resultados*",
    "Resultados reales. Ejemplo: _$resultados_",
    "Filtro: _$resultados Brazil_",
    "⏳ *$pendientes*",
    "Lo que te falta cargar. Ejemplo: _$pendientes_",
    "⚽ *$pronosticos*",
    "Ver tu fixture cargado para copiar. Ejemplo: _$pronosticos_",
    "🧭 *$comandos*",
    "Ver esta ayuda. Ejemplo: _$comandos_"
  ].join("\n");
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
  const { data, error } = await db
    .from("predictions")
    .select("home_goals,away_goals,penalty_winner,matches(home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name)")
    .eq("user_id", profile.id);
  if (error) throw error;

  const rows = (data ?? [])
    .map((prediction) => {
      const match = Array.isArray(prediction.matches) ? prediction.matches[0] : prediction.matches;
      return { prediction, match };
    })
    .filter((item) => item.match)
    .sort((a, b) => new Date(a.match!.kickoff_at).getTime() - new Date(b.match!.kickoff_at).getTime());

  if (!rows.length) return "⚽ *Pronósticos*\nTodavía no tenés predicciones cargadas.";

  return [
    `⚽ *Pronósticos de ${profile.display_name}*`,
    "Copialo como historia o pegalo en la carga masiva del simulador:",
    "",
    ...rows.map(({ prediction, match }) => {
      const winner = prediction.penalty_winner ? ` | Ganador: ${prediction.penalty_winner}` : "";
      return `${flagEmoji(match!.home_team, match!.home_country_code)} ${displayNameForTeam(match!.home_team)} ${prediction.home_goals}-${prediction.away_goals} ${flagEmoji(match!.away_team, match!.away_country_code)} ${displayNameForTeam(match!.away_team)}${winner}`;
    })
  ].join("\n");
}

export async function answerWhatsAppCommand(text: string, from?: string) {
  const clean = stripSelfCommandPrefix(text).trim().toLowerCase();
  const normalized = normalizeText(clean);
  const predictionAnswer = await savePredictionFromWhatsApp(text, from);
  if (predictionAnswer) return predictionAnswer;

  if (normalized.includes("comando") || normalized.includes("ayuda") || normalized === "help") return answerCommands();
  if (normalized.includes("pronostico")) return answerPronosticos(from);
  if (normalized.includes("regla")) return answerRules();
  if (normalized.includes("partido") || normalized.includes("proximo") || normalized.includes("fixture") || normalized.includes("calendario")) return answerUpcoming(text);
  if (normalized.includes("resultado") || normalized.includes("como va") || normalized.includes("marcador")) return answerResults(text);

  if (clean.includes("ranking") || clean.includes("tabla")) {
    const ranking = await getRanking();
    if (!ranking.length) return "🏆 *Ranking Mundialito*\nTodavía no hay participantes en el ranking.";
    return [
      "🏆 *Ranking Mundialito*",
      ...ranking.slice(0, 5).map((row, index) => `${index + 1}. ${row.display_name} - *${row.total_points} pts*`)
    ].join("\n");
  }

  if (clean.includes("pendiente")) return answerPending(from);
  return answerCommands();
}
