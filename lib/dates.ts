export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function formatArgentinaDateTime(value: string | Date) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ARGENTINA_TIME_ZONE
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} - ${get("hour")}:${get("minute")}`;
}

export function formatArgentinaDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ARGENTINA_TIME_ZONE
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} - ${get("hour")}:${get("minute")}`;
}

export function argentinaDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ARGENTINA_TIME_ZONE
  }).format(new Date(value));
}
