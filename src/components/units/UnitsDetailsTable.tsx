import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table"
import type { ColumnDef, FilterFn } from "@tanstack/react-table"
import { TimeDate } from "@/components/common/times/time-date"

interface MyColumnMeta {
  align?: "left" | "right" | "center"
}

export type UnitVitals = {
  timestamp?: Date
  uptime?: number
  uptimeHours?: string
  uptimeDays?: string

  memoryUsagePercent?: string
  freeMemory?: number
  usedMemory?: number

  signalStrength?: number
  signalQuality?: number

  wifiHealth?: string
  wifiHealthDescription?: string

  cloudDisconnects?: number
  cloudConnects?: number
  networkDisconnects?: number
}

export interface UnitDetail {
  id: string
  name: string
  locationId?: string
  position?: string
  status?: string // "online" | "offline" | "warning";
  healthStatus?: string
  needsMaintenance: boolean
  inUse: boolean
  lastHeartbeat?: Date
  lastSessionDuration?: number

  // ✅ new (from UnitsListPage vitals lookup)
  vitals?: UnitVitals
  vitalsFresh?: boolean
}

interface UnitsDetailsTableProps {
  units: UnitDetail[]
}

function formatPercent(p?: string) {
  if (!p) return "—"
  return p.endsWith("%") ? p : `${p}%`
}

function wifiVariant(health?: string) {
  const s = (health ?? "").toLowerCase()
  if (!s) return "outline" as const
  if (s.includes("good") || s.includes("excellent")) return "default" as const
  if (s.includes("fair") || s.includes("ok")) return "secondary" as const
  if (s.includes("poor") || s.includes("bad")) return "destructive" as const
  return "secondary" as const
}

// ✅ Better global filter that searches across multiple fields (incl vitals)
const unitGlobalFilter: FilterFn<UnitDetail> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "").trim().toLowerCase()
  if (!q) return true

  const u = row.original
  const values: string[] = [
    u.id,
    u.name,
    u.locationId ?? "",
    u.position ?? "",
    u.status ?? "",
    u.healthStatus ?? "",
    u.inUse ? "in use" : "idle",
    u.vitals?.wifiHealth ?? "",
    u.vitals?.wifiHealthDescription ?? "",
    String(u.vitals?.signalStrength ?? ""),
    String(u.vitals?.signalQuality ?? ""),
    String(u.vitals?.cloudDisconnects ?? ""),
    String(u.vitals?.networkDisconnects ?? ""),
    u.vitals?.uptimeDays ?? "",
    u.vitals?.uptimeHours ?? "",
    u.vitals?.memoryUsagePercent ?? "",
  ]

  return values.some((v) => v.toLowerCase().includes(q))
}

