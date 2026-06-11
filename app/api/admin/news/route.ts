import { getLatestNotifications } from "@/lib/notifications";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const NewsBody = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(1000),
  published: z.boolean().default(true)
});

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const news = await getLatestNotifications(100, { includeExpiredManual: true });
  return NextResponse.json({ news });
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = NewsBody.parse(await req.json());
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("news_items")
    .insert(body)
    .select("id,title,body,published,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ news: data ? { ...data, id: `admin:${data.id}`, type: "admin" } : data });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...body } = NewsBody.extend({ id: z.string().min(2) }).parse(await req.json());
  const db = supabaseAdmin();
  if (!id.startsWith("admin:")) {
    return NextResponse.json({ error: "Las novedades automaticas solo se pueden borrar." }, { status: 400 });
  }

  const { data, error } = await db
    .from("news_items")
    .update(body)
    .eq("id", id.slice("admin:".length))
    .select("id,title,body,published,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ news: data ? { ...data, id: `admin:${data.id}`, type: "admin" } : data });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = z.object({ id: z.string().min(2) }).parse(await req.json());
  const db = supabaseAdmin();
  const manualId = id.startsWith("admin:") ? id.slice("admin:".length) : null;
  const action = manualId
    ? db.from("news_items").delete().eq("id", manualId)
    : db.from("hidden_automatic_notifications").upsert({ id });
  const { error } = await action;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
