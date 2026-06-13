"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const MONTHS = [
  { label: "Junio 2026", monthIndex: 5, start: 11, end: 30 },
  { label: "Julio 2026", monthIndex: 6, start: 1, end: 19 }
];

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function dateValue(monthIndex: number, day: number) {
  return `2026-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatLabel(value: string) {
  if (!value) return "Fecha";
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function monthFromValue(value: string) {
  if (!value) return 0;
  return value.startsWith("2026-07") ? 1 : 0;
}

function shiftDate(value: string, days: number) {
  const base = value ? new Date(`${value}T12:00:00`) : new Date("2026-06-11T12:00:00");
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAllowedDate(value: string) {
  return value >= "2026-06-11" && value <= "2026-07-19";
}

export function DateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [monthIndex, setMonthIndex] = useState(monthFromValue(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const previousValue = shiftDate(value, -1);
  const nextValue = shiftDate(value, 1);
  const canGoPrevious = Boolean(value) && isAllowedDate(previousValue);
  const canGoNext = Boolean(value) ? isAllowedDate(nextValue) : true;

  useEffect(() => {
    if (value) setMonthIndex(monthFromValue(value));
  }, [value]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const visibleMonth = MONTHS[monthIndex];
  const calendarCells = useMemo(() => {
    const firstDate = new Date(2026, visibleMonth.monthIndex, 1);
    const firstWeekDay = (firstDate.getDay() + 6) % 7;
    const daysInMonth = new Date(2026, visibleMonth.monthIndex + 1, 0).getDate();
    const cells: Array<{ day: number; enabled: boolean } | null> = Array.from({ length: firstWeekDay }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, enabled: day >= visibleMonth.start && day <= visibleMonth.end });
    }

    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  return (
    <div className="relative grid w-full max-w-[224px] min-w-[200px] grid-cols-[42px_minmax(106px,1fr)_42px] gap-2 justify-self-start" ref={rootRef}>
      <button
        aria-label="Fecha anterior"
        className="btn secondary h-10 min-h-10 px-0"
        disabled={!canGoPrevious}
        onClick={() => onChange(previousValue)}
        title="Fecha anterior"
        type="button"
      >
        <ChevronLeft className="date-nav-icon" />
      </button>
      <button
        aria-expanded={open}
        className="btn secondary min-h-10 w-full min-w-0 justify-start px-3"
        onClick={() => setOpen((current) => !current)}
        title="Elegir fecha"
        type="button"
      >
        <CalendarDays className="h-4 w-4" />
        <span className={`truncate text-sm ${value ? "font-black" : "font-semibold text-ink/55"}`}>{formatLabel(value)}</span>
      </button>
      <button
        aria-label="Fecha siguiente"
        className="btn secondary h-10 min-h-10 px-0"
        disabled={!canGoNext}
        onClick={() => onChange(value ? nextValue : "2026-06-11")}
        title="Fecha siguiente"
        type="button"
      >
        <ChevronRight className="date-nav-icon" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 sm:absolute sm:inset-auto sm:left-0 sm:top-[calc(100%+8px)] sm:block sm:bg-transparent sm:p-0"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-[min(calc(100vw-32px),286px)] overflow-hidden rounded-xl border border-line bg-[#061529] shadow-2xl shadow-black/70">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-[#071a32] p-2">
            <button
              aria-label="Mes anterior"
              className="btn secondary h-9 w-9 px-0"
              disabled={monthIndex === 0}
              onClick={() => setMonthIndex((current) => Math.max(0, current - 1))}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-center text-sm font-black text-ink">{visibleMonth.label}</p>
            <button
              aria-label="Mes siguiente"
              className="btn secondary h-9 w-9 px-0"
              disabled={monthIndex === MONTHS.length - 1}
              onClick={() => setMonthIndex((current) => Math.min(MONTHS.length - 1, current + 1))}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-2">
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-black text-ink/45">
              {WEEK_DAYS.map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, index) => {
                if (!cell) return <span className="h-8" key={`empty-${index}`} />;

                const currentValue = dateValue(visibleMonth.monthIndex, cell.day);
                const selected = currentValue === value;
                return (
                  <button
                    className={`h-8 rounded-md border text-xs font-black transition ${
                      selected
                        ? "border-grass bg-grass text-pitch shadow-lg shadow-grass/20"
                        : cell.enabled
                        ? "border-line bg-field text-ink/80 hover:border-blue hover:text-white"
                        : "cursor-not-allowed border-transparent bg-transparent text-ink/20"
                    }`}
                    disabled={!cell.enabled}
                    key={currentValue}
                    onClick={() => {
                      onChange(currentValue);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
