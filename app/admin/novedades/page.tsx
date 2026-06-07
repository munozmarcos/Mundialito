"use client";

import { formatArgentinaDateTime } from "@/lib/dates";
import { Newspaper, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type NewsItem = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
};

export default function AdminNewsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadNews() {
    const res = await fetch("/api/admin/news", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "No se pudieron cargar las novedades.");
      return;
    }
    setNews(data.news ?? []);
  }

  useEffect(() => {
    void loadNews();
  }, []);

  async function createNews() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, published: true })
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo crear la novedad.");
      return;
    }
    setTitle("");
    setBody("");
    setNews((current) => [data.news, ...current]);
    setMessage("Novedad publicada.");
  }

  async function deleteNews(id: string) {
    if (!window.confirm("Eliminar esta novedad?")) return;
    const res = await fetch("/api/admin/news", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo eliminar.");
      return;
    }
    setNews((current) => current.filter((item) => item.id !== id));
    setMessage("Novedad eliminada.");
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <span className="badge">Admin</span>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-black">
          <Newspaper className="h-7 w-7 text-grass" />
          Crear novedad
        </h1>
        <p className="mt-2 text-ink/70">Publicá avisos que aparecen en Novedades de la pantalla de inicio y en la nueva sección pública.</p>
      </section>

      <section className="panel grid gap-4 p-6">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Título</span>
          <input className="field text-left" placeholder="🏆 Arranca una nueva fecha" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-bold">Mensaje</span>
          <textarea
            className="field min-h-[420px] resize-y py-4 text-left text-base leading-7 sm:min-h-[560px]"
            rows={20}
            style={{ minHeight: "min(560px, 68vh)" }}
            placeholder={"🇦🇷 Hoy hay partidos importantes.\n⚽ Revisá tus pronósticos pendientes.\n🏆 El ranking se mueve fuerte esta semana."}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button className="btn w-fit" disabled={saving || title.trim().length < 2 || body.trim().length < 2} onClick={createNews} type="button">
          <Save className="h-4 w-4" />
          Publicar
        </button>
        {message && <p className="rounded-lg bg-field p-3 text-sm font-bold text-ink/70">{message}</p>}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-xl font-black">Novedades publicadas</h2>
        </div>
        {!news.length ? (
          <p className="p-5 text-sm font-semibold text-ink/65">Todavía no hay novedades.</p>
        ) : (
          news.map((item) => (
            <div className="grid gap-3 border-b border-line p-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-start" key={item.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black">{item.title}</h3>
                  <time className="text-xs font-black text-ink/45" dateTime={item.created_at}>
                    {formatArgentinaDateTime(item.created_at)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-ink/70">{item.body}</p>
              </div>
              <button className="btn secondary min-h-9 px-3" onClick={() => deleteNews(item.id)} type="button">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
