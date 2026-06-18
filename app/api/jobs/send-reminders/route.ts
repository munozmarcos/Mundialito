import { formatArgentinaDateTime } from "@/lib/dates";

import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";

import { recordJobRun, summarizeJob } from "@/lib/job-runs";

import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { ICONS } from "@/lib/message-icons";

import { isPredictionLocked } from "@/lib/scoring";

import { supabaseAdmin } from "@/lib/supabase";

import { hasWhatsAppGroup, sendWhatsApp, sendWhatsAppGroup } from "@/lib/whatsapp";

import { sendWebPushToUser } from "@/lib/web-push";

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



function argentinaDateKey(date: Date) {

  return new Intl.DateTimeFormat("en-CA", {

    timeZone: "America/Argentina/Buenos_Aires",

    year: "numeric",

    month: "2-digit",

    day: "2-digit"

  }).format(date);

}



function argentinaDayStart(date: Date) {

  return new Date(`${argentinaDateKey(date)}T00:00:00-03:00`);

}

function argentinaJornadaStart(date: Date) {
  const currentDayTwo = new Date(`${argentinaDateKey(date)}T02:00:00-03:00`);
  if (date.getTime() < currentDayTwo.getTime()) {
    return new Date(`${argentinaDateKey(addDays(currentDayTwo, -1))}T02:00:00-03:00`);
  }
  return currentDayTwo;
}



function addDays(date: Date, days: number) {

  const copy = new Date(date);

  copy.setUTCDate(copy.getUTCDate() + days);

  return copy;

}

function tomorrowEarlyEnd(jornadaStart: Date) {
  return new Date(`${argentinaDateKey(addDays(jornadaStart, 1))}T02:00:00-03:00`);
}



