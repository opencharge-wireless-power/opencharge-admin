import { useEffect, useMemo, useState } from "react"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type DocumentData,
} from "firebase/firestore"

import { db } from "../firebase"
import { PageHeader } from "../components/layout/PageHeader"
import { PulseLoader } from "../components/common/loading/pulse-loader"
import {
  InteractionsAreaChart,
  type InteractionPoint,
} from "../components/interactions/InteractionsAreaChart"

type RangeKey = "90d" | "30d" | "7d"

function startDateForRange(range: RangeKey) {
  const now = new Date()
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function formatDayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}` // YYYY-MM-DD
}

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === "number") return new Date(value)
  return null
}

function parseDateISO(value: unknown): Date | null {
  if (typeof value !== "string") return null
  // expects "YYYY-MM-DD"
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function InteractionsPage() {
  const [range, setRange] = useState<RangeKey>("90d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<InteractionPoint[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const start = startDateForRange(range)

        // ✅ Your docs use `timestamp` (per your screenshots)
        const ref = collection(db, "interactions")
        const q = query(
          ref,
          where("timestamp", ">=", Timestamp.fromDate(start)),
          orderBy("timestamp", "asc")
        )

        const snap = await getDocs(q)

        // Debug: confirm we’re actually pulling docs
        console.log("[Interactions] range:", range, "docs:", snap.size)

        const perDay = new Map<string, number>()

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData

          // Prefer timestamp, fallback to dateISO
          const dt =
            parseTimestamp(data.timestamp) ??
            parseDateISO(data.dateISO)

          if (!dt) return

          const key = formatDayKey(dt)
          perDay.set(key, (perDay.get(key) ?? 0) + 1)
        })

        // Fill missing days (continuous line)
        const filled: InteractionPoint[] = []
        const now = new Date()

        const cursor = new Date(start)
        cursor.setHours(0, 0, 0, 0)

        const end = new Date(now)
        end.setHours(0, 0, 0, 0)

        while (cursor <= end) {
          const key = formatDayKey(cursor)
          filled.push({
            date: key,
            interactions: perDay.get(key) ?? 0,
          })
          cursor.setDate(cursor.getDate() + 1)
        }

        setPoints(filled)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load interactions"
        )
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [range])

  const subtitle = useMemo(() => {
    return range === "7d"
      ? "Total for the last 7 days"
      : range === "30d"
        ? "Total for the last 30 days"
        : "Total for the last 3 months"
  }, [range])

  if (loading) {
    return (
      <>
        <PageHeader
          title="Interactions"
          breadcrumbs={[{ label: "Interactions", href: "/interactions" }]}
        />
        <div className="flex flex-1 items-center justify-center p-4">
          <PulseLoader size={8} pulseCount={4} speed={1.5} />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Interactions"
          breadcrumbs={[{ label: "Interactions", href: "/interactions" }]}
        />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Interactions"
        breadcrumbs={[{ label: "Interactions", href: "/interactions" }]}
      />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground">
              Track interaction volume over time (tap, scan, click, etc.).
            </p>
          </div>

          <div className="inline-flex rounded-md border bg-background p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${range === "90d" ? "bg-muted" : ""}`}
              onClick={() => setRange("90d")}
            >
              Last 3 months
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${range === "30d" ? "bg-muted" : ""}`}
              onClick={() => setRange("30d")}
            >
              Last 30 days
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${range === "7d" ? "bg-muted" : ""}`}
              onClick={() => setRange("7d")}
            >
              Last 7 days
            </button>
          </div>
        </div>

        <InteractionsAreaChart
          title="Total Interactions"
          subtitle={subtitle}
          data={points}
        />
      </div>
    </>
  )
}