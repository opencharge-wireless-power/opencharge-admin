

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from "lucide-react";

import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  } from "@/components/ui/select";

import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { TimeDate } from "@/components/common/times/time-date";

interface MyColumnMeta {
  align?: "left" | "right" | "center";
  
}


export interface UnitDetail {
  id: string;
  name: string;
  locationId?: string;
  position?: string;
  status?: "online" | "offline" | "warning";
  healthStatus?: string;
  needsMaintenance: boolean;
  inUse: boolean;
  lastHeartbeat?: Date;
  lastSessionDuration?: number;
}

interface UnitsDetailsTableProps {
  units: UnitDetail[];
}


export function UnitsDetailsTable({ units }: UnitsDetailsTableProps) {
  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = useState("");

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
          const status = info.getValue<UnitDetail["status"]>();
          if (!status) return "—";
          const variant =
            status === "online"
              ? "default"
              : status === "offline"
              ? "secondary"
              : "destructive";
          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      {
        accessorKey: "healthStatus",
        header: "Health",
        cell: (info) => {
          const row = info.row.original;
          if (row.needsMaintenance) {
            return <Badge variant="destructive">{row.healthStatus ?? "Needs maintenance"}</Badge>;
          }
          if (row.healthStatus) {
            return (
              <Badge variant={row.healthStatus === "warning" ? "destructive" : "secondary"}>
                {row.healthStatus}
              </Badge>
            );
          }
          return "—";
        },
      },
      {
        accessorKey: "inUse",
        header: "In Use",
        cell: (info) =>
          info.getValue() ? <Badge variant="default">In use</Badge> : <Badge variant="outline">Idle</Badge>,
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
              
              <span className="text-sm ">
                {info.getValue<UnitDetail["lastSessionDuration"]>()?.toFixed(0) ?? "—"} min
              </span>
            </div>
        ),
          
        meta: { align: "right" } as MyColumnMeta,
      },
    ],
    []
  );

  const table = useReactTable({
    data: units,
    columns,
    state: { globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Units Details</CardTitle>
        <Input
          placeholder="Search units..."
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
                      }[header.column.getIsSorted() as string] ?? <ChevronsUpDown className="h-4 w-4 opacity-50" />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <p className="text-muted-foreground">No units match the current filters.</p>
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
                const meta = cell.column.columnDef.meta as MyColumnMeta;
            
                return (
                  <TableCell
                    key={cell.id}
                    className={meta?.align === "right" ? "text-right" : ""}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
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
  );
}