export function UnitsDetailsTable({ units }: UnitsDetailsTableProps) {
  const navigate = useNavigate()
  const [globalFilter, setGlobalFilter] = useState("")

  const columns = useMemo<ColumnDef<UnitDetail>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Unit",
        cell: (info) => info.getValue(),
      },
      {
        accessorKey: "locationId",
        header: "Location",
        cell: (info) => info.getValue() ?? "—",
      },
      {
        accessorKey: "position",
        header: "Position",
        cell: (info) => info.getValue() ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const status = info.getValue<UnitDetail["status"]>()
          if (!status) return "—"
          const variant =
            status === "online"
              ? "default"
              : status === "offline"
              ? "secondary"
              : "destructive"
          return <Badge variant={variant}>{status}</Badge>
        },
      },
      {
        accessorKey: "healthStatus",
        header: "Health",
        cell: (info) => {
          const row = info.row.original
          if (row.needsMaintenance) {
            return (
              <Badge variant="destructive">
                {row.healthStatus ?? "Needs maintenance"}
              </Badge>
            )
          }
          if (row.healthStatus) {
            return (
              <Badge
                variant={row.healthStatus === "warning" ? "destructive" : "secondary"}
              >
                {row.healthStatus}
              </Badge>
            )
          }
          return "—"
        },
      },
      {
        accessorKey: "inUse",
        header: "In Use",
        cell: (info) =>
          info.getValue() ? (
            <Badge variant="default">In use</Badge>
          ) : (
            <Badge variant="outline">Idle</Badge>
          ),
      },

      // ✅ NEW: vitals timestamp / freshness
      {
        id: "vitalsTime",
        header: "Vitals",
        accessorFn: (row) => row.vitals?.timestamp,
        cell: (info) => {
          const u = info.row.original
          const t = u.vitals?.timestamp
          if (!t) return <span className="text-muted-foreground">—</span>

          const ageMs = Date.now() - t.getTime()
          const mins = Math.floor(ageMs / 60000)
          const ageLabel =
            mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`

          return (
            <div className="flex flex-col">
              <span className="text-sm">{ageLabel}</span>
              <span className="text-xs text-muted-foreground">
                {t.toLocaleString()}
              </span>
            </div>
          )
        },
      },

      // ✅ NEW: wifi health
      {
        id: "wifiHealth",
        header: "WiFi",
        accessorFn: (row) => row.vitals?.wifiHealth ?? "",
        cell: (info) => {
          const u = info.row.original
          const health = u.vitals?.wifiHealth
          if (!health) return "—"
          const v = wifiVariant(health)
          return <Badge variant={v}>{health}</Badge>
        },
      },

      // ✅ NEW: signal strength / quality
      {
        id: "signal",
        header: "Signal",
        cell: (info) => {
          const v = info.row.original.vitals
          if (!v) return "—"
          const strength = v.signalStrength
          const quality = v.signalQuality

          // show both when available
          if (strength == null && quality == null) return "—"

          return (
            <div className="text-sm">
              <div>{strength != null ? `${strength} dBm` : "—"}</div>
              <div className="text-xs text-muted-foreground">
                {quality != null ? `SNR ${quality} dB` : ""}
              </div>
            </div>
          )
        },
        meta: { align: "right" } as MyColumnMeta,
      },

      // ✅ NEW: memory usage %
      {
        id: "memory",
        header: "Memory",
        accessorFn: (row) => row.vitals?.memoryUsagePercent ?? "",
        cell: (info) => {
          const u = info.row.original
          const p = u.vitals?.memoryUsagePercent
          if (!p) return "—"
          return <span className="tabular-nums">{formatPercent(p)}</span>
        },
        meta: { align: "right" } as MyColumnMeta,
      },

      // ✅ NEW: cloud disconnects
      {
        id: "disconnects",
        header: "Disconnects",
        accessorFn: (row) => row.vitals?.cloudDisconnects ?? 0,
        cell: (info) => {
          const u = info.row.original
          const c = u.vitals?.cloudDisconnects
          const n = u.vitals?.networkDisconnects
          if (c == null && n == null) return "—"
          return (
            <div className="text-sm tabular-nums">
              <div>{c != null ? `Cloud: ${c}` : "Cloud: —"}</div>
              <div className="text-xs text-muted-foreground">
                {n != null ? `Net: ${n}` : "Net: —"}
              </div>
            </div>
          )
        },
        meta: { align: "right" } as MyColumnMeta,
      },

      {
        accessorKey: "lastHeartbeat",
        header: "Last Heartbeat",
        cell: (info) => <TimeDate date={info.getValue<UnitDetail["lastHeartbeat"]>()} />,
      },
      {
        accessorKey: "lastSessionDuration",
        header: "Last Session",
        cell: (info) => (
          <div className="flex items-center gap-1">
            <span className="text-sm">
              {info.getValue<UnitDetail["lastSessionDuration"]>()?.toFixed(0) ?? "—"} min
            </span>
          </div>
        ),
        meta: { align: "right" } as MyColumnMeta,
      },
    ],
    []
  )

  const table = useReactTable({
    data: units,
    columns,
    state: { globalFilter },
    globalFilterFn: unitGlobalFilter, // ✅ important
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Units Details</CardTitle>
        <Input
          placeholder="Search units (name, location, wifi, signal, etc.)..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="mt-2"
        />
      </CardHeader>
      <CardContent className="p-6">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp className="h-4 w-4" />,
                        desc: <ChevronDown className="h-4 w-4" />,
                      }[header.column.getIsSorted() as string] ?? (
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <p className="text-muted-foreground">
                    No units match the current filters.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/units/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as MyColumnMeta
                  return (
                    <TableCell
                      key={cell.id}
                      className={meta?.align === "right" ? "text-right" : ""}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* PAGINATION FOOTER */}
        <div className="flex items-center justify-between px-4 py-4 border-t">
          {/* Rows per page */}
          <div className="flex items-center space-x-2">
            <p className="text-sm">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Previous / Next */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>

            <span className="text-sm">
              Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of{" "}
              <strong>{table.getPageCount()}</strong>
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}