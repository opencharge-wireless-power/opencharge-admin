import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  MapPin,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  PlugZap,
  Search as SearchIcon,
} from "lucide-react"
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
import { OverviewCards } from "@/components/common/cards/overview-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { InteractionsStackedAreaChart } from "../components/interactions/InteractionsStackedAreaChart"
import { InteractionDayDetailsSheet } from "../components/interactions/InteractionDayDetailsSheet"
import { InteractionsTable, type InteractionRow } from "@/components/interactions/InteractionsTable"

type RangeKey = "90d" | "30d" | "7d"

// Canonical types we will chart/filter on
const CANON_TYPES = [
  { key: "charging_started", label: "Charging started" },
  { key: "successful_charge", label: "Successful charge" },
  { key: "issue_cleared", label: "Issue cleared" },
  { key: "other", label: "Other" },
] as const

type CanonType = (typeof CANON_TYPES)[number]["key"]

export type StackedPoint = {
  date: string // YYYY-MM-DD
  total: number
  [type: string]: number | string
}

function startDateForRange(range: RangeKey) {
  const now = new Date()
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function startOfDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}
function endOfDay(dateKey: string) {
  const s = startOfDay(dateKey)
  const e = new Date(s)
  e.setDate(e.getDate() + 1)
  return e
}

function parseTimestamp(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === "number") return new Date(value)
  return null
}

/**
 * ✅ Normalize raw Firestore type into canonical keys.
 * - Buckets non-interaction “modes” into "other"
 */
function normalizeType(raw: unknown): CanonType {
  const s = String(raw ?? "").trim().toLowerCase()

  if (
    s.includes("not charging") ||
    s.includes("idle") ||
    s.includes("available") ||
    s.includes("offline") ||
    s.includes("online")
  ) {
    return "other"
  }

  if (s.includes("charging_started") || (s.includes("charging") && s.includes("started"))) {
    return "charging_started"
  }
  if (s.includes("successful_charge") || (s.includes("successful") && s.includes("charge"))) {
    return "successful_charge"
  }
  if (s.includes("issue_cleared") || (s.includes("issue") && s.includes("clear"))) {
    return "issue_cleared"
  }

  return "other"
}

type RawInteraction = {
  id: string
  timestamp?: Date
  type?: string        // raw Firestore type
  canonType: CanonType // normalized
  locationName?: string
  unitName?: string
}

