import { recalculateMatch } from "@/lib/recalculate";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const ResultBody = z.object({
  matchId: z.string().uuid(),
  homeGoals: z.number().int().min(0).max(30),
  awayGoals: z.number().int().min(0).max(30),
  penaltyWinner: z.string().nullable().optional()
});

const StateBody = z.object({
  matchId: z.string().uuid(),
  action: z.enum(["lock", "open", "clear"])
});

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = ResultBody.parse(await req.json());
  const db = supabaseAdmin();
  const { data: match, error: matchError } = await db.from("matches").select("stage,home_team,away_team").eq("id", body.matchId).single();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 404 });
  if (match.stage !== "GROUP" && body.homeGoals === body.awayGoals && !body.penaltyWinner) {
    return NextResponse.json({ error: "En eliminatorias empatadas tenés que elegir ganador." }, { status: 400 });
  }
  if (body.penaltyWinner && ![match.home_team, match.away_team, "HOME", "AWAY"].includes(body.penaltyWinner)) {
    return NextResponse.json({ error: "Ganador inválido para este partido." }, { status: 400 });
  }

  const { error } = await db
    .from("matches")
    .update({
      home_goals: body.homeGoals,
      away_goals: body.awayGoals,
      penalty_winner: body.penaltyWinner ?? null,
      status: "final",
      locked: true
    })
    .eq("id", body.matchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await recalculateMatch(body.matchId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = StateBody.parse(await req.json());
  const db = supabaseAdmin();
  const update =
    body.action === "lock"
      ? { locked: true, status: "locked" }
      : body.action === "open"
        ? { locked: false, status: "open" }
        : { locked: false, status: "open", home_goals: null, away_goals: null, penalty_winner: null };

  const { error } = await db.from("matches").update(update).eq("id", body.matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (body.action === "clear") await recalculateMatch(body.matchId);
  return NextResponse.json({ ok: true });
}
