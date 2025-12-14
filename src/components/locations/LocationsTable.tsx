import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from "lucide-react";

interface LocationItem {
  id: string;
  name: string;
  brand?: string;
  storeLocation?: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  qrCode?: string;
  totalSessions?: number;
  unitInUse?: number;
  unitTotal?: number;
  active?: boolean;
  hasActivePromotions?: boolean;
}

interface LocationsTableProps {
  data: LocationItem[];
  onRowClick?: (id: string) => void;
}

export function LocationsTable({ data, onRowClick }: LocationsTableProps) {
  const columns = React.useMemo<ColumnDef<LocationItem>[]>(
    () => [
      {
        accessorKey: "brand",
        header: "Brand",
        cell: ({ getValue }) => getValue<string>() ?? "—",
      },
      {
        accessorKey: "storeLocation",
        header: "Store",
        cell: ({ getValue }) => getValue<string>() ?? "—",
      },
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ getValue }) => getValue<string>() ?? "—",
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => getValue<string>() ?? "—",
      },
      {
        accessorKey: "totalSessions",
        header: "Sessions",
        cell: ({ getValue }) => getValue<number>() ?? "—",
      },
      {
        id: "units",
        header: "Units",
        cell: ({ row }) => {
          const { unitInUse, unitTotal } = row.original;
          return unitTotal != null
            ? `${unitInUse ?? 0} / ${unitTotal}`
            : "—";
        },
      },
      {
        accessorKey: "qrCode",
        header: "QR code",
        cell: ({ getValue }) => (
          <span className="block max-w-[220px] truncate text-muted-foreground">
            {getValue<string>() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "active",
        header: "Active",
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="outline">Inactive</Badge>
          ),
      },
      {
        accessorKey: "hasActivePromotions",
        header: "Promotions",
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge variant="secondary">Has promos</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <Card className="overflow-hidden">
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
              <TableRow
                key={row.id}
                className={
                  onRowClick
                    ? "cursor-pointer hover:bg-muted/50"
                    : undefined
                }
                onClick={() => onRowClick?.(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                No locations yet. Click "New location" to add your first store.
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
    </Card>
  );
}
