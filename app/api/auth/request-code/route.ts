import { hashLoginCode, internalEmailForPhone, normalizePhone, publicPhone, randomLoginCode, randomPassword } from "@/lib/app-auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  mode: z.enum(["login", "signup", "reset"]).default("login"),
  displayName: z.string().trim().max(40).optional(),
  phone: z.string().trim().min(8).max(30)
});

async function findOrCreateProfile(displayName: string | undefined, phone: string, mode: "login" | "signup" | "reset") {
  const db = supabaseAdmin();
  const { data: profiles, error: profileError } = await db.from("profiles").select("id,auth_email,display_name,phone,role,paid").not("phone", "is", null);
  if (profileError) throw profileError;

  const existing = (profiles ?? []).find((profile) => normalizePhone(profile.phone ?? "") === phone);
  if (existing) {
    if (mode === "signup") throw new Error("Ese WhatsApp ya tiene usuario. Usa 'Ya tengo usuario'.");
    return { profile: existing, created: false };
  }

  if (mode === "login" || mode === "reset") throw new Error("No encontre ese WhatsApp. Si es tu primera vez, entra por 'Soy nuevo'.");
  if (!displayName || displayName.length < 2) throw new Error("Carga un apodo para crear el usuario.");

  const authEmail = internalEmailForPhone(phone);
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: authEmail,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { display_name: displayName, phone: publicPhone(phone) }
  });

  if (createError && !createError.message.toLowerCase().includes("already")) throw createError;

  let userId = created.user?.id;
  if (!userId) {
    const { data: users } = await db.auth.admin.listUsers();
    userId = users.users.find((user) => user.email === authEmail)?.id;
  }
  if (!userId) throw new Error("No se pudo crear el participante");

  const { data, error } = await db
    .from("profiles")
    .upsert(
      {
        id: userId,
        auth_email: authEmail,
        display_name: displayName,
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
    const body = Body.parse(await req.json());
    const phone = normalizePhone(body.phone);
    if (phone.length < 10) return NextResponse.json({ error: "Revisa el numero de WhatsApp." }, { status: 400 });

    const { profile, created } = await findOrCreateProfile(body.displayName, phone, body.mode);
    const code = randomLoginCode();
    const db = supabaseAdmin();
    const { error } = await db.auth.admin.updateUserById(profile.id, {
      app_metadata: {
        mundialito_login_code: hashLoginCode(code),
        mundialito_login_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    });
    if (error) throw error;

    await sendWhatsApp(
      publicPhone(phone),
      [
        "🏆 *Mundialito*",
        "",
        `Hola ${profile.display_name}. Tu codigo para entrar es:`,
        `*${code}*`,
        "",
        "Vence en 10 minutos.",
        ...(created
          ? [
              "",
              "Alta creada ✅",
              "Entrada del Mundialito: *$15.000 ARS*",
              "*$10.000* van al pozo y *$5.000* son para el admin que va a hacer un viaje misionero a Ecuador.",
              "Alias MercadoPago: *MunozMarcosMP*",
              "Link de pago:",
              "https://mpago.la/2kV7LPV"
            ]
          : [])
      ].join("\n")
    );

    return NextResponse.json({ ok: true, phone: publicPhone(phone), created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el codigo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
