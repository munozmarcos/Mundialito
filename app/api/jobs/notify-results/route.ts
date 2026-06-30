import { displayNameForTeam } from "@/lib/flags";
import { formatScoreWithPenalties } from "@/lib/match-score";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWebPushToAll } from "@/lib/web-push";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  matchId: z.string().uuid()
});

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function notifyMatch(matchId: string) {
  const db = supabaseAdmin();
  const { data: match, error: matchError } = await db.from("matches").select("*").eq("id", matchId).single();
  if (matchError) throw matchError;
  if (match.home_goals == null || match.away_goals == null) {
    return { sent: 0, whatsappNotifications: 0, pushNotifications: 0, pushFailures: 0, skipped: "missing-result" };
  }

  const homeName = displayNameForTeam(match.home_team);
  const awayName = displayNameForTeam(match.away_team);
  const resultLabel = formatScoreWithPenalties(match) ?? `${match.home_goals}-${match.away_goals}`;

  const push = await sendWebPushToAll({
    dedupeKey: `result-final:${match.id}:${resultLabel}`,
    title: "Resultado final",
    body: `${homeName} ${resultLabel} ${awayName}`,
    url: "/ranking",
    tag: `result-final:${match.id}`
  });

  return { sent: 0, whatsappNotifications: 0, pushNotifications: push.sent, pushFailures: push.failed, failures: [] as string[] };
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const result = await notifyMatch(body.matchId);
  return NextResponse.json(result);
}
