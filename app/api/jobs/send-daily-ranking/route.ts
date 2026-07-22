import { getRanking } from "@/lib/data";
import { ICONS } from "@/lib/message-icons";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { rankingRankForIndex, rankingPrefix } from "@/lib/ranking-position";
import { supabaseAdmin } from "@/lib/supabase";
import { hasWhatsAppGroup, sendWhatsApp, sendWhatsAppGroup } from "@/lib/whatsapp";
import { sendWebPushToUser } from "@/lib/web-push";
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

function argentinaDisplayDate(date: string) {
  const [, , month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return day && month ? `${day}/${month}` : date;
}

function argentinaDayRange(date: string) {
  const start = new Date(`${date}T00:00:00-03:00`);
  const end = addDays(start, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function hasWhatsAppQuotaForRanking(db: ReturnType<typeof supabaseAdmin>, needed: number, date: string) {
  const dailyLimit = Number(process.env.WHATSAPP_DAILY_LIMIT ?? 100);
  const reserved = Number(process.env.WHATSAPP_DAILY_RESERVED ?? 20);
  const { start, end } = argentinaDayRange(date);
  const { count } = await db
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .like("kind", "whatsapp-%")
    .gte("created_at", start)
    .lt("created_at", end);
  const used = count ?? 0;
  const available = Math.max(0, dailyLimit - reserved - used);
  return { ok: available >= needed, dailyLimit, reserved, used, available, needed };
}

function inWorldCupWindow(date: string) {
  return date >= "2026-06-11" && date <= "2026-07-19";
}

function kickoffDate(match: { kickoff_at: string }) {
  return argentinaDate(new Date(match.kickoff_at));
}

async function findCompletedMatchDay(db: ReturnType<typeof supabaseAdmin>, now = new Date()) {
  const candidates = [argentinaDate(now), argentinaDate(addDays(now, -1))];
  const { data, error } = await db
    .from("matches")
    .select("id,kickoff_at,status,home_goals,away_goals")
    .gte("kickoff_at", "2026-06-11T00:00:00.000Z")
    .lte("kickoff_at", "2026-07-20T12:00:00.000Z");

  if (error) throw error;

  for (const date of candidates) {
    if (!inWorldCupWindow(date)) continue;
    const matches = (data ?? []).filter((match) => kickoffDate(match) === date);
    if (!matches.length) continue;
    if (matches.every((match) => match.status === "closed" && match.home_goals != null && match.away_goals != null)) return date;
  }

  return null;
}

function rankingLine(
  ranking: { user_id: string; display_name: string; total_points: number; exact_hits: number; trend_hits: number }[],
  row: { user_id: string; display_name: string; total_points: number; exact_hits: number; trend_hits: number },
  index: number,
  highlightedUserId?: string | null
) {
  const rank = rankingRankForIndex(ranking, index);
  const prefix = rankingPrefix(rank);
  if (highlightedUserId && row.user_id === highlightedUserId) return `*${prefix} ${row.display_name} - ${row.total_points} pts*`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

function rankingLineForGroup(
  ranking: { user_id: string; display_name: string; total_points: number; exact_hits: number; trend_hits: number }[],
  row: { user_id: string; display_name: string; total_points: number; exact_hits: number; trend_hits: number },
  index: number
) {
  const rank = rankingRankForIndex(ranking, index);
  const prefix = rankingPrefix(rank);
  if (rank <= 3) return `*${prefix} ${row.display_name} - ${row.total_points} pts*`;
  return `${prefix} ${row.display_name} - *${row.total_points} pts*`;
}

function rankingBody(
  ranking: { user_id: string; display_name: string; total_points: number; exact_hits: number; trend_hits: number }[],
  today: string,
  highlightedUserId?: string | null
) {
  if (!ranking.length) {
    return [`${ICONS.trophy} *Ranking diario Mundialito*`, `${ICONS.calendar} ${argentinaDisplayDate(today)}`, "", "Todavía no hay puntos cargados."].join("\n");
  }

  const podium: string[] = [];
  const others: string[] = [];
  ranking.forEach((row, index) => {
    const rank = rankingRankForIndex(ranking, index);
    const prefix = rankingPrefix(rank);
    const isHighlighted = highlightedUserId && row.user_id === highlightedUserId;
    const line = rank <= 3 || isHighlighted
      ? `*${prefix} ${row.display_name} - ${row.total_points} pts*`
      : `${prefix} ${row.display_name} - *${row.total_points} pts*`;
    if (rank <= 3) podium.push(line);
    else others.push(line);
  });

  return [
    `${ICONS.trophy} *Ranking diario Mundialito*`,
    `${ICONS.calendar} ${argentinaDisplayDate(today)}`,
    "",
    ...podium,
    ...(others.length ? ["", ...others] : [])
  ].join("\n");
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

  if (!manual && users?.length && !hasWhatsAppGroup()) {
    const quota = await hasWhatsAppQuotaForRanking(db, users.length, today);
    if (!quota.ok) {
      const skipped = await recordAutomaticSkip("whatsapp-quota-insufficient", { date: today, quota });
      return NextResponse.json(skipped);
    }

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

  let sent = 0;
  let pushSent = 0;
  let pushFailed = 0;
  const failures: string[] = [];

  const groupBody = rankingBody(ranking, today);

  if (hasWhatsAppGroup()) {
    const groupDedupeKey = `group:daily-ranking:${today}`;
    let shouldSendGroup = true;
    if (!manual) {
      const { count } = await db
        .from("notification_logs")
        .select("id", { count: "exact", head: true })
        .eq("kind", "whatsapp-daily-ranking-group")
        .eq("dedupe_key", groupDedupeKey);
      shouldSendGroup = (count ?? 0) === 0;
    }

    if (shouldSendGroup) {
      try {
        await sendWhatsAppGroup(groupBody);
        if (!manual) {
          const { error: groupLogError } = await db.from("notification_logs").insert({
            kind: "whatsapp-daily-ranking-group",
            dedupe_key: groupDedupeKey
          });
          if (groupLogError) throw groupLogError;
        }
        sent = 1;
      } catch (err) {
        failures.push(`Grupo Mundialito: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    for (const user of users ?? []) {
      const push = await sendWebPushToUser(user.id, {
        dedupeKey: manual ? undefined : `${user.id}:daily-ranking-push:${today}`,
        title: "Ranking Mundialito",
        body: `Ranking del ${today}. Responde $ranking o toca para verlo en la app.`,
        url: "/ranking",
        tag: `daily-ranking:${today}:${user.id}`
      });
      pushSent += push.sent;
      pushFailed += push.failed;
    }

    const result = { date: today, manual, group: true, sent, pushNotifications: pushSent, pushFailures: pushFailed, failures };
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

    
    const body = rankingBody(ranking, today, user.id);

    try {
      await sendWhatsApp(user.phone, body);
      const push = await sendWebPushToUser(user.id, {
        dedupeKey: manual ? undefined : `${user.id}:daily-ranking-push:${today}`,
        title: "Ranking Mundialito",
        body: `Ranking del ${today}. Responde $ranking o toca para verlo en la app.`,
        url: "/ranking",
        tag: `daily-ranking:${today}:${user.id}`
      });
      pushSent += push.sent;
      pushFailed += push.failed;
      sent += 1;
    } catch (err) {
      failures.push(`${user.display_name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  const result = { date: today, manual, sent, pushNotifications: pushSent, pushFailures: pushFailed, failures };
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





