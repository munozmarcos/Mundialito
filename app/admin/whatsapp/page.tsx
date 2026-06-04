"use client";

import { CheckSquare, MessageCircle, Search, Send, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Recipient = {
  id: string;
  display_name: string;
  phone: string | null;
  role: "admin" | "participant";
  paid: boolean;
};

type Filter = "all" | "paid" | "unpaid" | "admin" | "participant";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pagos" },
  { value: "unpaid", label: "Impagos" },
  { value: "participant", label: "Participantes" },
  { value: "admin", label: "Admin" }
];

export default function WhatsAppAdminPage() {
  const [body, setBody] = useState(
    "🏆 *Mundialito*\n\nRecuerden cargar sus pronósticos y revisar pendientes.\n\nComandos: $ranking, $pendientes, $partidos, $resultados, $reglas, $comandos"
  );
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/whatsapp-broadcast", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const next = data.recipients ?? [];
        setRecipients(next);
        setSelectedIds(next.map((item: Recipient) => item.id));
      })
      .catch(() => setStatus("No se pudieron cargar los destinatarios."));
  }, []);

  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return recipients.filter((recipient) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "paid" && recipient.paid) ||
        (filter === "unpaid" && !recipient.paid) ||
        recipient.role === filter;
      const matchesQuery =
        !normalized ||
        recipient.display_name.toLowerCase().includes(normalized) ||
        (recipient.phone ?? "").toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, recipients]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectFiltered() {
    const ids = new Set(selectedIds);
    filteredRecipients.forEach((recipient) => ids.add(recipient.id));
    setSelectedIds(Array.from(ids));
  }

  function clearFiltered() {
    const filteredIds = new Set(filteredRecipients.map((recipient) => recipient.id));
    setSelectedIds((current) => current.filter((id) => !filteredIds.has(id)));
  }

  async function sendBroadcast() {
    if (!selectedIds.length) {
      setStatus("Elegí al menos un destinatario.");
      return;
    }
    if (!window.confirm(`Enviar este mensaje a ${selectedIds.length} WhatsApp seleccionados?`)) return;
    setSending(true);
    setStatus("Enviando broadcast...");

    const res = await fetch("/api/admin/whatsapp-broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, recipientIds: selectedIds })
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
          Mensaje Broadcast
        </h1>
        <p className="mt-2 text-ink/70">Envío de mensaje general por WhatsApp a los participantes seleccionados.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="panel grid gap-4 p-6">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Mensaje</span>
            <textarea
              className="field h-[360px] min-h-[360px] w-full resize-y py-4 leading-6 sm:h-[520px] sm:min-h-[520px]"
              rows={18}
              style={{ minHeight: "min(520px, 62vh)" }}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <button className="btn w-fit" disabled={sending || !selectedIds.length} type="button" onClick={sendBroadcast}>
            <Send className="h-4 w-4" />
            Enviar a {selectedIds.length}
          </button>
          {status && <pre className="overflow-x-auto rounded-lg bg-field p-3 text-sm">{status}</pre>}
        </div>

        <aside className="panel overflow-hidden">
          <div className="border-b border-line p-4">
            <h2 className="text-xl font-black">Destinatarios</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">{selectedIds.length} seleccionados de {recipients.length}</p>
          </div>

          <div className="grid gap-3 border-b border-line p-4">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-black ${filter === item.value ? "border-grass bg-grass text-slate-950" : "border-line bg-field text-ink/70"}`}
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input className="field h-11 pl-9 text-left" placeholder="Buscar apodo o número" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="flex gap-2">
              <button className="btn secondary min-h-9 px-3 text-xs" onClick={selectFiltered} type="button">Seleccionar filtro</button>
              <button className="btn secondary min-h-9 px-3 text-xs" onClick={clearFiltered} type="button">Limpiar filtro</button>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {!filteredRecipients.length ? (
              <p className="p-4 text-sm font-semibold text-ink/65">No hay destinatarios con ese filtro.</p>
            ) : (
              filteredRecipients.map((recipient) => {
                const checked = selectedSet.has(recipient.id);
                return (
                  <button
                    className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line p-4 text-left last:border-0 hover:bg-field/70"
                    key={recipient.id}
                    onClick={() => toggle(recipient.id)}
                    type="button"
                  >
                    {checked ? <CheckSquare className="h-5 w-5 text-grass" /> : <Square className="h-5 w-5 text-ink/40" />}
                    <span className="min-w-0">
                      <strong className="block truncate">{recipient.display_name}</strong>
                      <span className="block truncate text-xs font-semibold text-ink/55">{recipient.phone}</span>
                    </span>
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${recipient.paid ? "bg-grass/20 text-grass" : "bg-red-500/15 text-red-200"}`}>
                      {recipient.paid ? "Pago" : "Impago"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
