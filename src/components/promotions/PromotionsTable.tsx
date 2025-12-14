// src/components/promotions/PromotionsTable.tsx

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Promotion {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  locationId?: string;
  priorityWeight?: number;
  qrPayload?: string;
  redemptionCode?: string;
  redemptionType?: string;
  termsAndConditions?: string;
  validFrom?: Date;
  validTo?: Date;
}

interface PromotionsTableProps {
  promotions: Promotion[];
  onEdit?: (promotion: Promotion) => void;
  getLocationName: (id?: string) => string;
  canEdit?: boolean;
}

function formatDate(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------- Table Columns ------------------------------- */
const createColumns = (
  getLocationName: (id?: string) => string,
  canEdit: boolean,
  onEdit?: (promotion: Promotion) => void
): ColumnDef<Promotion>[] => {
  const columns: ColumnDef<Promotion>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.title}</span>
      ),
    },
    {
      accessorKey: "locationId",
      header: "Location",
      cell: ({ row }) => getLocationName(row.original.locationId),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "priorityWeight",
      header: () => <div className="text-right">Priority</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.priorityWeight ?? "-"}
        </div>
      ),
    },
    {
      accessorKey: "validFrom",
      header: "Valid from",
      cell: ({ row }) => formatDate(row.original.validFrom),
    },
    {
      accessorKey: "validTo",
      header: "Valid to",
      cell: ({ row }) => formatDate(row.original.validTo),
    },
  ];

  if (canEdit && onEdit) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row.original);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    });
  }

  return columns;
};

/* ------------------------------ Main Component ------------------------------ */
export function PromotionsTable({
  promotions,
  onEdit,
  getLocationName,
  canEdit = false,
}: PromotionsTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = createColumns(getLocationName, canEdit, onEdit);

  const table = useReactTable({
    data: promotions,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Promotions</CardTitle>
            <CardDescription>
              {promotions.length === 0
                ? "No promotions found."
                : `${promotions.length} promotion${promotions.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>

          {/* Search input */}
          {promotions.length > 0 && (
            <Input
              placeholder="Search promotions..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-[240px]"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
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
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {
                        {
                          asc: <ChevronUp className="h-4 w-4" />,
                          desc: <ChevronDown className="h-4 w-4" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        )
                      }
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
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
                  className="text-center py-8 text-muted-foreground"
                >
                  {globalFilter
                    ? "No promotions match your search."
                    : "No promotions found for this filter."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* PAGINATION FOOTER */}
        {table.getPageCount() > 1 && (
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
                  {[10, 20, 50, 100].map((size) => (
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
                Page{" "}
                <strong>{table.getState().pagination.pageIndex + 1}</strong> of{" "}
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
        )}
      </CardContent>
    </Card>
  );
}