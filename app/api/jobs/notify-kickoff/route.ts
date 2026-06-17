import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { ICONS } from "@/lib/message-icons";
import { supabaseAdmin } from "@/lib/supabase";
import { hasWhatsAppGroup, sendWhatsAppGroup } from "@/lib/whatsapp";
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
  const from = new Date(now.getTime() - 6 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const { data: matches, error } = await db
    .from("matches")
    .select("*")
    .gte("kickoff_at", from)
    .lte("kickoff_at", to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let pushSent = 0;
  let pushFailed = 0;
  let whatsappSent = 0;
  const failures: string[] = [];

  for (const match of matches ?? []) {
    const home = displayNameForTeam(match.home_team);
    const away = displayNameForTeam(match.away_team);
    const label = `${flagEmojiForTeam(match.home_team, match.home_country_code)} ${home} vs ${flagEmojiForTeam(match.away_team, match.away_country_code)} ${away}`;
    const push = await sendWebPushToAll({
      dedupeKey: `match-kickoff:${match.id}`,
      title: "Partido en vivo",
      body: `${home} vs ${away}`,
      url: "/partidos",
      tag: `match-kickoff:${match.id}`
    });
    pushSent += push.sent;
    pushFailed += push.failed;

    if (hasWhatsAppGroup()) {
      const kind = "whatsapp-match-kickoff-group";
      const dedupeKey = `group:match-kickoff:${match.id}`;
      if (!(await alreadyLogged(db, kind, dedupeKey))) {
        try {
          await sendWhatsAppGroup([`${ICONS.redCircle} *Partido en vivo*`, "", `*${label}*`, "", "El ranking se va actualizando con el resultado en vivo."].join("\n"));
          await db.from("notification_logs").insert({ match_id: match.id, kind, dedupe_key: dedupeKey });
          whatsappSent += 1;
        } catch (error) {
          failures.push(`${home} vs ${away}: ${error instanceof Error ? error.message : "unknown"}`);
        }
      }
    }
  }

  const result = {
    sent: 0,
    whatsappNotifications: whatsappSent,
    pushNotifications: pushSent,
    pushFailures: pushFailed,
    matches: matches?.length ?? 0,
    failures
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
