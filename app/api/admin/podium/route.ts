import { recalculateAllPodiumPoints, validatePodiumTeams } from "@/lib/podium";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  userId: z.string().uuid(),
  championTeam: z.string().trim().min(1).max(80).nullable(),
  runnerUpTeam: z.string().trim().min(1).max(80).nullable(),
  thirdPlaceTeam: z.string().trim().min(1).max(80).nullable()
});

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  if (!validatePodiumTeams(body.championTeam, body.runnerUpTeam, body.thirdPlaceTeam)) {
    return NextResponse.json({ error: "No se puede repetir selección en el podio." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("podium_predictions")
    .upsert(
      {
        user_id: body.userId,
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
  const { data: refreshed } = await db.from("podium_predictions").select("*").eq("user_id", body.userId).single();
  return NextResponse.json({ podium: refreshed ?? data });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = z.object({ userId: z.string().uuid() }).parse(await req.json());
  const db = supabaseAdmin();
  const { error } = await db.from("podium_predictions").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await recalculateAllPodiumPoints(db);
  return NextResponse.json({ ok: true });
}
