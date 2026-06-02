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

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
      <button className="btn secondary min-h-10 px-3" onClick={openPicker} title="Elegir fecha" type="button">
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        className="field"
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
