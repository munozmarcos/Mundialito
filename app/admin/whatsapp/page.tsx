"use client";

import { AdminBackButton } from "@/components/admin-back-button";
import { CheckSquare, MessageCircle, Search, Send, Square, UsersRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Recipient = {
  id: string;
  display_name: string;
  phone: string | null;
  role: "admin" | "participant";
  paid: boolean;
};

type Filter = "group" | "all" | "paid" | "unpaid";

const filters: { value: Filter; label: string }[] = [
  { value: "group", label: "Grupo WhatsApp" },
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pagos" },
  { value: "unpaid", label: "Impagos" }
];

const broadcastTitle = "*Mundialito* \u{1F3C6}\u26BD";
const defaultBroadcastBody = `${broadcastTitle}

Recuerden cargar sus pronósticos y revisar pendientes.

Comandos: $ranking, $pendientes, $partidos, $resultados, $reglas, $comandos`;

function withBroadcastTitle(message: string) {
  const clean = message.trim();
  return clean.startsWith(broadcastTitle) ? clean : `${broadcastTitle}\n\n${clean}`;
}

export default function WhatsAppAdminPage() {
  const [body, setBody] = useState(defaultBroadcastBody);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("group");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const didLoadRecipients = useRef(false);

  useEffect(() => {
    fetch("/api/admin/whatsapp-broadcast", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const next = data.recipients ?? [];
        setRecipients(next);
        setSelectedIds(next.map((item: Recipient) => item.id));
        didLoadRecipients.current = true;
      })
      .catch(() => setStatus("No se pudieron cargar los destinatarios."));
  }, []);

  const paidRecipients = recipients.filter((recipient) => recipient.paid).length;

  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return recipients.filter((recipient) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "paid" && recipient.paid) ||
        (filter === "unpaid" && !recipient.paid);
      const matchesQuery =
        !normalized ||
        recipient.display_name.toLowerCase().includes(normalized) ||
        (recipient.phone ?? "").toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, recipients]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!didLoadRecipients.current) return;
    if (filter === "group") {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredRecipients.map((recipient) => recipient.id));
  }, [filter, filteredRecipients]);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function resetFilters() {
    setQuery("");
    setFilter("group");
  }

  async function sendBroadcast() {
    const sendToGroup = filter === "group";
    if (!sendToGroup && !selectedIds.length) {
      setStatus("Elegí al menos un destinatario.");
      return;
    }
    if (!window.confirm(sendToGroup ? "Enviar este mensaje al grupo Mundialito?" : `Enviar este mensaje a ${selectedIds.length} WhatsApp seleccionados?`)) return;
    setSending(true);
    setStatus(sendToGroup ? "Enviando al grupo..." : "Enviando broadcast...");
    const messageBody = withBroadcastTitle(body);

    const res = await fetch("/api/admin/whatsapp-broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sendToGroup ? { body: messageBody, target: "group" } : { body: messageBody, target: "selected", recipientIds: selectedIds })
    });
    const json = await res.json();
    setSending(false);
    setStatus(
      res.ok
        ? sendToGroup
          ? `Enviado al grupo. Push: ${json.pushNotifications ?? 0}/${json.recipients ?? 0}`
          : `Enviados: ${json.sent}/${json.recipients}${json.failures?.length ? `\nFallos:\n${json.failures.join("\n")}` : ""}`
        : json.error ?? "No se pudo enviar."
    );
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="badge">WhatsApp</span>
            <h1 className="mt-3 flex items-center gap-2 text-3xl font-black">
              <MessageCircle className="h-7 w-7 text-grass" />
              Broadcasts
            </h1>
            <p className="mt-2 text-ink/70">Envío de mensaje general por WhatsApp al grupo o a participantes seleccionados.</p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <div className="grid min-h-[76px] min-w-[118px] content-center justify-items-center rounded-lg bg-field px-3 py-2 text-center">
              <UsersRound className="h-5 w-5 text-grass" />
              <strong className="mt-0.5 block text-xl">{paidRecipients}/{recipients.length}</strong>
              <span className="text-xs font-black uppercase text-ink/55">pagaron</span>
            </div>
            <AdminBackButton />
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="panel grid gap-4 p-6">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Mensaje</span>
            <textarea
              className="field dark-scrollbar h-[220px] max-h-[260px] min-h-[180px] w-full resize-y py-3 text-base leading-6"
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <button className="btn h-11 w-[180px] justify-center" disabled={sending || (filter !== "group" && !selectedIds.length)} type="button" onClick={sendBroadcast}>
            <Send className="h-4 w-4" />
            <span className="tabular-nums">{filter === "group" ? "Enviar grupo" : `Enviar a ${selectedIds.length}`}</span>
          </button>
          {status && <pre className="dark-scrollbar overflow-x-auto rounded-lg bg-field p-3 text-sm">{status}</pre>}
        </div>

        <aside className="panel overflow-hidden">
          <div className="border-b border-line p-4">
            <h2 className="text-xl font-black">Destinatarios</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">{filter === "group" ? "1 mensaje al grupo Mundialito" : `${selectedIds.length} seleccionados de ${recipients.length}`}</p>
          </div>

          <div className="grid gap-3 border-b border-line p-4">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  className={`rounded-full border px-4 py-2 text-xs font-black ${filter === item.value ? "border-grass bg-grass text-slate-950" : "border-line bg-field text-ink/70"}`}
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  type="button"
                >
                  {item.value === "group" && <MessageCircle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
                  {item.label}
                </button>
              ))}
            </div>
            {filter !== "group" && (
              <div className="grid max-w-[360px] grid-cols-[minmax(0,1fr)_44px] gap-3">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                  <input className="field h-11 pl-11 text-left" placeholder="Buscar apodo o nro" value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
                <button className="btn secondary h-11 w-11 justify-self-start px-0" onClick={resetFilters} title="Limpiar filtros" type="button">
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="dark-scrollbar max-h-[520px] overflow-y-auto">
            {filter === "group" ? (
              <div className="p-4">
                <div className="rounded-lg border border-grass/30 bg-grass/10 p-4 text-center">
                  <MessageCircle className="mx-auto h-7 w-7 text-grass" />
                  <h3 className="mt-2 text-lg font-black">Grupo Mundialito</h3>
                  <p className="mt-1 text-sm font-semibold text-ink/65">Se envía un solo WhatsApp al grupo.</p>
                </div>
              </div>
            ) : !filteredRecipients.length ? (
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


