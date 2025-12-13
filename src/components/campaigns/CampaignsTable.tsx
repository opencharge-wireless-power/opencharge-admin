// src/components/campaigns/CampaignsTable.tsx

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

interface CampaignListItem {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  active: boolean;
  engagements: number;
  locationCount: number;
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
}

interface CampaignsTableProps {
  campaigns: CampaignListItem[];
  onCampaignClick: (campaign: CampaignListItem) => void;
  showBrandColumn?: boolean;
}

/* ------------------------------- Table Columns ------------------------------- */
const createColumns = (
  showBrandColumn: boolean
): ColumnDef<CampaignListItem>[] => {
  const columns: ColumnDef<CampaignListItem>[] = [];

  if (showBrandColumn) {
    columns.push({
      accessorKey: "brandName",
      header: "Brand",
      cell: ({ row }) => row.original.brandName,
    });
  }

  columns.push(
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "locationCount",
      header: () => <div className="text-right">Locations</div>,
      cell: ({ row }) => (
        <div className="text-right">{row.original.locationCount}</div>
      ),
    },
    {
      accessorKey: "engagements",
      header: () => <div className="text-right">Engagements</div>,
      cell: ({ row }) => (
        <div className="text-right">{row.original.engagements}</div>
      ),
    },
    {
      accessorKey: "targetUrl",
      header: "Target URL",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[260px] block">
          {row.original.targetUrl ?? row.original.url ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) =>
        row.original.createdAt
          ? row.original.createdAt.toLocaleDateString()
          : "—",
    }
  );

  return columns;
};

/* ------------------------------ Main Component ------------------------------ */
export function CampaignsTable({
  campaigns,
  onCampaignClick,
  showBrandColumn = true,
}: CampaignsTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = createColumns(showBrandColumn);

  const table = useReactTable({
    data: campaigns,
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
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>
              {campaigns.length === 0
                ? "No campaigns found."
                : `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>

          {/* Search input */}
          {campaigns.length > 0 && (
            <Input
              placeholder="Search campaigns..."
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onCampaignClick(row.original)}
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
                  className="text-center py-8 text-muted-foreground"
                >
                  {globalFilter
                    ? "No campaigns match your search."
                    : "No campaigns found."}
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