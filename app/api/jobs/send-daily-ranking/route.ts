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

function inWorldCupWindow(date: string) {
  return date >= "2026-06-11" && date <= "2026-07-19";
}

function rankingLine(row: { display_name: string; total_points: number }, index: number) {
  const prefix = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const manual = url.searchParams.get("manual") === "1";
  const today = url.searchParams.get("date") ?? argentinaDate();
  if (!manual && !inWorldCupWindow(today)) {
    const skipped = { skipped: true, reason: "outside-world-cup-window", date: today };
    await recordJobRun({
      jobPath: "/api/jobs/send-daily-ranking",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Enviar ranking por WhatsApp", { ok: true, data: skipped }),
      payload: skipped
    });
    return NextResponse.json(skipped);
  }

  const db = supabaseAdmin();
  const ranking = await getRanking();
  const body = [
    "🏆 *Ranking diario Mundialito*",
    `📅 ${today}`,
    "",
    ranking.length
      ? ranking.map((row, index) => rankingLine(row, index)).join("\n")
      : "Todavía no hay puntos cargados.",
    "",
    "Responde *$ranking* para ver la tabla completa cuando quieras."
  ].join("\n");

  const { data: users, error } = await db
    .from("profiles")
    .select("id,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
