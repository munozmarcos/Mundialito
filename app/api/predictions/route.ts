import { isMatchBlockedUntilOfficial } from "@/lib/match-availability";
import { isPredictionLocked } from "@/lib/scoring";
import { getUserFromRequest, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const PredictionBody = z.object({
  matchId: z.string().uuid(),
  homeGoals: z.number().int().min(0).max(30),
  awayGoals: z.number().int().min(0).max(30),
  penaltyWinner: z.string().nullable().optional()
});

const predictionSelect = "id,user_id,match_id,home_goals,away_goals,penalty_winner,points,trend_hit,exact_hit,updated_at,user_updated_at";
const legacyPredictionSelect = "id,user_id,match_id,home_goals,away_goals,penalty_winner,points,trend_hit,exact_hit,updated_at";

function isMissingUserUpdatedAt(error: { message?: string; code?: string } | null) {
  return Boolean(error?.message?.includes("user_updated_at") || error?.code === "PGRST204");
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const predictionRes = await db
    .from("predictions")
    .select(predictionSelect)
    .eq("user_id", user.id);
  let data: unknown = predictionRes.data;
  let error = predictionRes.error;

  if (isMissingUserUpdatedAt(error)) {
    const legacy = await db.from("predictions").select(legacyPredictionSelect).eq("user_id", user.id);
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ predictions: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = PredictionBody.parse(await req.json());
  const db = supabaseAdmin();
  const { data: profile, error: profileError } = await db.from("profiles").select("paid").eq("id", user.id).single();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if (!profile?.paid) {
    return NextResponse.json({ error: "Tenés que tener el pago confirmado para cargar pronósticos." }, { status: 402 });
  }

  const { data: match, error: matchError } = await db.from("matches").select("*").eq("id", body.matchId).single();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 404 });

  if (isMatchBlockedUntilOfficial(match)) {
    return NextResponse.json({ error: "Ese cruce todavia no esta confirmado oficialmente" }, { status: 409 });
  }

  if (isPredictionLocked(match.kickoff_at, match.locked)) {
    return NextResponse.json({ error: "El partido ya esta cerrado" }, { status: 409 });
  }

  const savedAt = new Date().toISOString();
  const saveRes = await db
    .from("predictions")
    .upsert(
      {
        user_id: user.id,
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
          user_id: user.id,
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
  return NextResponse.json({ prediction: data });
}
