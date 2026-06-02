import { sendWhatsApp } from "@/lib/whatsapp";
import { countryCodeForTeam } from "@/lib/flags";
import { formatArgentinaDateTime } from "@/lib/dates";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

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

async function usersMissingPrediction(db: ReturnType<typeof supabaseAdmin>, matchId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id,auth_email,display_name,phone,role")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"]);
  if (error) throw error;

  const { data: predictions, error: predictionError } = await db
    .from("predictions")
    .select("user_id")
    .eq("match_id", matchId);
  if (predictionError) throw predictionError;

  const done = new Set((predictions ?? []).map((prediction) => prediction.user_id));
  return (data ?? []).filter((profile) => !done.has(profile.id));
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const now = url.searchParams.get("now") ? new Date(url.searchParams.get("now")!) : new Date();
  const from = new Date(now.getTime() + 3.5 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 4.5 * 60 * 60 * 1000).toISOString();

  const { data: matches, error } = await db
    .from("matches")
    .select("*")
    .gte("kickoff_at", from)
    .lte("kickoff_at", to)
    .eq("locked", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let sent = 0;
  const failures: string[] = [];
  for (const match of matches ?? []) {
    const users = await usersMissingPrediction(db, match.id);
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const matchLabel = `${flagEmoji(match.home_team, match.home_country_code)} ${match.home_team} vs ${flagEmoji(match.away_team, match.away_country_code)} ${match.away_team}`;
    const command = `predigo ${match.home_team} vs ${match.away_team} 1-0`;
    for (const user of users) {
      if (!user.phone) continue;

      const dedupeKey = `${match.id}:${user.id}:4h`;
      const { error: logError } = await db.from("notification_logs").insert({
        user_id: user.id,
        match_id: match.id,
        kind: "whatsapp-reminder-4h",
        dedupe_key: dedupeKey
      });
      if (logError) continue;

      try {
        await sendWhatsApp(
          user.phone,
          [
            "⚽ Mundialito - faltan 4 horas",
            "",
            `👋 ${user.display_name}, te falta cargar:`,
            `*${matchLabel}*`,
            "",
            `🕒 Empieza: ${formatArgentinaDateTime(match.kickoff_at)}`,
            "",
            "Cargar por web:",
            `${appUrl}/mi-prode`,
            "",
            "O responde por WhatsApp con:",
            `*_${command}_*`
          ].join("\n")
        );
        sent += 1;
      } catch (error) {
        failures.push(`${user.display_name}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
  }

  return NextResponse.json({ sent, matches: matches?.length ?? 0, failures });
}

export async function GET(req: Request) {
  return POST(req);
}
