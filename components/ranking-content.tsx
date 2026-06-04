"use client";

import { EmptyState } from "@/components/empty-state";
import type { RankingRow } from "@/lib/data";
import { X } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  ranking: RankingRow[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function RankingContent({ ranking }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);
  const filteredRanking = useMemo(
    () => ranking.filter((row) => !normalizedQuery || normalize(row.display_name).includes(normalizedQuery)),
    [normalizedQuery, ranking]
  );

  return (
    <section className="grid gap-4">
      <article className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-2xl font-black">Ranking</h2>
          <p className="mt-1 text-sm font-semibold text-ink/60">Puntos, exactos y tendencias acertadas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input className="field" placeholder="Buscar apodo" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="btn secondary h-11 w-11 justify-self-center px-0" type="button" title="Limpiar filtros" onClick={() => setQuery("")}>
              <X className="h-4 w-4" />
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
    </section>
  );
}
