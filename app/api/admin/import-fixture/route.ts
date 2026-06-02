import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const MatchRow = z.object({
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  home_country_code: z.string().nullable().optional(),
  away_country_code: z.string().nullable().optional(),
  kickoff_at: z.string().datetime({ offset: true }),
  stadium: z.string().nullable().optional(),
  stage: z.enum(["GROUP", "R32", "R16", "QF", "SF", "THIRD_PLACE", "FINAL"]),
  group_name: z.string().nullable().optional()
});

const Body = z.object({
  matches: z.array(MatchRow).min(1).max(104)
});

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { matches } = Body.parse(await req.json());
  const db = supabaseAdmin();
  const { data, error } = await db.from("matches").insert(matches).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
