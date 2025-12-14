// src/components/units/InteractionsTable.tsx

import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
  } from "@tanstack/react-table";
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  import { Badge } from "@/components/ui/badge";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react";
  import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
  } from "@/components/ui/empty"
import { Sessions } from "../icons/Icons";
  
  interface InteractionRow {
    id: string;
    time?: Date;
    type?: string;
    mode?: string;
    deviceType?: string;
    appLinked?: boolean;
    appBatteryStartLevel?: number;
    appDeviceMake?: string;
    appDeviceModel?: string;
    appSource?: string;
    appDeviceIdHash?: string;
  }
  
  interface InteractionsTableProps {
    interactions: InteractionRow[];
    onInteractionClick?: (interaction: InteractionRow) => void;
    loading?: boolean;
    error?: string | null;
  }
  
  function formatDateTime(date?: Date): string {
    if (!date) return "—";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  
  function renderAppCell(i: InteractionRow) {
    const hasApp =
      i.appLinked ||
      i.appDeviceMake ||
      i.appDeviceModel ||
      i.appBatteryStartLevel != null ||
      i.appSource ||
      i.appDeviceIdHash;
  
    if (!hasApp) return "—";
  
    return (
      <Badge variant="default" className="font-normal">
        App
      </Badge>
    );
  }
  
  /* ------------------------------- Table Columns ------------------------------- */
  const columns: ColumnDef<InteractionRow>[] = [
    {
      accessorKey: "time",
      header: "Time",
      cell: ({ row }) => formatDateTime(row.original.time),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => row.original.type ?? "—",
    },
    {
      accessorKey: "mode",
      header: "Mode",
      cell: ({ row }) => row.original.mode ?? "—",
    },
    {
      accessorKey: "deviceType",
      header: "Device type",
      cell: ({ row }) => row.original.deviceType ?? "—",
    },
    {
      id: "app",
      header: "App",
      cell: ({ row }) => renderAppCell(row.original),
    },
  ];
  
  /* ------------------------------ Main Component ------------------------------ */
  export function InteractionsTable({
    interactions,
    onInteractionClick,
    loading = false,
    error = null,
  }: InteractionsTableProps) {
    const table = useReactTable({
      data: interactions,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
  
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Last 10 interactions</CardTitle>
        </CardHeader>
  
        <CardContent className="p-0">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
  
          {error && (
            <div className="px-6 py-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
  
          {!loading && !error && (
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
                      onClick={() => onInteractionClick?.(row.original)}
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
                      className="py-8"
                    >
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Sessions /> 
                          </EmptyMedia>
                          <EmptyTitle>Interactions</EmptyTitle>
                          <EmptyDescription>No interactions recorded yet for this unit.</EmptyDescription>
                        </EmptyHeader>
                  
                        <EmptyContent>
                         
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                  
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }