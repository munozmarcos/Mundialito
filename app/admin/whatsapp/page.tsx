"use client";

import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";

export default function WhatsAppAdminPage() {
  const [body, setBody] = useState(
    "🏆 *Mundialito*\n\nRecuerden cargar sus predicciones y revisar pendientes.\n\nComandos: $ranking, $pendientes, $partidos, $resultados, $reglas, $comandos"
  );
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function sendBroadcast() {
    if (!window.confirm("Enviar este mensaje a todos los WhatsApp registrados?")) return;
    setSending(true);
    setStatus("Enviando broadcast...");

    const res = await fetch("/api/admin/whatsapp-broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body })
    });
    const json = await res.json();
    setSending(false);
    setStatus(res.ok ? `Enviados: ${json.sent}/${json.recipients}${json.failures?.length ? `\nFallos: ${json.failures.join("\n")}` : ""}` : json.error ?? "No se pudo enviar.");
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <span className="badge">WhatsApp</span>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-black">
          <MessageCircle className="h-7 w-7 text-grass" />
          Broadcast
        </h1>
        <p className="mt-2 text-ink/70">
          Envia un mensaje a todos los participantes con WhatsApp registrado.
        </p>
      </section>

      <section className="panel grid gap-4 p-6">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Mensaje para todos</span>
          <textarea
            className="field h-[360px] min-h-[360px] w-full resize-y py-4 leading-6 sm:h-[520px] sm:min-h-[520px]"
            rows={18}
            style={{ minHeight: "min(520px, 62vh)" }}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button className="btn w-fit" disabled={sending} type="button" onClick={sendBroadcast}>
          <Send className="h-4 w-4" />
          Enviar broadcast
        </button>
        {status && <pre className="overflow-x-auto rounded-lg bg-field p-3 text-sm">{status}</pre>}
      </section>
    </div>
  );
}
