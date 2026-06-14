import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { getPodiumLockState } from "@/lib/podium";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWebPushToAll } from "@/lib/web-push";
import { hasWhatsAppGroup, sendWhatsAppGroup } from "@/lib/whatsapp";
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

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")!) : new Date();
  const notifyFrom = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
  const lockBefore = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

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
  const failures: string[] = [];
  for (const match of matchesToNotify ?? []) {
    const push = await sendWebPushToAll({
      dedupeKey: `match-lock:${match.id}`,
      title: "Pronósticos cerrados",
      body: matchLabel(match),
      url: "/mi-prode",
      tag: `match-lock:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;

    if (hasWhatsAppGroup()) {
      const dedupeKey = `group:match-lock:${match.id}`;
      const { error: logError } = await db.from("notification_logs").insert({
        match_id: match.id,
        kind: "whatsapp-match-lock-group",
        dedupe_key: dedupeKey
      });
      if (!logError) {
        try {
          await sendWhatsAppGroup([
            "🔒 *Pronósticos cerrados*",
            "",
            `*${matchLabel(match)}*`,
            "",
            "Ya no se pueden cargar ni modificar pronósticos para este partido.",
            "Responde *$pendientes* para revisar lo que te falta."
          ].join("\n"));
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
