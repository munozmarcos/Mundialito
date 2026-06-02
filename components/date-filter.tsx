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
    ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
    : "Fecha";

  return (
    <div className="relative min-w-0">
      <button
        className="btn secondary min-h-10 w-full min-w-0 justify-start px-3"
        onClick={openPicker}
        title="Elegir fecha"
        type="button"
      >
        <CalendarDays className="h-4 w-4" />
        <span className={`truncate text-sm ${value ? "font-black" : "font-semibold text-ink/55"}`}>{label}</span>
      </button>
      <input
        className="pointer-events-none absolute left-3 top-3 h-px w-px opacity-0"
        max="2026-07-19"
        min="2026-06-11"
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
