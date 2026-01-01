import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

type Row = {
  id: string
  timestamp?: Date
  type?: string
  locationName?: string
  unitName?: string
}

export function InteractionDayDetailsSheet({
  open,
  onOpenChange,
  dateKey,
  rows,
  loading,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dateKey: string | null
  rows: Row[]
  loading: boolean
  error: string | null
}) {
  const title = React.useMemo(() => {
    if (!dateKey) return "Day details"
    const [y, m, d] = dateKey.split("-").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
    return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  }, [dateKey])

  const totalsByType = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const t = r.type ?? "unknown"
      map.set(t, (map.get(t) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [rows])

  const topLocations = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.locationName ?? "Unknown location"
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [rows])

  const topUnits = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.unitName ?? "Unknown unit"
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [rows])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0">
  {/* Fixed header */}
  <div className="p-4">
    <SheetHeader>
      <SheetTitle>{title}</SheetTitle>
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading…" : `${rows.length} interactions`}
      </p>
    </SheetHeader>
  </div>

  <Separator />

  {/* Scrollable body */}
  <div className="flex h-[calc(100vh-96px)] flex-col">
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
            {error}
          </div>
        ) : null}

        <div>
          <h4 className="text-sm font-medium">By type</h4>
          <div className="mt-2 space-y-1">
            {totalsByType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this day.</p>
            ) : (
              totalsByType.map(([t, c]) => (
                <div key={t} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{t.replaceAll("_", " ")}</span>
                  <span className="tabular-nums">{c}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium">Top locations</h4>
            <div className="mt-2 space-y-1">
              {topLocations.map(([k, c]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="truncate">{k}</span>
                  <span className="tabular-nums">{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium">Top units</h4>
            <div className="mt-2 space-y-1">
              {topUnits.map(([k, c]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="truncate">{k}</span>
                  <span className="tabular-nums">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium">Recent interactions</h4>
          <div className="mt-2 space-y-2">
            {rows.slice(0, 30).map((r) => (
              <div key={r.id} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="capitalize font-medium">
                    {(r.type ?? "unknown").replaceAll("_", " ")}
                  </span>
                  <span className="text-muted-foreground">
                    {r.timestamp
                      ? r.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {r.locationName ?? "Unknown location"} • {r.unitName ?? "Unknown unit"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
</SheetContent>
    </Sheet>
  )
}