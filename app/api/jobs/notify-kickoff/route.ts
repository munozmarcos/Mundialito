import { formatArgentinaDateTime } from "@/lib/dates";
import { flagEmojiForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

function isAutomatic(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  return authOk || isAutomatic(req);
}

function flagEmoji(team: string, explicit?: string | null) {
  return flagEmojiForTeam(team, explicit);
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
    .lte("kickoff_at", to)
    .is("home_goals", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: users, error: usersError } = await db
    .from("profiles")
    .select("id,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 });

  let sent = 0;
  const failures: string[] = [];
  for (const match of matches ?? []) {
    for (const user of users ?? []) {
      const dedupeKey = `${match.id}:${user.id}:kickoff`;
      const { error: logError } = await db.from("notification_logs").insert({
        user_id: user.id,
        match_id: match.id,
        kind: "whatsapp-kickoff",
        dedupe_key: dedupeKey
      });
      if (logError) continue;

      try {
        await sendWhatsApp(
          user.phone,
          [
            "⚽ *Arranca el partido*",
            "",
            `${flagEmoji(match.home_team, match.home_country_code)} ${match.home_team} vs ${flagEmoji(match.away_team, match.away_country_code)} ${match.away_team}`,
            `🕒 ${formatArgentinaDateTime(match.kickoff_at)}`,
            "",
            "🍿 A mirar y sufrir.",
            "Responde *$comandos* para ver opciones."
          ].join("\n")
        );
        sent += 1;
      } catch (error) {
        failures.push(`${user.display_name}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
  }

  const result = { sent, matches: matches?.length ?? 0, failures };
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


