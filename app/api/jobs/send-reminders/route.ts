import { formatArgentinaDateTime } from "@/lib/dates";
import { countryCodeForTeam, displayNameForTeam } from "@/lib/flags";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

type ReminderMatch = {
  id: string;
  home_team: string;
  away_team: string;
  home_country_code: string | null;
  away_country_code: string | null;
  kickoff_at: string;
  stage: string | null;
  group_name: string | null;
  home_goals: number | null;
  locked: boolean | null;
  status: string | null;
};

type Profile = {
  id: string;
  display_name: string;
  phone: string | null;
  role: string;
};

function isAutomatic(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  return authOk || isAutomatic(req);
}

function flagEmoji(team: string, explicit?: string | null) {
  const code = countryCodeForTeam(team, explicit);
  if (!code) return "🏳️";
  if (code === "gb-eng") return "🏴";
  if (code === "gb-sct") return "🏴";
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function matchLabel(match: ReminderMatch) {
  return [
    flagEmoji(match.home_team, match.home_country_code),
    displayNameForTeam(match.home_team),
    "vs",
    flagEmoji(match.away_team, match.away_country_code),
    displayNameForTeam(match.away_team)
  ].join(" ");
}

function stageLabel(match: ReminderMatch) {
  if (match.group_name) return `Grupo ${match.group_name}`;
  return match.stage ?? "Partido";
}

function reminderMessage(user: Profile, matches: ReminderMatch[], appUrl: string, manual: boolean) {
  return [
    manual ? "⚽ *Pendientes Mundialito*" : "⚽ *Mundialito - pendientes 4h*",
    "",
    `👋 ${user.display_name}, te falta cargar ${matches.length === 1 ? "este pronóstico" : "estos pronósticos"}:`,
    "",
    ...matches.flatMap((match) => [
      `*${matchLabel(match)}*`,
      `🕒 ${formatArgentinaDateTime(match.kickoff_at)} · ${stageLabel(match)}`,
      ""
    ]),
    "Cargalos desde la app:",
    appUrl ? `${appUrl}/mi-prode` : "/mi-prode",
    "",
    "También podés responder *$pendientes* para ver lo que te falta cuando quieras."
  ].join("\n").trim();
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const manual = url.searchParams.get("manual") === "1";
  const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")!) : new Date();
  const nowIso = now.toISOString();
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

  let matchQuery = db
    .from("matches")
    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name,home_goals,locked,status")
    .is("home_goals", null)
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true });

  if (!manual) matchQuery = matchQuery.lte("kickoff_at", fourHoursFromNow);

  const { data: matchRows, error: matchError } = await matchQuery;

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 });

  const matches = ((matchRows ?? []) as ReminderMatch[]).filter((match) => !match.locked && match.status !== "locked" && match.status !== "closed");
  const matchIds = matches.map((match) => match.id);

  if (!matchIds.length) {
    const result = { manual, sent: 0, users: 0, matches: 0, reminders: 0, failures: [] as string[] };
    if (isAutomatic(req)) {
      await recordJobRun({
        jobPath: "/api/jobs/send-reminders",
        triggerType: "automatic",
        ok: true,
        statusCode: 200,
        summary: summarizeJob("Recordatorios 4h", { ok: true, data: result }),
        payload: result
      });
    }
    return NextResponse.json(result);
  }

  const [{ data: users, error: usersError }, { data: predictions, error: predictionsError }, { data: logs, error: logsError }] = await Promise.all([
    db
      .from("profiles")
      .select("id,display_name,phone,role")
      .not("phone", "is", null)
      .in("role", ["participant", "admin"]),
    db
      .from("predictions")
      .select("user_id,match_id")
      .in("match_id", matchIds),
    manual
      ? Promise.resolve({ data: [], error: null })
      : db
        .from("notification_logs")
        .select("dedupe_key")
        .eq("kind", "whatsapp-reminder-4h")
        .in("match_id", matchIds)
  ]);

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 });
  if (predictionsError) return NextResponse.json({ error: predictionsError.message }, { status: 400 });
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 400 });

  const predicted = new Set((predictions ?? []).map((prediction) => `${prediction.user_id}:${prediction.match_id}`));
  const sentLogs = new Set((logs ?? []).map((log) => log.dedupe_key));
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  let sent = 0;
  let reminders = 0;
  const failures: string[] = [];

  for (const user of (users ?? []) as Profile[]) {
    if (!user.phone) continue;

    const pending = matches.filter((match) => {
      const key = `${user.id}:${match.id}`;
      const dedupeKey = `${match.id}:${user.id}:4h`;
      return !predicted.has(key) && (manual || !sentLogs.has(dedupeKey));
    }).slice(0, manual ? 8 : undefined);
    if (!pending.length) continue;

    try {
      await sendWhatsApp(user.phone, reminderMessage(user, pending, appUrl, manual));
      sent += 1;
      reminders += pending.length;

      if (!manual) {
        await db.from("notification_logs").insert(
          pending.map((match) => ({
            user_id: user.id,
            match_id: match.id,
            kind: "whatsapp-reminder-4h",
            dedupe_key: `${match.id}:${user.id}:4h`
          }))
        );
      }
    } catch (error) {
      failures.push(`${user.display_name}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  const result = { manual, sent, users: users?.length ?? 0, matches: matches.length, reminders, failures };
  if (isAutomatic(req)) {
    await recordJobRun({
      jobPath: "/api/jobs/send-reminders",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Recordatorios 4h", { ok: true, data: result }),
      payload: result
    });
  }
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
