"use client";

type AnyDate =
  | Date
  | string
  | number
  | { seconds: number; nanoseconds: number } // Firestore Timestamp
  | null
  | undefined;

type TimeDateProps = {
  date?: AnyDate;
};

export function TimeDate({ date }: TimeDateProps) {
  const normalizeDate = (value: AnyDate): Date | null => {
    if (!value) return null;

    // Already a Date
    if (value instanceof Date) return value;

    // Firestore Timestamp
    if (
      typeof value === "object" &&
      "seconds" in value &&
      "nanoseconds" in value
    ) {
      return new Date(value.seconds * 1000 + value.nanoseconds / 1_000_000);
    }

    // Timestamp (number)
    if (typeof value === "number") {
      return new Date(value);
    }

    // String
    if (typeof value === "string") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

  const d = normalizeDate(date);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

  if (!d) {
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium">-</span>
        <span className="text-xs text-muted-foreground">-</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm font-medium">{formatTime(d)}</span>
      <span className="text-xs text-muted-foreground">{formatDate(d)}</span>
    </div>
  );
}
