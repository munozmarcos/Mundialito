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

function isMissingUserUpdatedAt(error: { message?: string; code?: string } | null) {
  return Boolean(error?.message?.includes("user_updated_at") || error?.code === "PGRST204");
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const db = supabaseAdmin();
  const savedAt = new Date().toISOString();
  const saveRes = await db
    .from("predictions")
    .upsert(
      {
        user_id: body.userId,
        match_id: body.matchId,
        home_goals: body.homeGoals,
        away_goals: body.awayGoals,
        penalty_winner: body.penaltyWinner ?? null,
        user_updated_at: savedAt
      },
      { onConflict: "user_id,match_id" }
    )
    .select()
    .single();
  let data: unknown = saveRes.data;
  let error = saveRes.error;

  if (isMissingUserUpdatedAt(error)) {
    const legacy = await db
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
    data = legacy.data;
    error = legacy.error;
  }

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
