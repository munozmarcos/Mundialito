"use client";

import { TeamLabel } from "@/components/team-label";
import type { TeamOption } from "@/lib/team-options";
import { useEffect, useRef, useState } from "react";

type CountryFilterPickerProps = {
  value: string;
  options: TeamOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function CountryFilterPicker({ value, options, onChange, disabled = false }: CountryFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.name === value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className={`field flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selected ? <TeamLabel name={selected.name} code={selected.code} /> : <span className="font-black text-ink/45">Selección</span>}
        <span className="text-xs font-black text-ink/40">▼</span>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-field p-2 shadow-2xl">
          <button
            className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-black text-ink/45 hover:bg-card"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            type="button"
          >
            Selección
          </button>
          {options.map((option) => (
            <button
              className={`flex min-h-11 w-full items-center rounded-md px-3 text-left hover:bg-card ${option.name === value ? "bg-card ring-1 ring-grass/40" : ""}`}
              key={option.name}
              onClick={() => {
                onChange(option.name);
                setOpen(false);
              }}
              type="button"
            >
              <TeamLabel name={option.name} code={option.code} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
