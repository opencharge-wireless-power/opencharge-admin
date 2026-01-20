// src/pages/UnitsListPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  collection,
  getDocs,
  Timestamp,
  type DocumentData,
} from "firebase/firestore"
import { RefreshCcw } from "lucide-react"

import { db } from "../firebase"
import { PageHeader } from "../components/layout/PageHeader"
import { OverviewCards } from "@/components/common/cards/overview-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import type { Unit, UnitHealth, UnitMetrics, UnitInteractions } from "../types/Opencharge"
import { UnitsDetailsTable } from "@/components/units/UnitsDetailsTable"
import { PulseLoader } from "@/components/common/loading/pulse-loader"
import { UnitWarning, UnitOffline, UnitInUse, UnitOnline, Units } from "@/components/icons/Icons"

type StatusFilter = "all" | "online" | "offline" | "warning"

// ✅ Minimal vitals type (matches what your UnitsDetailsTable expects)
export type UnitVitals = {
  timestamp?: Date
  uptime?: number
  uptimeHours?: string
  uptimeDays?: string

  freeMemory?: number
  freeMemoryKB?: string
  usedMemory?: number
  usedMemoryKB?: string
  memoryUsagePercent?: string

  signalStrength?: number
  signalQuality?: number

  wifiHealth?: string
  wifiHealthNumeric?: number
  wifiHealthDescription?: string
  wifiHealthTooltip?: string
  wifiStrengthHealth?: string
  wifiQualityHealth?: string

  cloudDisconnects?: number
  cloudConnects?: number
  networkDisconnects?: number

  rateLimited?: number
  totalQueries?: number
  totalPublishes?: number

  source?: string
}

// Unit used in the list: base Unit + extras
type ListUnit = Unit & {
  locationId?: string
  healthStatus?: string
  needsMaintenance: boolean
  inUse: boolean

  vitals?: UnitVitals
  vitalsFresh?: boolean
}

// helper for Firestore timestamps / nulls
function tsToDate(value: Timestamp | null | undefined): Date | undefined {
  return value?.toDate()
}

function anyToDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const v = value as { toDate?: () => Date }
    if (typeof v.toDate === "function") return v.toDate()
  }
  if (typeof value === "number") return new Date(value)
  return undefined
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function UnitsListPage() {
  const _navigate = useNavigate()

  const [units, setUnits] = useState<ListUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [inUseOnly, setInUseOnly] = useState<boolean>(false)
  const [maintenanceOnly, setMaintenanceOnly] = useState<boolean>(false)

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setLoading(true)
        setError(null)

        const snap = await getDocs(collection(db, "units"))

        const items: ListUnit[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData

          const metrics = (data.metrics as DocumentData | undefined) ?? {}
          const health = (data.health as DocumentData | undefined) ?? {}
          const vitalsRaw = (data.vitals as DocumentData | undefined) ?? {}

          const status =
            (metrics.status as string | undefined) ??
            (data.status as string | undefined)

          const healthStatus = health.status as string | undefined

          const positionField =
            (metrics.position as string | undefined) ??
            (data.position as string | undefined) ??
            undefined

          const lastHeartbeat = tsToDate(data.lastHeartbeat)
          const lastInteraction = tsToDate(data.lastInteraction)
          const lastSessionTimestamp = tsToDate(data.lastSessionTimestamp)

          const lastSessionDuration =
            typeof data.lastSessionDuration === "number"
              ? (data.lastSessionDuration as number)
              : undefined

          const totalSessions =
            typeof data.totalSessions === "number"
              ? (data.totalSessions as number)
              : typeof metrics.totalSessions === "number"
              ? (metrics.totalSessions as number)
              : undefined

          const totalInteractions =
            typeof data.totalInteractions === "number"
              ? (data.totalInteractions as number)
              : typeof metrics.totalInteractions === "number"
              ? (metrics.totalInteractions as number)
              : undefined

          const particleDeviceId =
            (metrics.particleDeviceId as string | undefined) ??
            (data.particleDeviceId as string | undefined)

          // ✅ Build vitals from the unit document field (units/{id}.vitals.*)
          const vitalsTimestamp = anyToDate(vitalsRaw.timestamp)

          const vitals: UnitVitals | undefined =
            Object.keys(vitalsRaw).length === 0
              ? undefined
              : {
                  timestamp: vitalsTimestamp,

                  uptime: toNumber(vitalsRaw.uptime),
                  uptimeHours: toStringOrUndefined(vitalsRaw.uptimeHours),
                  uptimeDays: toStringOrUndefined(vitalsRaw.uptimeDays),

                  freeMemory: toNumber(vitalsRaw.freeMemory),
                  freeMemoryKB: toStringOrUndefined(vitalsRaw.freeMemoryKB) ?? (toNumber(vitalsRaw.freeMemoryKB) != null ? String(vitalsRaw.freeMemoryKB) : undefined),
                  usedMemory: toNumber(vitalsRaw.usedMemory),
                  usedMemoryKB: toStringOrUndefined(vitalsRaw.usedMemoryKB) ?? (toNumber(vitalsRaw.usedMemoryKB) != null ? String(vitalsRaw.usedMemoryKB) : undefined),
                  memoryUsagePercent: toStringOrUndefined(vitalsRaw.memoryUsagePercent),

                  signalStrength: toNumber(vitalsRaw.signalStrength),
                  signalQuality: toNumber(vitalsRaw.signalQuality),

                  wifiHealth: toStringOrUndefined(vitalsRaw.wifiHealth),
                  wifiHealthNumeric: toNumber(vitalsRaw.wifiHealthNumeric),
                  wifiHealthDescription: toStringOrUndefined(vitalsRaw.wifiHealthDescription),
                  wifiHealthTooltip: toStringOrUndefined(vitalsRaw.wifiHealthTooltip),
                  wifiStrengthHealth: toStringOrUndefined(vitalsRaw.wifiStrengthHealth),
                  wifiQualityHealth: toStringOrUndefined(vitalsRaw.wifiQualityHealth),

                  cloudDisconnects: toNumber(vitalsRaw.cloudDisconnects),
                  cloudConnects: toNumber(vitalsRaw.cloudConnects),
                  networkDisconnects: toNumber(vitalsRaw.networkDisconnects),

                  rateLimited: toNumber(vitalsRaw.rateLimited),
                  totalQueries: toNumber(vitalsRaw.totalQueries),
                  totalPublishes: toNumber(vitalsRaw.totalPublishes),

                  source: toStringOrUndefined(vitalsRaw.source),
                }

          // ✅ Freshness flag (2 hours)
          let vitalsFresh: boolean | undefined
          if (vitalsTimestamp) {
            const ageMs = Date.now() - vitalsTimestamp.getTime()
            vitalsFresh = ageMs <= 2 * 60 * 60 * 1000
          }

          return {
            id: docSnap.id,
            name:
              (metrics.name as string | undefined) ??
              (data.name as string | undefined) ??
              docSnap.id,
            position: positionField,
            status,
            inUse: (data.inUse as boolean | undefined) ?? false,

            currentDeviceType: data.currentDeviceType as string | undefined,
            currentMode: data.currentMode as string | undefined,

            lastHeartbeat,
            lastInteraction,
            lastSessionTimestamp,

            lastInteractionType:
              (data.lastInteractionType as string | undefined) ??
              (metrics.lastInteractionType as string | undefined),
            lastInteractionMode:
              (data.lastInteractionMode as string | undefined) ??
              (metrics.lastInteractionMode as string | undefined),
            lastInteractionDeviceType:
              (data.lastInteractionDeviceType as string | undefined) ??
              (metrics.lastInteractionDeviceType as string | undefined),

            lastSessionDuration,
            lastSessionMode:
              (data.lastSessionMode as string | undefined) ??
              (metrics.lastSessionMode as string | undefined),
            lastSessionDeviceType:
              (data.lastSessionDeviceType as string | undefined) ??
              (metrics.lastSessionDeviceType as string | undefined),

            totalSessions,
            totalInteractions,
            particleDeviceId,

            health: health as UnitHealth,
            metrics: metrics as UnitMetrics,
            interactions: data.interactions as UnitInteractions,

            locationId: data.locationId as string | undefined,
            healthStatus,
            needsMaintenance: (health.needsMaintenance as boolean | undefined) ?? false,

            // ✅ new
            vitals,
            vitalsFresh,
          } as ListUnit
        })

        // sort by location then name
        items.sort((a, b) => {
          const la = a.locationId ?? ""
          const lb = b.locationId ?? ""
          if (la !== lb) return la.localeCompare(lb)
          return a.name.localeCompare(b.name)
        })

        setUnits(items)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load units"
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    void fetchUnits()
  }, [])

  // ---------- KPI stats ----------
  const totalUnits = units.length
  const onlineCount = units.filter((u) => u.status === "online").length
  const offlineCount = units.filter((u) => u.status === "offline").length
  const warningCount = units.filter(
    (u) => u.healthStatus === "warning" || u.status === "warning"
  ).length
  const inUseCount = units.filter((u) => u.inUse).length
  const maintenanceCount = units.filter((u) => u.needsMaintenance).length

  // distinct locations
  const locationOptions: string[] = Array.from(
    new Set(units.map((u) => u.locationId).filter((id): id is string => !!id))
  ).sort((a, b) => a.localeCompare(b))

  // filters
  const filteredUnits = units.filter((u) => {
    if (locationFilter !== "all") {
      if (!u.locationId || u.locationId !== locationFilter) return false
    }

    if (statusFilter !== "all") {
      if (statusFilter === "warning") {
        if (u.healthStatus !== "warning" && u.status !== "warning") return false
      } else {
        if (u.status !== statusFilter) return false
      }
    }

    if (inUseOnly && !u.inUse) return false
    if (maintenanceOnly && !u.needsMaintenance) return false

    return true
  })

  if (loading) {
    return (
      <>
        <PageHeader title="Units" breadcrumbs={[{ label: "Units", href: "/units" }]} />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <PulseLoader size={8} pulseCount={4} speed={1.5} />
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Units" breadcrumbs={[{ label: "Units", href: "/units" }]} />
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
      <PageHeader title="Units" breadcrumbs={[{ label: "Units", href: "/units" }]} />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Header section */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
              Monitor all charging units, filter by location, status and health,
              and drill into a unit for full details.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <OverviewCards
          columns={5}
          stats={[
            { title: "Total Units", value: totalUnits.toString(), subtitle: "Total deployed", icon: Units },
            { title: "Online", value: onlineCount.toString(), subtitle: "Reporting as online", icon: UnitOnline },
            { title: "Offline", value: offlineCount.toString(), subtitle: "Not currently online", icon: UnitOffline },
            { title: "Warning / Degraded", value: warningCount.toString(), subtitle: "Health status warning", icon: UnitWarning },
            { title: "In Use", value: inUseCount.toString(), subtitle: `Currently charging • ${maintenanceCount} need maintenance`, icon: UnitInUse },
          ]}
        />

        {/* Filters */}
        <Card className="shadow-none">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="location-filter" className="mb-2 block">
                  Location
                </Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger id="location-filter">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locationOptions.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="status-filter" className="mb-2 block">
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4 items-center">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="in-use-only"
                    checked={inUseOnly}
                    onCheckedChange={(checked) => setInUseOnly(checked === true)}
                  />
                  <Label htmlFor="in-use-only" className="text-sm font-normal cursor-pointer">
                    In use only
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="maintenance-only"
                    checked={maintenanceOnly}
                    onCheckedChange={(checked) => setMaintenanceOnly(checked === true)}
                  />
                  <Label htmlFor="maintenance-only" className="text-sm font-normal cursor-pointer">
                    Needs maintenance only
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Units detail table */}
        <UnitsDetailsTable units={filteredUnits} />
      </div>
    </>
  )
}