import { recalculateMatch } from "@/lib/recalculate";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  userId: z.string().uuid(),
  matchId: z.string().uuid(),
  homeGoals: z.number().int().min(0).max(30),
  awayGoals: z.number().int().min(0).max(30),
  penaltyWinner: z.string().nullable().optional()
});

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const db = supabaseAdmin();
  const { data: match, error: matchError } = await db.from("matches").select("stage").eq("id", body.matchId).single();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 404 });
  if (match.stage !== "GROUP" && body.homeGoals === body.awayGoals && !body.penaltyWinner) {
    return NextResponse.json({ error: "En eliminatorias empatadas tenés que elegir ganador." }, { status: 400 });
  }
  const { data, error } = await db
    .from("predictions")
    .upsert(
      {
        user_id: body.userId,
        match_id: body.matchId,
        home_goals: body.homeGoals,
        away_goals: body.awayGoals,
        penalty_winner: body.penaltyWinner ?? null
      },
      { onConflict: "user_id,match_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await recalculateMatch(body.matchId);
  return NextResponse.json({ prediction: data });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, matchId } = z.object({ userId: z.string().uuid(), matchId: z.string().uuid() }).parse(await req.json());
  const db = supabaseAdmin();
  const { error } = await db.from("predictions").delete().eq("user_id", userId).eq("match_id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await recalculateMatch(matchId);
  return NextResponse.json({ ok: true });
}
