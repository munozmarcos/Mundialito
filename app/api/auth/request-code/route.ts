import { hashLoginCode, internalEmailForPhone, normalizePhone, publicPhone, randomLoginCode, randomPassword } from "@/lib/app-auth";
import { displayNameExists, normalizeDisplayName, validateDisplayName } from "@/lib/profiles";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendWebPushToUser } from "@/lib/web-push";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  mode: z.enum(["login", "signup", "reset"]).default("login"),
  displayName: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(30).optional()
});

type AuthMode = "login" | "signup" | "reset";

function parseBody(input: unknown) {
  const parsed = Body.safeParse(input);
  if (!parsed.success) throw new Error("Revisá los datos ingresados.");
  const phone = normalizePhone(parsed.data.phone ?? "");
  if (phone.length < 10) throw new Error("Ingresá un WhatsApp válido, con código de país y área.");
  return { ...parsed.data, phone };
}

async function findOrCreateProfile(displayName: string | undefined, phone: string, mode: AuthMode) {
  const db = supabaseAdmin();
  const { data: profiles, error: profileError } = await db.from("profiles").select("id,auth_email,display_name,phone,role,paid").not("phone", "is", null);
  if (profileError) throw profileError;

  const existing = (profiles ?? []).find((profile) => normalizePhone(profile.phone ?? "") === phone);
  if (existing) {
    if (mode === "signup") throw new Error("Ese WhatsApp ya tiene usuario. Entrá por 'Ya tengo usuario'.");
    return { profile: existing, created: false };
  }

  if (mode === "login" || mode === "reset") throw new Error("No encontré ese WhatsApp. Si es tu primera vez, entrá por 'Soy nuevo'.");
  if (!displayName || displayName.length < 2) throw new Error("Cargá un apodo para crear el usuario.");

  const cleanDisplayName = normalizeDisplayName(displayName);
  const displayNameError = validateDisplayName(cleanDisplayName);
  if (displayNameError) throw new Error(displayNameError);
  if (await displayNameExists(db, cleanDisplayName)) throw new Error("Ese apodo ya está usado. Elegí otro.");

  const authEmail = internalEmailForPhone(phone);
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: authEmail,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { display_name: cleanDisplayName, phone: publicPhone(phone) }
  });

  if (createError && !createError.message.toLowerCase().includes("already")) throw createError;

  let userId = created.user?.id;
  if (!userId) {
    const { data: users } = await db.auth.admin.listUsers();
    userId = users.users.find((user) => user.email === authEmail)?.id;
  }
  if (!userId) throw new Error("No se pudo crear el participante.");

  const { data, error } = await db
    .from("profiles")
    .upsert(
      {
        id: userId,
        auth_email: authEmail,
        display_name: cleanDisplayName,
        phone: publicPhone(phone),
        role: "participant"
      },
      { onConflict: "id" }
    )
    .select("id,auth_email,display_name,phone,role,paid")
    .single();
  if (error) throw error;
  return { profile: data, created: true };
}

export async function POST(req: Request) {
  try {
    const body = parseBody(await req.json());
    const { profile, created } = await findOrCreateProfile(body.displayName, body.phone, body.mode);
    const code = randomLoginCode();
    const db = supabaseAdmin();
    const { error } = await db.auth.admin.updateUserById(profile.id, {
      app_metadata: {
        mundialito_login_code: hashLoginCode(code),
        mundialito_login_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    });
    if (error) throw error;

    const message = [
        "🏆 *Mundialito*",
        "",
        `Hola ${profile.display_name}. Tu código para entrar es:`,
        `*${code}*`,
        "",
        "Vence en 10 minutos.",
        ...(created
          ? [
              "",
              "Alta creada ✅",
              "Entrada del Mundialito: *$15.000 ARS*",
              "*$10.000* van al pozo y *$5.000* son para el admin que va a hacer un viaje misionero a Ecuador.",
              "Pagá desde la app con el botón *Pagar* o por este link:",
              "https://mpago.la/2kV7LPV",
              "Si pagás por alias o link directo sin iniciar sesión, avisale a Marcos para marcarlo manualmente."
            ]
          : [])
      ].join("\n");

    await sendWhatsApp(publicPhone(body.phone), message);
    await sendWebPushToUser(profile.id, {
      title: "Codigo Mundialito",
      body: `Tu codigo para entrar es ${code}. Vence en 10 minutos.`,
      url: "/login",
      tag: `login-code:${profile.id}`
    });

    return NextResponse.json({ ok: true, phone: publicPhone(body.phone), created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el código.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
