"use client";

import { EmptyState } from "@/components/empty-state";
import type { ParticipantPaymentRow } from "@/lib/data";
import { UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  participants: ParticipantPaymentRow[];
  paidParticipants: number;
  totalParticipants: number;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function PaymentsContent({ participants, paidParticipants, totalParticipants }: Props) {
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
          <div className="rounded-lg bg-field px-4 py-3 text-right">
            <UsersRound className="ml-auto h-5 w-5 text-grass" />
            <strong className="mt-1 block text-2xl">{paidParticipants}/{totalParticipants}</strong>
            <span className="text-xs font-black uppercase text-ink/55">pagaron</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <input className="field" placeholder="Buscar apodo" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="field" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>
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
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredParticipants.map((participant) => (
          <div className="rounded-lg border border-line bg-field p-4" key={participant.id}>
            <div>
              <h3 className="font-black">{participant.display_name}</h3>
              <p className="text-xs font-black text-ink/55">{participant.role === "admin" ? "Admin" : "Participante"}</p>
            </div>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${participant.paid ? "bg-mint text-grass" : "bg-slate-100 text-slate-600"}`}>
              {participant.paid ? "Pago" : "Impago"}
            </span>
          </div>
          ))}
        </div>
      )}
    </article>
  );
}
