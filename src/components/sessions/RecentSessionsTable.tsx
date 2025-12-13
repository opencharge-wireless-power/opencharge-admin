// src/components/sessions/RecentSessionsTable.tsx


import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Input,
} from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
    ChevronUp,
    ChevronDown,
    ChevronsUpDown
  } from "lucide-react";

import { TimeDate } from "@/components/common/times/time-date";


interface SessionItem {
  id: string;
  locationId?: string;
  locationName?: string;
  unitId?: string;
  unitName?: string;
  status?: "completed" | "in_progress";
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
  appLinked?: boolean;
  appBatteryDelta?: number;
}

interface RecentSessionsTableProps {
  sessions: SessionItem[];
  onSessionClick: (session: SessionItem) => void;
}


/* ------------------------------- Table Columns ------------------------------- */
const columns: ColumnDef<SessionItem>[] = [
  {
    accessorKey: "locationName",
    header: "Location",
    cell: ({ row }) => row.original.locationName ?? row.original.locationId ?? "-",
  },
  {
    accessorKey: "unitName",
    header: "Unit",
    cell: ({ row }) => row.original.unitName ?? row.original.unitId ?? "-",
  },
  {
    accessorKey: "appLinked",
    header: "App",
    cell: ({ row }) =>
      row.original.appLinked ? (
        <Badge variant="default">
          {row.original.appBatteryDelta != null
            ? `App (${row.original.appBatteryDelta.toFixed(0)}%)`
            : "App"}
        </Badge>
      ) : (
        "-"
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.status ? (
        <Badge
          variant={row.original.status === "completed" ? "default" : "secondary"}
        >
          {row.original.status === "completed" ? "Completed" : "In progress"}
        </Badge>
      ) : (
        "-"
      ),
  },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => {
      const d = row.original.startedAt;
      return (
        <TimeDate date={d} />
      );
    },
  },
  {
    accessorKey: "endedAt",
    header: "Ended",
    cell: ({ row }) => {
      const d = row.original.endedAt;
      return (
        <TimeDate date={d} />
      );
    },
  },
  {
    accessorKey: "durationMinutes",
    header: () => <div className="text-right">Duration</div>,
    cell: ({ row }) => (
      <div className="text-right">
        {row.original.durationMinutes != null
          ? row.original.durationMinutes.toFixed(0)
          : "-"} min
      </div>
    ),
  },
];

/* ------------------------------ Main Component ------------------------------ */
export function RecentSessionsTable({ sessions, onSessionClick }: RecentSessionsTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data: sessions,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>
          Last {sessions.length} sessions across all locations. Click a row to view details.
        </CardDescription>

        {/* Search input */}
        <div className="mt-4">
          <Input
            placeholder="Search sessions..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-[200px]"
          />
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* TABLE */}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
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
                   }[header.column.getIsSorted() as string] ?? <ChevronsUpDown className="h-4 w-4 opacity-50" />}
                 </div>
               </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSessionClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No sessions found.
                </TableCell>
              </TableRow>
            )}
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
  );
}
