"use client";

import { ListChecks, LockKeyhole, MessageCircle, Newspaper, Play, RefreshCw, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const pages = [
  { href: "/admin/participantes", icon: UsersRound, title: "Participantes", text: "Edición de participantes, WhatsApp, rol y estado de pago." },
  { href: "/admin/resultados", icon: Trophy, title: "Resultados", text: "Cargar resultados reales, abrir/cerrar/bloquear partidos y recalcular ranking." },
  { href: "/admin/whatsapp", icon: MessageCircle, title: "Mensaje Broadcast", text: "Envío de mensaje general por WhatsApp a todos los participantes." },
  { href: "/admin/novedades", icon: Newspaper, title: "Crear novedad", text: "Publicar avisos que aparecen en Novedades de la pantalla de inicio." }
];

const jobs = [
  { path: "/api/jobs/sync-fixtures", icon: RefreshCw, title: "Actualizar partidos", text: "Importa/actualiza el fixture y los cruces oficiales desde el proveedor configurado." },
  { path: "/api/jobs/sync-results", icon: Trophy, title: "Actualizar resultados", text: "Consulta marcadores finales, guarda resultados reales y recalcula puntos." },
  { path: "/api/jobs/send-reminders", icon: ListChecks, title: "Recordatorios 4h", text: "Envía WhatsApp solo a quienes no cargaron pronóstico para partidos que empiezan cerca de 4 horas." },
  { path: "/api/jobs/lock-matches", icon: LockKeyhole, title: "Cerrar 15m", text: "Cierra partidos que estén a 15 minutos o menos y avisa por WhatsApp a quienes quedaron pendientes." },
  { path: "/api/jobs/notify-kickoff", icon: MessageCircle, title: "Avisar inicio", text: "Notifica por WhatsApp los partidos que están por empezar en la ventana actual." },
  { path: "/api/jobs/send-daily-ranking", icon: MessageCircle, title: "Enviar ranking por WhatsApp", text: "Manda el ranking actual a todos los miembros registrados, sin esperar el cron diario." }
];

const commands = [
  { command: "$comandos", text: "Muestra esta ayuda. Ejemplo: $comandos" },
  { command: "$ranking", text: "Devuelve el top del Mundialito. Ejemplo: $ranking" },
  { command: "$reglas", text: "Explica la puntuación. Ejemplo: $reglas" },
  { command: "$partidos", text: "Lista próximos partidos. Ejemplo: $partidos Francia" },
  { command: "$resultados", text: "Muestra resultados reales. Ejemplo: $resultados Argentina" },
  { command: "$pendientes", text: "Muestra pronósticos pendientes del usuario. Ejemplo: $pendientes" },
  { command: "$pronosticos", text: "Devuelve el fixture cargado por el usuario para copiar. Ejemplo: $pronosticos" }
];

function jobSummary(title: string, payload: any) {
  const data = payload?.data ?? payload ?? {};
  if (!payload?.ok && payload?.error) return `${title}: error - ${payload.error}`;
  const parts = [`${title}: ejecutado`];
  if (typeof data.matches === "number") parts.push(`${data.matches} partidos detectados`);
  if (typeof data.locked === "number") parts.push(`${data.locked} partidos cerrados`);
  if (typeof data.sent === "number") parts.push(`${data.sent} mensajes enviados`);
  if (typeof data.notifications === "number") parts.push(`${data.notifications} avisos enviados`);
  if (typeof data.updated === "number") parts.push(`${data.updated} actualizados`);
  if (typeof data.inserted === "number") parts.push(`${data.inserted} creados`);
  if (typeof data.failures?.length === "number" && data.failures.length) parts.push(`${data.failures.length} fallos`);
  return parts.join(" · ");
}

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
    setMessage(jobSummary(title, data));
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
        <h2 className="text-xl font-black">Jobs</h2>
        <p className="mt-1 text-sm font-semibold text-ink/60">
          Ejecutan procesos reales manualmente para probar, forzar sincronización o mandar avisos fuera del cron.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {jobs.map((job) => (
            <div className="panel grid grid-cols-[1fr_auto] gap-4 p-4" key={job.path}>
              <span className="flex gap-4 text-left">
                <job.icon className="mt-1 h-5 w-5 shrink-0 text-grass" />
                <span>
                  <strong className="block text-lg">{job.title}</strong>
                  <span className="text-sm text-ink/70">{job.text}</span>
                </span>
              </span>
              <button className="btn min-h-10 px-3" disabled={running === job.path} onClick={() => runJob(job.path, job.title)} title={`Ejecutar ${job.title}`} type="button">
                <Play className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {message && <p className="mt-4 rounded-lg bg-field p-3 text-sm font-bold text-ink/70">{message}</p>}
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">Comandos de WhatsApp</h2>
        <p className="mt-1 text-sm font-semibold text-ink/60">Todos los participantes pueden escribirlos con $ al inicio.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {commands.map((item) => (
            <div className="rounded-lg border border-line bg-field p-4" key={item.command}>
              <strong className="block text-lg text-grass">{item.command}</strong>
              <span className="text-sm font-semibold text-ink/70">{item.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
