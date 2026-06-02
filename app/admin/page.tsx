"use client";

import { FileUp, ListChecks, LockKeyhole, MessageCircle, RefreshCw, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const pages = [
  { href: "/admin/participantes", icon: UsersRound, title: "Participantes", text: "Cargar jugadores, WhatsApp y clave web." },
  { href: "/admin/resultados", icon: Trophy, title: "Resultados", text: "Cargar resultados reales y recalcular ranking." },
  { href: "/admin/whatsapp", icon: MessageCircle, title: "WhatsApp", text: "Probar envio de mensajes y comandos." },
  { href: "/admin/importar", icon: FileUp, title: "Cargar partidos", text: "Herramienta de respaldo para actualizar el calendario." }
];

const jobs = [
  { path: "/api/jobs/sync-fixtures", icon: RefreshCw, title: "Ejecutar ahora: actualizar partidos", text: "Corre en este momento la búsqueda del calendario y cruces." },
  { path: "/api/jobs/sync-results", icon: Trophy, title: "Ejecutar ahora: actualizar resultados", text: "Busca resultados finales ahora y recalcula puntos." },
  { path: "/api/jobs/send-reminders", icon: ListChecks, title: "Ejecutar ahora: recordatorios 4h", text: "Envia WhatsApp ahora a quienes falten si hay partidos dentro de la ventana." },
  { path: "/api/jobs/lock-matches", icon: LockKeyhole, title: "Ejecutar ahora: bloquear 15m", text: "Bloquea ahora partidos que esten a 15 minutos o menos." },
  { path: "/api/jobs/notify-kickoff", icon: MessageCircle, title: "Ejecutar ahora: avisar inicio", text: "Envia WhatsApp ahora si hay partidos empezando en la ventana actual." }
];

export default function AdminPage() {
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  async function runJob(path: string, title: string) {
    setRunning(path);
    setMessage("");

    const res = await fetch("/api/admin/run-job", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    setRunning(null);
    setMessage(`${title}: ${JSON.stringify(data)}`);
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <h1 className="text-3xl font-black">Admin</h1>
        <p className="mt-2 text-ink/70">Todo lo necesario para manejar el Mundialito desde un solo lugar.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {pages.map((action) => (
          <Link className="panel flex gap-4 p-5" href={action.href} key={action.href}>
            <action.icon className="mt-1 h-5 w-5 shrink-0 text-grass" />
            <span>
              <strong className="block text-lg">{action.title}</strong>
              <span className="text-sm text-ink/70">{action.text}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">Ejecutar ahora</h2>
        <p className="mt-1 text-sm font-semibold text-ink/60">
          Estos botones corren acciones reales manualmente. Sirven para probar o forzar lo que despues puede quedar automatizado.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <button className="panel flex gap-4 p-4 text-left" disabled={running === job.path} key={job.path} onClick={() => runJob(job.path, job.title)} type="button">
              <job.icon className="mt-1 h-5 w-5 shrink-0 text-grass" />
              <span>
                <strong className="block text-lg">{job.title}</strong>
                <span className="text-sm text-ink/70">{job.text}</span>
              </span>
            </button>
          ))}
        </div>
        {message && <pre className="mt-4 overflow-x-auto rounded-lg bg-field p-3 text-xs">{message}</pre>}
      </section>
    </div>
  );
}
