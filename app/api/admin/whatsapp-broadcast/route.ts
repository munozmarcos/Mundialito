import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  body: z.string().min(1).max(4096),
  recipientIds: z.array(z.string().uuid()).optional()
});

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,phone,role,paid")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"])
    .order("display_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ recipients: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = Body.parse(await req.json());
  const db = supabaseAdmin();
  let query = db
    .from("profiles")
    .select("id,display_name,phone,role,paid")
    .not("phone", "is", null)
    .in("role", ["participant", "admin"])
    .order("display_name");

  if (input.recipientIds?.length) {
    query = query.in("id", input.recipientIds);
  }

  const { data: users, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let sent = 0;
  const failures: string[] = [];
  for (const user of users ?? []) {
    if (!user.phone) continue;
    try {
      await sendWhatsApp(user.phone, input.body);
      sent += 1;
    } catch (error) {
      failures.push(`${user.display_name}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return NextResponse.json({ sent, recipients: users?.length ?? 0, failures });
}
