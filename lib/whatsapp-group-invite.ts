import { sendWhatsApp } from "@/lib/whatsapp";

export async function sendGroupInviteIfPaid(profile: { display_name: string; phone: string | null; paid: boolean }) {
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
