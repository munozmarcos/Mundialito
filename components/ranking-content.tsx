"use client";

import { EmptyState } from "@/components/empty-state";
import type { ParticipantPaymentRow, RankingRow } from "@/lib/data";
import { UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  ranking: RankingRow[];
  participants: ParticipantPaymentRow[];
  paidParticipants: number;
  totalParticipants: number;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function RankingContent({ ranking, participants, paidParticipants, totalParticipants }: Props) {
  const [query, setQuery] = useState("");
  const [paidFilter, setPaidFilter] = useState("ALL");
  const normalizedQuery = normalize(query);
  const filteredRanking = useMemo(
    () => ranking.filter((row) => !normalizedQuery || normalize(row.display_name).includes(normalizedQuery)),
    [normalizedQuery, ranking]
  );
  const filteredParticipants = useMemo(
    () =>
      participants
        .filter((participant) => !normalizedQuery || normalize(participant.display_name).includes(normalizedQuery))
        .filter((participant) => paidFilter === "ALL" || (paidFilter === "PAID" ? participant.paid : !participant.paid)),
    [normalizedQuery, paidFilter, participants]
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <article className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-2xl font-black">Ranking</h2>
          <p className="mt-1 text-sm font-semibold text-ink/60">Puntos, exactos y tendencias acertadas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input className="field" placeholder="Buscar apodo" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="btn secondary" type="button" onClick={() => { setQuery(""); setPaidFilter("ALL"); }}>
              Limpiar
            </button>
          </div>
        </div>
        {!filteredRanking.length ? (
          <div className="p-5">
            <EmptyState title="Ranking vacio" text="No hay participantes para ese filtro." />
          </div>
        ) : (
          filteredRanking.map((row, index) => (
            <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-line p-4 last:border-0" key={row.user_id}>
              <div className="text-2xl font-black text-gold">#{index + 1}</div>
              <div>
                <h3 className="font-black">{row.display_name}</h3>
                <p className="text-sm text-ink/60">{row.exact_hits} exactos - {row.trend_hits} tendencias</p>
              </div>
              <div className="text-right">
                <strong className="block text-2xl font-black">{row.total_points}</strong>
                <span className="text-xs font-black uppercase text-ink/45">pts</span>
              </div>
            </div>
          ))
        )}
      </article>

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
          <select className="field mt-4" value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PAID">Pagos</option>
            <option value="UNPAID">Impagos</option>
          </select>
        </div>
        {!filteredParticipants.length ? (
          <div className="p-5">
            <EmptyState title="Sin participantes" text="No hay participantes para ese filtro." />
          </div>
        ) : (
          filteredParticipants.map((participant) => (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line p-4 last:border-0" key={participant.id}>
              <div>
                <h3 className="font-black">{participant.display_name}</h3>
                <p className="text-xs font-black text-ink/55">{participant.role === "admin" ? "Admin" : "Participante"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${participant.paid ? "bg-mint text-grass" : "bg-slate-100 text-slate-600"}`}>
                {participant.paid ? "Pago" : "Impago"}
              </span>
            </div>
          ))
        )}
      </article>
    </section>
  );
}
