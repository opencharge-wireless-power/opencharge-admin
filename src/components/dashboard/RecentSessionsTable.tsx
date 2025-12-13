// src/components/dashboard/RecentSessionsTable.tsx
import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from "lucide-react";

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
}

interface RecentSessionsTableProps {
  sessions: SessionItem[];
}

function formatDateTime(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.status ? (
        <Badge
          variant={row.original.status === "completed" ? "default" : "secondary"}
          className={
            row.original.status === "completed"
              ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100"
              : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100"
          }
        >
          {row.original.status === "completed" ? "Completed" : "In Progress"}
        </Badge>
      ) : (
        "-"
      ),
  },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => formatDateTime(row.original.startedAt),
  },
  {
    accessorKey: "endedAt",
    header: "Ended",
    cell: ({ row }) => formatDateTime(row.original.endedAt),
  },
  {
    accessorKey: "durationMinutes",
    header: () => <div className="text-right">Duration (min)</div>,
    cell: ({ row }) => (
      <div className="text-right">
        {typeof row.original.durationMinutes === "number"
          ? row.original.durationMinutes.toFixed(0)
          : "-"}
      </div>
    ),
  },
];

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  const table = useReactTable({
    data: sessions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="shadow-none border-gray-200 text-gray-800">
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
        <CardDescription>
          Last 10 sessions across all locations (from chargesessions)
        </CardDescription>
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No sessions found yet.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* PAGINATION FOOTER */}
        <div className="flex items-center justify-between px-4 py-4 border-t">
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
