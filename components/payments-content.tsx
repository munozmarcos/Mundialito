"use client";

import { EmptyState } from "@/components/empty-state";
import type { ParticipantPaymentRow } from "@/lib/data";
import { MessageCircle, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  participants: ParticipantPaymentRow[];
  paidParticipants: number;
  totalParticipants: number;
  groupInviteUrl?: string;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function paymentSelectClass(value: string) {
  if (value === "PAID") return "field border-grass/35 bg-grass/10 font-black text-grass";
  if (value === "UNPAID") return "field border-red-400/35 bg-red-500/10 font-black text-red-200";
  return "field";
}

export function PaymentsContent({ participants, paidParticipants, totalParticipants, groupInviteUrl }: Props) {
  const [query, setQuery] = useState("");
  const [paidFilter, setPaidFilter] = useState("ALL");
  const normalizedQuery = normalize(query);
  const filteredParticipants = useMemo(
    () =>
      participants
        .filter((participant) => !normalizedQuery || normalize(participant.display_name).includes(normalizedQuery))
        .filter((participant) => paidFilter === "ALL" || (paidFilter === "PAID" ? participant.paid : !participant.paid)),
    [normalizedQuery, paidFilter, participants]
  );

  return (
    <article className="panel overflow-hidden">
      <div className="border-b border-line p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Participantes</h2>
            <p className="mt-1 text-sm font-semibold text-ink/60">Apodos registrados y estado de pago.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="grid min-h-[76px] min-w-[118px] content-center justify-items-center rounded-lg bg-field px-3 py-2 text-center">
              <UsersRound className="h-5 w-5 text-grass" />
              <strong className="mt-0.5 block text-xl">{paidParticipants}/{totalParticipants}</strong>
              <span className="text-xs font-black uppercase text-ink/55">pagaron</span>
            </div>
            {groupInviteUrl && (
              <a
                className="grid min-h-[76px] min-w-[118px] content-center justify-items-center rounded-lg border border-grass/25 bg-grass/10 px-3 py-2 text-center transition hover:border-grass/50"
                href={groupInviteUrl}
                rel="noreferrer"
                target="_blank"
                title="Entrar al grupo de WhatsApp"
              >
                <img
                  alt="QR grupo WhatsApp"
                  className="h-12 w-12 rounded bg-white p-1"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(groupInviteUrl)}`}
                />
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-black uppercase text-grass">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Grupo WhatsApp
                </span>
              </a>
            )}
          </div>
        </div>
        <div className="mt-4 grid max-w-[720px] gap-3 sm:grid-cols-[minmax(260px,1fr)_150px_auto]">
          <input className="field" placeholder="Buscar apodo" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className={paymentSelectClass(paidFilter)} value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PAID">Pagos</option>
            <option value="UNPAID">Impagos</option>
          </select>
          <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => { setQuery(""); setPaidFilter("ALL"); }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!filteredParticipants.length ? (
        <div className="p-5">
          <EmptyState title="Sin participantes" text="No hay participantes para ese filtro." />
        </div>
      ) : (
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {filteredParticipants.map((participant) => (
          <div className="rounded-lg border border-line bg-field px-2.5 py-2.5 text-center" key={participant.id}>
            <div>
              <h3 className="text-lg font-black leading-tight xl:text-xl">{participant.display_name}</h3>
            </div>
            <span className={`mt-1.5 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${participant.paid ? "bg-mint text-grass" : "bg-red-500/15 text-red-200"}`}>
              {participant.paid ? "Pago" : "Impago"}
            </span>
          </div>
          ))}
        </div>
      )}
    </article>
  );
}
