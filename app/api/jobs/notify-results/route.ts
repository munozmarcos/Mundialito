import { countryCodeForTeam } from "@/lib/flags";
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
  const code = countryCodeForTeam(team, explicit);
  if (!code) return "🏳️";
  if (code === "gb-eng" || code === "gb-sct") return "🏴";
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

async function notifyMatch(matchId: string) {
  const db = supabaseAdmin();
  const { data: match, error: matchError } = await db.from("matches").select("*").eq("id", matchId).single();
  if (matchError) throw matchError;
  if (match.home_goals == null || match.away_goals == null) return { sent: 0, skipped: "missing-result" };

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
      await sendWhatsApp(
        user.phone,
        [
          "🏁 *Resultado final*",
          "",
          `${flagEmoji(match.home_team, match.home_country_code)} ${match.home_team} *${match.home_goals}-${match.away_goals}* ${flagEmoji(match.away_team, match.away_country_code)} ${match.away_team}`,
          "",
          "🏆 El ranking ya fue actualizado.",
          "Responde *ranking* para ver la tabla.",
          "Responde *$ranking* para ver la tabla."
        ].join("\n")
      );
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
