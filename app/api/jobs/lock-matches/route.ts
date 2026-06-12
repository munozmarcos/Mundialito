import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { formatArgentinaDateTime } from "@/lib/dates";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { getPodiumLockState } from "@/lib/podium";
import { sendWebPushToAll } from "@/lib/web-push";
import { NextResponse } from "next/server";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelOk = req.headers.get("x-vercel-cron") === "1";
  return authOk || vercelOk;
}

function flagEmoji(team: string, explicit?: string | null) {
  return flagEmojiForTeam(team, explicit);
}

async function usersMissingPrediction(db: ReturnType<typeof supabaseAdmin>, matchId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id,auth_email,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (error) throw error;

  const { data: predictions, error: predictionError } = await db
    .from("predictions")
    .select("user_id")
    .eq("match_id", matchId);
  if (predictionError) throw predictionError;

  const done = new Set((predictions ?? []).map((prediction) => prediction.user_id));
  return (data ?? []).filter((profile) => !done.has(profile.id));
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")!) : new Date();
  const lockBefore = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { data: matchesToLock, error: readError } = await db
    .from("matches")
    .select("*")
    .lte("kickoff_at", lockBefore)
    .eq("locked", false)
    .is("home_goals", null);

  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });

  const { data, error } = await db
    .from("matches")
    .update({ locked: true, status: "closed" })
    .lte("kickoff_at", lockBefore)
    .eq("locked", false)
    .is("home_goals", null)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let sent = 0;
  let pushSent = 0;
  let pushFailed = 0;
  const failures: string[] = [];
  for (const match of matchesToLock ?? []) {
    const users = await usersMissingPrediction(db, match.id);
    const matchLabel = `${flagEmoji(match.home_team, match.home_country_code)} ${displayNameForTeam(match.home_team)} vs ${flagEmoji(match.away_team, match.away_country_code)} ${displayNameForTeam(match.away_team)}`;
    const push = await sendWebPushToAll({
      dedupeKey: `match-lock:${match.id}`,
      title: "Pronósticos cerrados",
      body: matchLabel,
      url: "/mi-prode",
      tag: `match-lock:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;
    for (const user of users) {
      if (!user.phone) continue;

      const dedupeKey = `${match.id}:${user.id}:lock-15m`;
      const { error: logError } = await db.from("notification_logs").insert({
        user_id: user.id,
        match_id: match.id,
        kind: "whatsapp-lock-15m",
        dedupe_key: dedupeKey
      });
      if (logError) continue;

      try {
        await sendWhatsApp(
          user.phone,
          [
            "⏰ *Mundialito - pronósticos cerrados*",
            "",
            `*${matchLabel}*`,
            "",
            `⚽ Arranca: *${formatArgentinaDateTime(match.kickoff_at)}*`,
            "🔒 La carga para este partido ya quedó cerrada.",
            "Si no cargaste, queda vacío para este partido."
          ].join("\n")
        );
        sent += 1;
      } catch (err) {
        failures.push(`${user.display_name}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  const podiumState = await getPodiumLockState(db);
  const result = { locked: data?.length ?? 0, notifications: sent, pushNotifications: pushSent, pushFailures: pushFailed, podiumLocked: podiumState.locked, podiumReason: podiumState.reason, failures };
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


