import { getRanking } from "@/lib/data";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelOk = req.headers.get("x-vercel-cron") === "1";
  return authOk || vercelOk;
}

function argentinaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function inWorldCupWindow(date: string) {
  return date >= "2026-06-11" && date <= "2026-07-19";
}

function kickoffDate(match: { kickoff_at: string }) {
  return argentinaDate(new Date(match.kickoff_at));
}

async function findCompletedMatchDay(db: ReturnType<typeof supabaseAdmin>, now = new Date()) {
  const candidates = [argentinaDate(addDays(now, -1)), argentinaDate(now)];
  const { data, error } = await db
    .from("matches")
    .select("id,kickoff_at,status")
    .gte("kickoff_at", "2026-06-11T00:00:00.000Z")
    .lte("kickoff_at", "2026-07-20T12:00:00.000Z");

  if (error) throw error;

  for (const date of candidates) {
    if (!inWorldCupWindow(date)) continue;
    const matches = (data ?? []).filter((match) => kickoffDate(match) === date);
    if (!matches.length) continue;
    if (matches.every((match) => match.status === "closed")) return date;
  }

  return null;
}

function rankingLine(row: { display_name: string; total_points: number }, index: number) {
  const prefix = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

async function recordAutomaticSkip(reason: string, extra: Record<string, unknown> = {}) {
  const skipped = { skipped: true, reason, ...extra };
  await recordJobRun({
    jobPath: "/api/jobs/send-daily-ranking",
    triggerType: "automatic",
    ok: true,
    statusCode: 200,
    summary: summarizeJob("Enviar ranking por WhatsApp", { ok: true, data: skipped }),
    payload: skipped
  });
  return skipped;
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const manual = url.searchParams.get("manual") === "1";
  const requestedDate = url.searchParams.get("date");
  const today = requestedDate ?? (manual ? argentinaDate() : await findCompletedMatchDay(db));

  if (!today) {
    const skipped = await recordAutomaticSkip("match-day-not-complete");
    return NextResponse.json(skipped);
  }

  if (!manual && !inWorldCupWindow(today)) {
    const skipped = await recordAutomaticSkip("outside-world-cup-window", { date: today });
    return NextResponse.json(skipped);
  }

  const { data: users, error } = await db
    .from("profiles")
    .select("id,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!manual && users?.length) {
    const { count } = await db
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "whatsapp-daily-ranking")
      .like("dedupe_key", `%:daily-ranking:${today}`);
    if ((count ?? 0) >= users.length) {
      const skipped = await recordAutomaticSkip("already-sent", { date: today, users: users.length });
      return NextResponse.json(skipped);
    }
  }

  const ranking = await getRanking();
  const body = [
    "🏆 *Ranking diario Mundialito*",
    `📅 ${today}`,
    "",
    ranking.length ? ranking.map((row, index) => rankingLine(row, index)).join("\n") : "Todavia no hay puntos cargados.",
    "",
    "Responde *$ranking* para ver la tabla completa cuando quieras."
  ].join("\n");

  let sent = 0;
  const failures: string[] = [];
  for (const user of users ?? []) {
    if (!user.phone) continue;

    if (!manual) {
      const dedupeKey = `${user.id}:daily-ranking:${today}`;
      const { error: logError } = await db.from("notification_logs").insert({
        user_id: user.id,
        kind: "whatsapp-daily-ranking",
        dedupe_key: dedupeKey
      });
      if (logError) continue;
    }

    try {
      await sendWhatsApp(user.phone, body);
      sent += 1;
    } catch (err) {
      failures.push(`${user.display_name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  const result = { date: today, manual, sent, failures };
  if (!manual) {
    await recordJobRun({
      jobPath: "/api/jobs/send-daily-ranking",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Enviar ranking por WhatsApp", { ok: true, data: result }),
      payload: result
    });
  }
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
