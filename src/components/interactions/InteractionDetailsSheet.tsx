import * as React from "react"
import { doc, getDoc, Timestamp, type DocumentData } from "firebase/firestore"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { db } from "@/firebase"

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === "number") return new Date(value)
  // sometimes Firestore returns { seconds, nanoseconds } shapes in logs/tests
  if (typeof value === "object" && value && "seconds" in (value as any)) {
    const seconds = Number((value as any).seconds)
    if (Number.isFinite(seconds)) return new Date(seconds * 1000)
  }
  return null
}

function labelize(key: string) {
  return key
    .replaceAll("_", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/\s+/g, " ")
    .trim()
}

function displayValue(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "string") return v
  if (typeof v === "number") return String(v)
  if (typeof v === "boolean") return v ? "true" : "false"
  if (v instanceof Date) return v.toLocaleString()
  if (v instanceof Timestamp) return v.toDate().toLocaleString()
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

type InteractionDetails = {
  id: string
  timestamp?: Date | null
  type?: string
  // keep the whole doc so you can show extra fields without re-coding later
  raw: Record<string, unknown>
}

export function InteractionDetailsSheet({
  open,
  onOpenChange,
  interactionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  interactionId: string | null
}) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [details, setDetails] = React.useState<InteractionDetails | null>(null)

  React.useEffect(() => {
    const load = async () => {
      if (!open || !interactionId) return

      try {
        setLoading(true)
        setError(null)
        setDetails(null)

        const ref = doc(db, "interactions", interactionId)
        const snap = await getDoc(ref)

        if (!snap.exists()) {
          setError("Interaction not found.")
          return
        }

        const data = snap.data() as DocumentData
        const ts = parseTimestamp(data.timestamp)

        setDetails({
          id: snap.id,
          timestamp: ts,
          type: (data.type as string | undefined) ?? "unknown",
          raw: { ...data },
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load interaction details.")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [open, interactionId])

  const title = React.useMemo(() => {
    if (!details) return "Interaction details"
    const type = (details.type ?? "unknown").replaceAll("_", " ")
    return type.charAt(0).toUpperCase() + type.slice(1)
  }, [details])

  // pick a nice set of “primary” fields (based on your Firestore screenshots)
  const primaryRows = React.useMemo(() => {
    const raw = details?.raw ?? {}

    const orderedKeys = [
      "timestamp",
      "dateISO",
      "type",
      "outcome",
      "mode",
      "locationName",
      "locationId",
      "unitName",
      "unitId",
      "sessionId",
      "sessionDuration",
      "deviceId",
      "deviceType",
      "appLinked",
      "appDeviceMake",
      "appDeviceModel",
      "appBatteryStartLevel",
      "appUpdatedAtMs",
      "hourOfDay",
      "dayOfWeek",
      "day",
      "month",
      "monthName",
      "weekNumber",
      "year",
    ]

    const rows: Array<{ k: string; v: unknown }> = []

    for (const k of orderedKeys) {
      if (k === "timestamp") {
        const ts = details?.timestamp
        rows.push({ k: "timestamp", v: ts ? ts : raw.timestamp })
        continue
      }
      if (k in raw) rows.push({ k, v: raw[k] })
    }

    // Add “rest of fields” (anything not already in the list), sorted
    const used = new Set(rows.map((r) => r.k))
    const extra = Object.keys(raw)
      .filter((k) => !used.has(k))
      .sort((a, b) => a.localeCompare(b))
      .map((k) => ({ k, v: raw[k] }))

    return { primary: rows, extra }
  }, [details])

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setError(null)
          setDetails(null)
          setLoading(false)
        }
      }}
    >
      {/* p-0 so we control padding consistently + good scrolling */}
      <SheetContent className="w-full sm:max-w-xl p-0">
        {/* Header area with padding */}
        <div className="px-6 pt-6">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : details?.timestamp ? details.timestamp.toLocaleString() : "—"}
            </p>
          </SheetHeader>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
              {error}
            </div>
          ) : null}

          <Separator className="mt-4" />
        </div>

        {/* Scrollable body */}
        <div className="px-6 pb-6 pt-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading interaction…</div>
          ) : details ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium">Summary</h4>
                <div className="mt-2 grid grid-cols-1 gap-3">
                  {primaryRows.primary.map(({ k, v }) => (
                    <div key={k} className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{labelize(k)}</span>
                      <span className="text-right font-medium break-all">{displayValue(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {primaryRows.extra.length > 0 ? (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium">All fields</h4>
                    <div className="mt-2 grid grid-cols-1 gap-3">
                      {primaryRows.extra.map(({ k, v }) => (
                        <div key={k} className="flex items-start justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{labelize(k)}</span>
                          <span className="text-right break-all">{displayValue(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Select an interaction to view details.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}