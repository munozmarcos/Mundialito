import { internalEmailForPhone, normalizePhone, publicPhone } from "@/lib/app-auth";
import { displayNameExists, normalizeDisplayName, validateDisplayName } from "@/lib/profiles";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  displayName: z.string().min(1),
  authEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["admin", "participant"]).default("participant"),
  paid: z.boolean().default(false)
});

const UpdateBody = Body.extend({
  id: z.string().uuid(),
  authEmail: z.string().email().optional()
});

async function sendGroupInviteIfPaid(profile: { display_name: string; phone: string | null; paid: boolean }) {
  const inviteUrl = (process.env.WHATSAPP_GROUP_INVITE_URL ?? "").trim();
  if (!profile.paid || !profile.phone || !inviteUrl) return null;

  try {
    await sendWhatsApp(profile.phone, [
      "⚽ *Mundialito*",
      "",
      `${profile.display_name}, ya figurás como *Pago*.`,
      "Entrá al grupo oficial para recibir avisos, ranking y novedades:",
      inviteUrl,
      "",
      "También podés usar comandos por privado o en el grupo."
    ].join("\n"));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "No se pudo enviar la invitación al grupo.";
  }
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("profiles")
    .select("id,auth_email,display_name,phone,role,paid,created_at")
    .order("display_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const db = supabaseAdmin();
  const displayName = normalizeDisplayName(body.displayName);
  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) return NextResponse.json({ error: displayNameError }, { status: 400 });
  if (await displayNameExists(db, displayName)) return NextResponse.json({ error: "Ese apodo ya esta usado. Elegi otro." }, { status: 409 });
  const normalizedPhone = normalizePhone(body.phone ?? "");
  const authEmail = body.authEmail || (normalizedPhone ? internalEmailForPhone(normalizedPhone) : "");
  if (!authEmail) return NextResponse.json({ error: "Carga un WhatsApp para crear el participante." }, { status: 400 });
  if (!body.password) return NextResponse.json({ error: "Carga una contrasena inicial para que pueda entrar sin codigo de WhatsApp." }, { status: 400 });

  const { data: authUser, error: authError } = await db.auth.admin.createUser({
    email: authEmail,
    password: body.password,
    email_confirm: true,
    user_metadata: { display_name: displayName, phone: normalizedPhone ? publicPhone(normalizedPhone) : body.phone ?? null }
  });

  if (authError && !authError.message.toLowerCase().includes("already registered")) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  let userId = authUser.user?.id;
  if (!userId) {
    const { data: users, error: listError } = await db.auth.admin.listUsers();
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    userId = users.users.find((user) => user.email === authEmail)?.id;
  }

  if (!userId) return NextResponse.json({ error: "No se pudo resolver el usuario" }, { status: 400 });

  if (body.password) {
    const { error: updateAuthError } = await db.auth.admin.updateUserById(userId, {
      password: body.password,
      user_metadata: { display_name: displayName }
    });
    if (updateAuthError) return NextResponse.json({ error: updateAuthError.message }, { status: 400 });
  }

  const { data, error } = await db
    .from("profiles")
    .upsert({
      id: userId,
      auth_email: authEmail,
      display_name: displayName,
      phone: normalizedPhone ? publicPhone(normalizedPhone) : body.phone ?? null,
      role: body.role,
      paid: body.paid
    })
    .select("id,auth_email,display_name,phone,role,paid")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const groupInviteWarning = await sendGroupInviteIfPaid(data);
  return NextResponse.json({ profile: data, groupInviteWarning });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = UpdateBody.parse(await req.json());
  const db = supabaseAdmin();
  const displayName = normalizeDisplayName(body.displayName);
  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) return NextResponse.json({ error: displayNameError }, { status: 400 });
  if (await displayNameExists(db, displayName, body.id)) return NextResponse.json({ error: "Ese apodo ya esta usado. Elegi otro." }, { status: 409 });
  const normalizedPhone = normalizePhone(body.phone ?? "");
  const { data: previousProfile } = await db.from("profiles").select("paid").eq("id", body.id).maybeSingle();

  const authUpdate: { password?: string; user_metadata: { display_name: string } } = {
    user_metadata: { display_name: displayName }
  };
  if (body.password) authUpdate.password = body.password;

  const { error: authError } = await db.auth.admin.updateUserById(body.id, authUpdate);
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const { data, error } = await db
    .from("profiles")
    .update({
      display_name: displayName,
      phone: normalizedPhone ? publicPhone(normalizedPhone) : body.phone ?? null,
      role: body.role,
      paid: body.paid
    })
    .eq("id", body.id)
    .select("id,auth_email,display_name,phone,role,paid")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const becamePaid = !previousProfile?.paid && data.paid;
  const groupInviteWarning = becamePaid ? await sendGroupInviteIfPaid(data) : null;
  return NextResponse.json({ profile: data, groupInviteWarning });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
  if (id === admin.id) return NextResponse.json({ error: "No podes eliminar tu propio usuario admin." }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
