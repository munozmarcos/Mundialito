"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function DateFilter({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (inputRef.current?.showPicker) inputRef.current.showPicker();
    else inputRef.current?.focus();
  }

  const label = value
    ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`))
    : "Filtrar por fecha";

  return (
    <div className="relative grid grid-cols-[44px_1fr] items-center gap-2">
      <button
        className="btn secondary min-h-11 px-0"
        onClick={openPicker}
        title="Elegir fecha"
        type="button"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <div className={`field flex min-h-11 items-center ${value ? "font-black text-ink" : "text-ink/45"}`}>
        {label}
      </div>
      <input
        className="pointer-events-none absolute left-3 top-3 h-px w-px opacity-0"
        max="2026-07-19"
        min="2026-06-11"
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-black text-ink/45 hover:bg-white/10"
          onClick={(event) => {
            event.stopPropagation();
            onChange("");
          }}
          type="button"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
