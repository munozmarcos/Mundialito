import { createSessionToken, hashLoginCode, normalizePhone, SESSION_COOKIE } from "@/lib/app-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  phone: z.string().trim().max(30).optional(),
  code: z.string().trim().optional(),
  password: z.string().optional()
});

function sameHash(a?: string, b?: string) {
  return Boolean(a && b && a === b);
}

function parseBody(input: unknown) {
  const parsed = Body.safeParse(input);
  if (!parsed.success) throw new Error("Revisá los datos ingresados.");
  const phone = normalizePhone(parsed.data.phone ?? "");
  const code = parsed.data.code ?? "";
  const password = parsed.data.password ?? "";
  if (phone.length < 10) throw new Error("Ingresá un WhatsApp válido.");
  if (!/^\d{6}$/.test(code)) throw new Error("Ingresá el código de 6 números que te llegó por WhatsApp.");
  if (!password) throw new Error("Ingresá una contraseña.");
  return { phone, code, password };
}

function passwordErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("password") || message.includes("weak")) return "La contraseña no fue aceptada. Probá con una un poco más larga.";
  return "No se pudo guardar la contraseña.";
}

export async function POST(req: Request) {
  try {
    const body = parseBody(await req.json());
    const db = supabaseAdmin();

    const { data: profiles, error: profileError } = await db.from("profiles").select("id,phone").not("phone", "is", null);
    if (profileError) throw profileError;

    const profile = (profiles ?? []).find((item) => normalizePhone(item.phone ?? "") === body.phone);
    if (!profile) return NextResponse.json({ error: "No encontré ese WhatsApp." }, { status: 404 });

    const { data: userData, error: userError } = await db.auth.admin.getUserById(profile.id);
    if (userError) throw userError;

    const metadata = userData.user?.app_metadata ?? {};
    const expiresAt = metadata.mundialito_login_expires_at ? new Date(metadata.mundialito_login_expires_at).getTime() : 0;
    const isValid = sameHash(metadata.mundialito_login_code, hashLoginCode(body.code)) && expiresAt > Date.now();
    if (!isValid) return NextResponse.json({ error: "Código incorrecto o vencido." }, { status: 401 });

    const { error: updateError } = await db.auth.admin.updateUserById(profile.id, {
      password: body.password,
      app_metadata: {
        mundialito_login_code: null,
        mundialito_login_expires_at: null
      }
    });
    if (updateError) return NextResponse.json({ error: passwordErrorMessage(updateError) }, { status: 400 });

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
    const message = error instanceof Error ? error.message : "No se pudo verificar el código.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
