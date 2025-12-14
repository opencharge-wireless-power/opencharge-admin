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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { PulseLoader } from "@/components/common/loading/pulse-loader";


interface EngagementEvent {
    id: string;
    createdAt?: Date;
    deviceBrand?: string;
    deviceName?: string;
    deviceOS?: string;
    deviceType?: string;
    
  }



interface RecentEngagementsTableProps {
  events: EngagementEvent[];
  loading: boolean;
  error?: string;
}


/* ------------------------------- Table Columns ------------------------------- */
const createColumns = (): ColumnDef<EngagementEvent>[] => [
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }) => row.original.createdAt?.toLocaleString(),
  },
  { accessorKey: "deviceBrand", header: "Device brand", cell: ({ row }) => row.original.deviceBrand ?? "—" },
  { accessorKey: "deviceName", header: "Device name", cell: ({ row }) => row.original.deviceName ?? "—" },
  { accessorKey: "deviceOS", header: "OS", cell: ({ row }) => row.original.deviceOS ?? "—" },
  { accessorKey: "deviceType", header: "Type", cell: ({ row }) => row.original.deviceType ?? "—" },
];

/* ------------------------------ Main Component ------------------------------ */
export function RecentEngagementsTable({ events, loading, error }: RecentEngagementsTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const columns = createColumns();

  const table = useReactTable({
    data: events,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>Recent engagement events</CardTitle>
            <CardDescription>
              {error
                ? <span className="text-destructive">{error}</span>
                : events.length === 0 && !loading
                  ? "No engagement events recorded yet."
                  : `${events.length} event${events.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>

          {!error && events.length > 0 && (
            <Input
              placeholder="Search events..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-[240px]"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-6">
            <PulseLoader size={8} pulseCount={4} speed={1.5} />
          </div>
        ) : (
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
                  <TableRow key={row.id} className="hover:bg-muted/50">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                    {globalFilter ? "No events match your search." : "No engagement events recorded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        {events.length > 0 && !loading && (
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
                Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of <strong>{table.getPageCount()}</strong>
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