export function InteractionsPage() {
  // ✅ default = 7 days
  const [range, setRange] = useState<RangeKey>("7d")

  // default: meaningful series
  const [selectedTypes, setSelectedTypes] = useState<Set<CanonType>>(
    () => new Set<CanonType>(["successful_charge", "charging_started", "issue_cleared"])
  )

  // ✅ search + pagination controls
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25)
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [chartPoints, setChartPoints] = useState<StackedPoint[]>([])
  const [totalInteractions, setTotalInteractions] = useState(0)

  const [topLocations, setTopLocations] = useState<{ label: string; count: number }[]>([])
  const [topUnits, setTopUnits] = useState<{ label: string; count: number }[]>([])

  // raw list for table
  const [rawRows, setRawRows] = useState<RawInteraction[]>([])

  // day click -> drawer
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDayRows, setSelectedDayRows] = useState<RawInteraction[]>([])
  const [selectedDayLoading, setSelectedDayLoading] = useState(false)
  const [selectedDayError, setSelectedDayError] = useState<string | null>(null)

  const enabledTypeKeys = useMemo(() => Array.from(selectedTypes.values()), [selectedTypes])

  const subtitle = useMemo(() => {
    return range === "7d"
      ? "Total for the last 7 days"
      : range === "30d"
      ? "Total for the last 30 days"
      : "Total for the last 3 months"
  }, [range])

  const toggleType = (t: CanonType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  // reset page when range/types/search/pagesize changes
  useEffect(() => {
    setPage(1)
  }, [range, enabledTypeKeys.join("|"), search, pageSize])

  // KPI totals by type (based on current range+filters)
  const totalsByType = useMemo(() => {
    const totals: Record<CanonType, number> = {
      charging_started: 0,
      successful_charge: 0,
      issue_cleared: 0,
      other: 0,
    }

    for (const r of rawRows) {
      totals[r.canonType] += 1
    }

    const visibleTotal = enabledTypeKeys.reduce((sum, k) => sum + (totals[k] ?? 0), 0)
    return { totals, visibleTotal }
  }, [rawRows, enabledTypeKeys])

  // Convert rawRows -> table rows
  const tableRows: InteractionRow[] = useMemo(
    () =>
      rawRows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        canonType: r.canonType,
        rawType: r.type,
        locationName: r.locationName,
        unitName: r.unitName,
      })),
    [rawRows]
  )

  // ✅ Search filter (location/unit/type)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tableRows

    return tableRows.filter((r) => {
      const canon = String(r.canonType ?? "").replaceAll("_", " ").toLowerCase()
      const raw = String((r as any).rawType ?? "").toLowerCase()
      const loc = String(r.locationName ?? "").toLowerCase()
      const unit = String(r.unitName ?? "").toLowerCase()

      return (
        canon.includes(q) ||
        raw.includes(q) ||
        loc.includes(q) ||
        unit.includes(q)
      )
    })
  }, [tableRows, search])

  // ✅ Pagination derived
  const totalItems = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pageItems = filteredRows.slice(startIndex, startIndex + pageSize)

  const canPrev = safePage > 1
  const canNext = safePage < totalPages

  const goFirst = () => setPage(1)
  const goLast = () => setPage(totalPages)
  const prev = () => setPage((p) => Math.max(1, p - 1))
  const next = () => setPage((p) => Math.min(totalPages, p + 1))

  // ---- Main load (chart + KPIs + top lists + raw rows) ----
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const start = startDateForRange(range)

        const ref = collection(db, "interactions")
        const q = query(
          ref,
          where("timestamp", ">=", Timestamp.fromDate(start)),
          orderBy("timestamp", "asc")
        )

        const snap = await getDocs(q)

        const perDay = new Map<string, Record<CanonType, number>>()
        const locationAgg = new Map<string, number>()
        const unitAgg = new Map<string, number>()

        const rows: RawInteraction[] = []
        let totalVisible = 0

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData
          const dt = parseTimestamp(data.timestamp)
          if (!dt) return

          const rawType = (data.type as string | undefined) ?? "unknown"
          const canonType = normalizeType(rawType)

          // filter client-side by canonical type
          if (enabledTypeKeys.length > 0 && !enabledTypeKeys.includes(canonType)) return

          totalVisible += 1
          const key = dayKey(dt)

          const dayCounts =
            perDay.get(key) ??
            { charging_started: 0, successful_charge: 0, issue_cleared: 0, other: 0 }

          dayCounts[canonType] += 1
          perDay.set(key, dayCounts)

          const loc = (data.locationName as string | undefined) ?? "Unknown location"
          const unit = (data.unitName as string | undefined) ?? "Unknown unit"
          locationAgg.set(loc, (locationAgg.get(loc) ?? 0) + 1)
          unitAgg.set(unit, (unitAgg.get(unit) ?? 0) + 1)

          rows.push({
            id: docSnap.id,
            timestamp: dt,
            type: rawType,
            canonType,
            locationName: loc,
            unitName: unit,
          })
        })

        // Fill missing days for chart
        const filled: StackedPoint[] = []
        const now = new Date()
        const cursor = new Date(start)
        cursor.setHours(0, 0, 0, 0)

        const end = new Date(now)
        end.setHours(0, 0, 0, 0)

        while (cursor <= end) {
          const key = dayKey(cursor)
          const counts =
            perDay.get(key) ??
            { charging_started: 0, successful_charge: 0, issue_cleared: 0, other: 0 }

          const point: StackedPoint = { date: key, total: 0 }
          for (const t of enabledTypeKeys) {
            const v = counts[t] ?? 0
            point[t] = v
            point.total = (point.total as number) + v
          }

          filled.push(point)
          cursor.setDate(cursor.getDate() + 1)
        }

        // newest first for table
        rows.sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0))

        setChartPoints(filled)
        setTotalInteractions(totalVisible)
        setRawRows(rows)

        const topLocs = Array.from(locationAgg.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        const topU = Array.from(unitAgg.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        setTopLocations(topLocs)
        setTopUnits(topU)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interactions")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [range, enabledTypeKeys])

  // ---- Day click: load interactions for that day (drawer) ----
  const onDayClick = async (dateKey: string) => {
    setSelectedDay(dateKey)
    setSelectedDayRows([])
    setSelectedDayError(null)

    try {
      setSelectedDayLoading(true)

      const start = startOfDay(dateKey)
      const end = endOfDay(dateKey)

      const ref = collection(db, "interactions")
      const q = query(
        ref,
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<", Timestamp.fromDate(end)),
        orderBy("timestamp", "asc")
      )

      const snap = await getDocs(q)

      const rows: RawInteraction[] = []
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as DocumentData
        const dt = parseTimestamp(data.timestamp)
        const rawType = (data.type as string | undefined) ?? "unknown"
        const canonType = normalizeType(rawType)

        if (enabledTypeKeys.length > 0 && !enabledTypeKeys.includes(canonType)) return

        rows.push({
          id: docSnap.id,
          timestamp: dt ?? undefined,
          type: rawType,
          canonType,
          locationName: (data.locationName as string | undefined) ?? "Unknown location",
          unitName: (data.unitName as string | undefined) ?? "Unknown unit",
        })
      })

      setSelectedDayRows(rows)
    } catch (err) {
      setSelectedDayError(err instanceof Error ? err.message : "Failed to load day details")
    } finally {
      setSelectedDayLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Interactions" breadcrumbs={[{ label: "Interactions", href: "/interactions" }]} />
        <div className="flex flex-1 items-center justify-center p-4">
          <PulseLoader size={8} pulseCount={4} speed={1.5} />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Interactions" breadcrumbs={[{ label: "Interactions", href: "/interactions" }]} />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Interactions" breadcrumbs={[{ label: "Interactions", href: "/interactions" }]} />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground">
              Track interaction volume over time (charging started, issue cleared, successful charge).
            </p>
          </div>

          <div className="inline-flex rounded-md border bg-background p-1">
            <button
              className={`px-3 py-1.5 text-sm rounded-md ${range === "7d" ? "bg-muted" : ""}`}
              onClick={() => setRange("7d")}
            >
              Last 7 days
            </button>

            <button
              className={`px-3 py-1.5 text-sm rounded-md ${range === "30d" ? "bg-muted" : ""}`}
              onClick={() => setRange("30d")}
            >
              Last 30 days
            </button>

            <button
              className={`px-3 py-1.5 text-sm rounded-md ${range === "90d" ? "bg-muted" : ""}`}
              onClick={() => setRange("90d")}
            >
              Last 3 months
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {CANON_TYPES.filter((t) => t.key !== "other").map((t) => {
            const active = selectedTypes.has(t.key)
            return (
              <button
                key={t.key}
                onClick={() => toggleType(t.key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  active ? "bg-muted" : "bg-background"
                }`}
              >
                {t.label}
              </button>
            )
          })}

          <button
            onClick={() => toggleType("other")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              selectedTypes.has("other") ? "bg-muted" : "bg-background"
            }`}
          >
            Other
          </button>
        </div>

        {/* KPI cards */}
        <OverviewCards
          columns={4}
          stats={[
            { title: "Total interactions", value: totalsByType.visibleTotal.toString(), subtitle, icon: Activity },
            { title: "Charging started", value: totalsByType.totals.charging_started.toString(), subtitle: "In selected range", icon: PlugZap },
            { title: "Successful charge", value: totalsByType.totals.successful_charge.toString(), subtitle: "In selected range", icon: CheckCircle2 },
            { title: "Issue cleared", value: totalsByType.totals.issue_cleared.toString(), subtitle: "In selected range", icon: AlertTriangle },
          ]}
        />

        {/* Top location/unit cards */}
        <OverviewCards
          columns={2}
          stats={[
            { title: "Top location", value: topLocations[0]?.label ?? "–", subtitle: topLocations[0] ? `${topLocations[0].count} interactions` : "–", icon: MapPin },
            { title: "Top unit", value: topUnits[0]?.label ?? "–", subtitle: topUnits[0] ? `${topUnits[0].count} interactions` : "–", icon: Cpu },
          ]}
        />

        {/* Chart */}
        <InteractionsStackedAreaChart
          title="Total Interactions"
          subtitle={subtitle}
          data={chartPoints}
          typeKeys={enabledTypeKeys}
          onDayClick={onDayClick}
        />

        {/* Raw interactions table (Search + Page size + First/Last) */}
        <div className="rounded-lg border bg-background">
          <div className="border-b px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">Raw interactions</div>
              <div className="text-sm text-muted-foreground">
                Showing {pageItems.length} of {totalItems} (page {safePage} / {totalPages})
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative w-full sm:w-[280px]">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search location, unit, type..."
                  className="pl-8"
                />
              </div>

              {/* Page size */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50 | 100)}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goFirst} disabled={!canPrev}>
                  First
                </Button>
                <Button variant="outline" size="sm" onClick={prev} disabled={!canPrev}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" onClick={next} disabled={!canNext}>
                  Next
                </Button>
                <Button variant="outline" size="sm" onClick={goLast} disabled={!canNext}>
                  Last
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 pt-3">
            <InteractionsTable rows={pageItems} />
            {totalItems === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No interactions found for this range / filters.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side panel */}
      <InteractionDayDetailsSheet
        dateKey={selectedDay}
        open={Boolean(selectedDay)}
        onOpenChange={(open) => {
          if (!open) setSelectedDay(null)
        }}
        rows={selectedDayRows}
        loading={selectedDayLoading}
        error={selectedDayError}
      />
    </>
  )
}