import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    process.env[key] ??= raw.replace(/^"|"$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase env vars");
}

const db = createClient(url, key, { auth: { persistSession: false } });

const matches = [
  {
    home_team: "Argentina",
    away_team: "Mexico",
    home_country_code: "ar",
    away_country_code: "mx",
    kickoff_at: "2026-06-11T20:00:00-03:00",
    stadium: "Demo Stadium",
    stage: "GROUP",
    group_name: "A"
  },
  {
    home_team: "Canada",
    away_team: "Estados Unidos",
    home_country_code: "ca",
    away_country_code: "us",
    kickoff_at: "2026-06-12T20:00:00-03:00",
    stadium: "Demo Stadium",
    stage: "GROUP",
    group_name: "B"
  }
];

const { data, error } = await db.from("matches").insert(matches).select("id, home_team, away_team");
if (error) throw error;
console.log(JSON.stringify({ inserted: data.length, matches: data }, null, 2));
