import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { getPodiumLockState } from "@/lib/podium";
import { supabaseAdmin } from "@/lib/supabase";
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

  let pushSent = 0;
  let pushFailed = 0;
  for (const match of matchesToLock ?? []) {
    const push = await sendWebPushToAll({
      dedupeKey: `match-lock:${match.id}`,
      title: "Pronosticos cerrados",
      body: matchLabel(match),
      url: "/mi-prode",
      tag: `match-lock:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;
  }

  const podiumState = await getPodiumLockState(db);
  const result = {
    locked: data?.length ?? 0,
    whatsappNotifications: 0,
    pushNotifications: pushSent,
    pushFailures: pushFailed,
    podiumLocked: podiumState.locked,
    podiumReason: podiumState.reason,
    failures: [] as string[]
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
