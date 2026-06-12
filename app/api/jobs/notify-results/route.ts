import { displayNameForTeam, flagEmojiForTeam } from "@/lib/flags";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  matchId: z.string().uuid()
});

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

function flagEmoji(team: string, explicit?: string | null) {
  return flagEmojiForTeam(team, explicit);
}

async function notifyMatch(matchId: string) {
  const db = supabaseAdmin();
  const { data: match, error: matchError } = await db.from("matches").select("*").eq("id", matchId).single();
  if (matchError) throw matchError;
  if (match.home_goals == null || match.away_goals == null) return { sent: 0, skipped: "missing-result" };

  const homeName = displayNameForTeam(match.home_team);
  const awayName = displayNameForTeam(match.away_team);
  const homeFlag = flagEmojiForTeam(match.home_team, match.home_country_code);
  const awayFlag = flagEmojiForTeam(match.away_team, match.away_country_code);
  const message = [
    "🏁 *Resultado final Mundialito*",
    "",
    `${homeFlag} *${homeName}*  ${match.home_goals}-${match.away_goals}  *${awayName}* ${awayFlag}`,
    "",
    "🏆 Ranking actualizado.",
    "👉 Responde *$ranking* para ver la tabla completa."
  ].join("\n");

  const { data: users, error: usersError } = await db
    .from("profiles")
    .select("id,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (usersError) throw usersError;

  let sent = 0;
  const failures: string[] = [];
  for (const user of users ?? []) {
    const dedupeKey = `${match.id}:${user.id}:result-final`;
    const { error: logError } = await db.from("notification_logs").insert({
      user_id: user.id,
      match_id: match.id,
      kind: "whatsapp-result-final",
      dedupe_key: dedupeKey
    });
    if (logError) continue;

    try {
      await sendWhatsApp(user.phone, message);
      sent += 1;
    } catch (error) {
      failures.push(`${user.display_name}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return { sent, failures };
}
export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const result = await notifyMatch(body.matchId);
  return NextResponse.json(result);
}



