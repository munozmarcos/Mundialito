import { recalculateAllPodiumPoints, validatePodiumTeams } from "@/lib/podium";
import { getUserFromRequest, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const PodiumBody = z.object({
  championTeam: z.string().trim().min(1).max(80).nullable(),
  runnerUpTeam: z.string().trim().min(1).max(80).nullable(),
  thirdPlaceTeam: z.string().trim().min(1).max(80).nullable()
});

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db.from("podium_predictions").select("*").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ podium: data ?? null });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = PodiumBody.parse(await req.json());
  if (!validatePodiumTeams(body.championTeam, body.runnerUpTeam, body.thirdPlaceTeam)) {
    return NextResponse.json({ error: "No podes repetir seleccion en el podio." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("podium_predictions")
    .upsert(
      {
        user_id: user.id,
        champion_team: body.championTeam,
        runner_up_team: body.runnerUpTeam,
        third_place_team: body.thirdPlaceTeam
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await recalculateAllPodiumPoints(db);
  const { data: refreshed } = await db.from("podium_predictions").select("*").eq("user_id", user.id).single();

  return NextResponse.json({ podium: refreshed ?? data });
}
