import { formatArgentinaDateTime } from "@/lib/dates";
import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { ICONS } from "@/lib/message-icons";
import { getPodiumLockState } from "@/lib/podium";
import { supabaseAdmin } from "@/lib/supabase";
import { hasWhatsAppGroup, sendWhatsAppGroup } from "@/lib/whatsapp";
import { sendWebPushToAll } from "@/lib/web-push";
import { NextResponse } from "next/server";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelOk = req.headers.get("x-vercel-cron") === "1";
  return authOk || vercelOk;
}

function matchLabel(match: { home_team: string; away_team: string; home_country_code?: string | null; away_country_code?: string | null }) {
  return `${flagEmojiForTeam(match.home_team, match.home_country_code)} ${displayNameForTeam(match.home_team)} vs ${flagEmojiForTeam(match.away_team, match.away_country_code)} ${displayNameForTeam(match.away_team)}`;
}

function minutesUntilPredictionClose(kickoffAt: string, now: Date) {
  const closeAt = new Date(new Date(kickoffAt).getTime() - 15 * 60 * 1000);
  return Math.max(0, Math.ceil((closeAt.getTime() - now.getTime()) / 60000));
}

function minutesUntilKickoff(kickoffAt: string, now: Date) {
  return Math.max(0, Math.ceil((new Date(kickoffAt).getTime() - now.getTime()) / 60000));
}

