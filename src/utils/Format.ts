// src/utils/format.ts

export function formatDateTime(date?: Date): string {
  if (!date) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatDurationMinutes(minutes?: number): string {
  if (minutes == null || Number.isNaN(minutes)) return "-";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function formatDateRange(from?: Date, to?: Date): string {
  if (!from && !to) return "-";
  if (from && !to) return `From ${from.toLocaleDateString()}`;
  if (!from && to) return `Until ${to.toLocaleDateString()}`;
  return `${from!.toLocaleDateString()} – ${to!.toLocaleDateString()}`;
}

export function formatShortDateTime(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPercent(value?: number): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

export const ORDERED_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];