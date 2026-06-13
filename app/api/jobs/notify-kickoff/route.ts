import { displayNameForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWebPushToAll } from "@/lib/web-push";
import { NextResponse } from "next/server";

function isAutomatic(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  return authOk || isAutomatic(req);
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")!) : new Date();
  const from = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const { data: matches, error } = await db
    .from("matches")
    .select("*")
    .gte("kickoff_at", from)
    .lte("kickoff_at", to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let pushSent = 0;
  let pushFailed = 0;
  for (const match of matches ?? []) {
    const home = displayNameForTeam(match.home_team);
    const away = displayNameForTeam(match.away_team);
    const push = await sendWebPushToAll({
      dedupeKey: `match-kickoff:${match.id}`,
      title: "Partido en vivo",
      body: `${home} vs ${away}`,
      url: "/partidos",
      tag: `match-kickoff:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;
  }

  const result = {
    sent: 0,
    whatsappNotifications: 0,
    pushNotifications: pushSent,
    pushFailures: pushFailed,
    matches: matches?.length ?? 0,
    failures: [] as string[]
  };
  if (isAutomatic(req)) {
    await recordJobRun({
      jobPath: "/api/jobs/notify-kickoff",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Avisar inicio", { ok: true, data: result }),
      payload: result
    });
  }
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