function sameKickoff(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

function isFirstRoundOf32(match: { stage?: string | null; kickoff_at?: string | null }, firstRoundOf32Kickoff?: string | null) {
  return match.stage === "R32" && sameKickoff(match.kickoff_at, firstRoundOf32Kickoff);
}

function podiumClosingNotice(match: { stage?: string | null; kickoff_at?: string | null }, firstRoundOf32Kickoff?: string | null) {
  if (!isFirstRoundOf32(match, firstRoundOf32Kickoff)) return [];
  return [
    "",
    "🏆 El *podio anticipado* también se está por cerrar.",
    "Hay *6 pts* en juego."
  ];
}

async function alreadyLogged(db: ReturnType<typeof supabaseAdmin>, kind: string, dedupeKey: string) {
  const { count } = await db
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("dedupe_key", dedupeKey);
  return (count ?? 0) > 0;
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")!) : new Date();
  const notifyFrom = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
  const lockBefore = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const oneHourWarningFrom = new Date(now.getTime() + 58 * 60 * 1000).toISOString();
  const oneHourWarningTo = new Date(now.getTime() + 62 * 60 * 1000).toISOString();

  const { data: matchesToWarnOneHour, error: warningError } = await db
    .from("matches")
    .select("*")
    .gte("kickoff_at", oneHourWarningFrom)
    .lte("kickoff_at", oneHourWarningTo)
    .eq("locked", false)
    .is("home_goals", null)
    .not("status", "in", "(locked,scheduled,closed)");
  if (warningError) return NextResponse.json({ error: warningError.message }, { status: 400 });

  const { data: firstRoundRows, error: firstRoundError } = await db
    .from("matches")
    .select("kickoff_at")
    .eq("stage", "R32")
    .order("kickoff_at", { ascending: true })
    .limit(1);
  if (firstRoundError) return NextResponse.json({ error: firstRoundError.message }, { status: 400 });
  const firstRoundOf32Kickoff = firstRoundRows?.[0]?.kickoff_at ?? null;

  const { data: matchesToNotify, error: readError } = await db
    .from("matches")
    .select("*")
    .gte("kickoff_at", notifyFrom)
    .lte("kickoff_at", lockBefore)
    .not("status", "in", "(locked,scheduled,closed)");
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });

  const { data, error } = await db
    .from("matches")
    .update({ locked: true, status: "closed" })
    .lte("kickoff_at", lockBefore)
    .eq("locked", false)
    .is("home_goals", null)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let pushSent = 0;
  let pushFailed = 0;
  let whatsappSent = 0;
  let oneHourNotified = 0;
  const failures: string[] = [];

  for (const match of matchesToWarnOneHour ?? []) {
    const label = matchLabel(match);
    const minutesToKickoff = minutesUntilKickoff(match.kickoff_at, now);
    const minutesToClose = minutesUntilPredictionClose(match.kickoff_at, now);
    const isFirstR32 = isFirstRoundOf32(match, firstRoundOf32Kickoff);
    const push = await sendWebPushToAll({
      dedupeKey: `match-close-1h:${match.id}`,
      title: "Cierra pronto",
      body: isFirstR32 ? `${label}. También cierra el podio anticipado: 6 pts en juego.` : label,
      url: "/mi-prode",
      tag: `match-close-1h:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;

    if (hasWhatsAppGroup()) {
      const kind = "whatsapp-match-close-1h-group";
      const dedupeKey = `group:match-close-1h:${match.id}`;
      if (!(await alreadyLogged(db, kind, dedupeKey))) {
        try {
          const body = [
            `${ICONS.hourglass} *Cierra pronto*`,
            "",
            `*${label}*`,
            `Empieza: ${formatArgentinaDateTime(match.kickoff_at)}`,
            "",
            `Faltan ${minutesToKickoff} minutos para el inicio.`,
            "",
            "La carga cierra 15 minutos antes.",
            `Quedan ${minutesToClose} minutos para cargar o modificar pronósticos.`,
            ...podiumClosingNotice(match, firstRoundOf32Kickoff)
          ].join("\n");
          await sendWhatsAppGroup(body);
          await db.from("notification_logs").insert({ match_id: match.id, kind, dedupe_key: dedupeKey });
          whatsappSent += 1;
          oneHourNotified += 1;
        } catch (error) {
          failures.push(`${match.home_team} vs ${match.away_team}: ${error instanceof Error ? error.message : "unknown"}`);
        }
      }
    }
  }

  for (const match of matchesToNotify ?? []) {
    const label = matchLabel(match);
    const minutesLeft = minutesUntilPredictionClose(match.kickoff_at, now);
    const isFirstR32 = isFirstRoundOf32(match, firstRoundOf32Kickoff);
    const push = await sendWebPushToAll({
      dedupeKey: `match-lock:${match.id}`,
      title: "Pronósticos cerrados",
      body: isFirstR32 ? `${label}. También cerró el podio anticipado: 6 pts en juego.` : label,
      url: "/mi-prode",
      tag: `match-lock:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;

    if (hasWhatsAppGroup()) {
      const kind = "whatsapp-match-lock-group";
      const dedupeKey = `group:match-lock:${match.id}`;
      if (!(await alreadyLogged(db, kind, dedupeKey))) {
        try {
          const body = [
            `${ICONS.lock} *Pronósticos cerrados*`,
            "",
            `*${label}*`,
            `Empieza: ${formatArgentinaDateTime(match.kickoff_at)}`,
            "",
            minutesLeft > 0
              ? `Quedan ${minutesLeft} minutos para cargar o modificar pronósticos. El partido cierra 15 minutos antes del inicio.`
              : "Ya no se pueden cargar ni modificar pronósticos para este partido.",
            ...podiumClosingNotice(match, firstRoundOf32Kickoff)
          ].join("\n");
          await sendWhatsAppGroup(body);
          await db.from("notification_logs").insert({ match_id: match.id, kind, dedupe_key: dedupeKey });
          whatsappSent += 1;
        } catch (error) {
          failures.push(`${match.home_team} vs ${match.away_team}: ${error instanceof Error ? error.message : "unknown"}`);
        }
      }
    }
  }

  const podiumState = await getPodiumLockState(db);
  const result = {
    locked: data?.length ?? 0,
    oneHourNotified,
    closeSoonNotified: matchesToNotify?.length ?? 0,
    whatsappNotifications: whatsappSent,
    pushNotifications: pushSent,
    pushFailures: pushFailed,
    podiumLocked: podiumState.locked,
    podiumReason: podiumState.reason,
    failures
  };

  if (req.headers.get("x-vercel-cron") === "1") {
    await recordJobRun({
      jobPath: "/api/jobs/lock-matches",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Cerrar 15m", { ok: true, data: result }),
      payload: result
    });
  }

  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