function flagEmoji(team: string, explicit?: string | null) {

  return flagEmojiForTeam(team, explicit);

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



function isReminderPredictionCandidate(match: ReminderMatch) {

  if (match.status === "locked" || match.status === "scheduled" || match.status === "closed" || match.status === "final") return false;

  if (isMatchBlockedUntilOfficial({ stage: match.stage ?? "GROUP", status: match.status, home_team: match.home_team, away_team: match.away_team })) return false;

  if (isPredictionLocked(match.kickoff_at, Boolean(match.locked))) return false;

  return true;

}



function reminderMessage(

  user: Profile,

  matches: ReminderMatch[],

  appUrl: string,

  manual: boolean,

  stats: { loaded: number; available: number; pending: number },

  reminderMatches: ReminderMatch[] = []

) {

  const todayBlock = !reminderMatches.length

    ? []

    : [

        "*Próximos partidos*",
        "",

        ...reminderMatches.flatMap((match) => [
          `*${matchLabel(match)}*`,

          `Hora: ${formatArgentinaDateTime(match.kickoff_at)} - ${stageLabel(match)}`,

          ""

        ])

      ];



  return [

    manual ? `${ICONS.ball} *Pendientes Mundialito*` : `${ICONS.ball} *Mundialito - pendientes*`,

    "",

    ...todayBlock,

    `${user.display_name}, estos son tus pronósticos pendientes a cargar:`,

    "",

    `Cargados: *${stats.loaded} / ${stats.available}* pronósticos disponibles.`,

    `Pendientes a cargar: *${stats.pending}*.`,

    "",

    "Pendientes más cercanos:",

    "",

    ...matches.flatMap((match) => [

      `*${matchLabel(match)}*`,

      `Hora: ${formatArgentinaDateTime(match.kickoff_at)} - ${stageLabel(match)}`,

      ""

    ]),

    "Miralos desde la app:",
    appUrl ? `${appUrl}/` : "/",
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

  const todayStart = argentinaJornadaStart(now);

  const reminderWindowEnd = tomorrowEarlyEnd(todayStart);





  let matchQuery = db

    .from("matches")

    .select("id,home_team,away_team,home_country_code,away_country_code,kickoff_at,stage,group_name,home_goals,locked,status")


    .gte("kickoff_at", todayStart.toISOString())

    .order("kickoff_at", { ascending: true });
  matchQuery = matchQuery.lt("kickoff_at", reminderWindowEnd.toISOString());



  const { data: matchRows, error: matchError } = await matchQuery;

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 });



  const rawMatches = (matchRows ?? []) as ReminderMatch[];

  const reminderWindowMatches = rawMatches.filter((match) => {

    const kickoff = new Date(match.kickoff_at).getTime();

    return kickoff >= todayStart.getTime() && kickoff < reminderWindowEnd.getTime();

  });

  const upcomingReminderWindowMatches = reminderWindowMatches.filter((match) => {

    const kickoff = new Date(match.kickoff_at).getTime();

    return kickoff > now.getTime();

  });

  const openReminderWindowMatches = upcomingReminderWindowMatches.filter((match) => match.home_goals == null);



  if (!manual) {

    const firstToday = upcomingReminderWindowMatches[0];

    const msUntilFirstToday = firstToday ? new Date(firstToday.kickoff_at).getTime() - now.getTime() : null;



    if (!firstToday || msUntilFirstToday == null || msUntilFirstToday > 4 * 60 * 60 * 1000 || msUntilFirstToday <= 0) {

      const result = {

        manual,

        sent: 0,

        users: 0,

        matches: 0,

        reminders: 0,

        skipped: true,

        reason: firstToday ? "outside-first-match-4h-window" : "no-upcoming-matches-in-reminder-window",

        failures: [] as string[]

      };

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

  }



  const matches = openReminderWindowMatches.filter(isReminderPredictionCandidate);
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

      .select("user_id,match_id,home_goals,away_goals")

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



  const predicted = new Set(
    (predictions ?? [])
      .filter((prediction) => prediction.home_goals != null && prediction.away_goals != null)
      .map((prediction) => `${prediction.user_id}:${prediction.match_id}`)
  );

  const sentLogs = new Set((logs ?? []).map((log) => log.dedupe_key));

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  let sent = 0;

  let pushSent = 0;

  let pushFailed = 0;

  let reminders = 0;

  const failures: string[] = [];



  const pendingByUser: Array<{ user: Profile; pending: ReminderMatch[]; notifyPending: ReminderMatch[]; stats: { loaded: number; available: number; pending: number } }> = [];

  for (const user of (users ?? []) as Profile[]) {

    const userPending = matches.filter((match) => {

      const key = `${user.id}:${match.id}`;

      return !predicted.has(key);

    });

    const notifyPending = userPending.filter((match) => {

      const dedupeKey = `${match.id}:${user.id}:4h`;

      return manual || !sentLogs.has(dedupeKey);

    });

    if (!userPending.length) continue;

    pendingByUser.push({

      user,

      pending: userPending,

      notifyPending,

      stats: { loaded: matches.length - userPending.length, available: matches.length, pending: userPending.length }

    });

  }

  if (hasWhatsAppGroup()) {

    const groupDedupeKey = `group:reminder-4h:${argentinaDateKey(todayStart)}`;
    const { count: groupLogCount } = manual
      ? { count: 0 }
      : await db
          .from("notification_logs")
          .select("id", { count: "exact", head: true })
          .eq("kind", "whatsapp-reminder-4h-group")
          .eq("dedupe_key", groupDedupeKey);

    if ((groupLogCount ?? 0) === 0) {
      const pendingLines = pendingByUser.map(({ user, stats }) => `- ${user.display_name}: *${stats.pending}* pendientes de la jornada (${stats.loaded}/${stats.available})`);
      const pendingBlock = pendingLines.length ? ["*Pendientes de la jornada por cargar:*", ...pendingLines, ""] : [];
      const groupBody = [
        `${ICONS.ball} *Mundialito - jornada de hoy*`,
        "",
        "*Próximos partidos*",
        "",
        ...upcomingReminderWindowMatches.flatMap((match) => [

          `*${matchLabel(match)}*`,

          `Hora: ${formatArgentinaDateTime(match.kickoff_at)} - ${stageLabel(match)}`,

          ""

        ]),

        ...pendingBlock,
        appUrl ? `${appUrl}/` : "/"
      ].join("\n").trim();

      try {

        await sendWhatsAppGroup(groupBody);

        if (!manual) {
          await db.from("notification_logs").insert({

            kind: "whatsapp-reminder-4h-group",

            dedupe_key: groupDedupeKey

          });
        }

        sent += 1;

      } catch (error) {

        failures.push(`Grupo Mundialito: ${error instanceof Error ? error.message : "unknown"}`);

      }

    }

  }

  for (const { user, notifyPending, stats } of pendingByUser) {

    if (!user.phone) continue;

    const pending = notifyPending.slice(0, manual ? 8 : undefined);

    if (!pending.length) continue;



    try {

      await sendWhatsApp(user.phone, reminderMessage(user, pending, appUrl, manual, stats, upcomingReminderWindowMatches));

      const push = await sendWebPushToUser(user.id, {

        dedupeKey: manual ? undefined : `${user.id}:pending:${pending.map((match) => match.id).join("-")}`,

        title: manual ? "Pendientes Mundialito" : "Pendientes Mundialito",

        body: `Te faltan ${stats.pending} de ${stats.available} partidos de la jornada.`,
        url: "/mi-prode",

        tag: `pending:${user.id}`

      });

      pushSent += push.sent;

      pushFailed += push.failed;

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



  const result = { manual, group: hasWhatsAppGroup(), sent, pushNotifications: pushSent, pushFailures: pushFailed, users: users?.length ?? 0, matches: matches.length, reminders, failures };

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
