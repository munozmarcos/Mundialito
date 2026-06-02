import { createSessionToken, hashLoginCode, normalizePhone, SESSION_COOKIE } from "@/lib/app-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  phone: z.string().trim().min(8).max(30),
  code: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(6)
});

function sameHash(a?: string, b?: string) {
  return Boolean(a && b && a === b);
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const phone = normalizePhone(body.phone);
    const db = supabaseAdmin();

    const { data: profiles, error: profileError } = await db.from("profiles").select("id,phone").not("phone", "is", null);
    if (profileError) throw profileError;

    const profile = (profiles ?? []).find((item) => normalizePhone(item.phone ?? "") === phone);
    if (!profile) return NextResponse.json({ error: "No encontre ese WhatsApp." }, { status: 404 });

    const { data: userData, error: userError } = await db.auth.admin.getUserById(profile.id);
    if (userError) throw userError;

    const metadata = userData.user?.app_metadata ?? {};
    const expiresAt = metadata.mundialito_login_expires_at ? new Date(metadata.mundialito_login_expires_at).getTime() : 0;
    const isValid = sameHash(metadata.mundialito_login_code, hashLoginCode(body.code)) && expiresAt > Date.now();
    if (!isValid) return NextResponse.json({ error: "Codigo incorrecto o vencido." }, { status: 401 });

    await db.auth.admin.updateUserById(profile.id, {
      password: body.password,
      app_metadata: {
        mundialito_login_code: null,
        mundialito_login_expires_at: null
      }
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(profile.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo verificar el codigo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
