// src/components/units/SessionsTable.tsx

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
  
  interface SessionRow {
    id: string;
    start?: Date;
    end?: Date;
    durationMinutes?: number;
    mode?: string;
    deviceType?: string;
    status?: string;
    appLinked?: boolean;
    appBatteryDelta?: number;
    appBatteryStartLevel?: number;
    appBatteryEndLevel?: number;
    appDeviceMake?: string;
    appDeviceModel?: string;
    appLocationId?: string;
  }
  
  interface SessionsTableProps {
    sessions: SessionRow[];
    onSessionClick?: (session: SessionRow) => void;
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
  
  function renderAppCell(s: SessionRow) {
    const start = s.appBatteryStartLevel;
    const end = s.appBatteryEndLevel;
    const delta =
      s.appBatteryDelta ??
      (start != null && end != null ? end - start : undefined);
  
    const hasApp =
      s.appLinked ||
      s.appDeviceMake ||
      s.appDeviceModel ||
      start != null ||
      end != null ||
      delta != null;
  
    if (!hasApp) return "—";
  
    const label =
      delta != null ? `App (${delta > 0 ? "+" : ""}${delta}%)` : "App";
  
    return (
      <Badge variant="default" className="font-normal">
        {label}
      </Badge>
    );
  }
  
  /* ------------------------------- Table Columns ------------------------------- */
  const columns: ColumnDef<SessionRow>[] = [
    {
      accessorKey: "start",
      header: "Start",
      cell: ({ row }) => formatDateTime(row.original.start),
    },
    {
      accessorKey: "end",
      header: "End",
      cell: ({ row }) => formatDateTime(row.original.end),
    },
    {
      id: "app",
      header: "App",
      cell: ({ row }) => renderAppCell(row.original),
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => row.original.status ?? "—",
    },
    {
      accessorKey: "durationMinutes",
      header: () => <div className="text-right">Duration (min)</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.durationMinutes != null
            ? row.original.durationMinutes.toFixed(0)
            : "—"}
        </div>
      ),
    },
  ];
  
  /* ------------------------------ Main Component ------------------------------ */
  export function SessionsTable({
    sessions,
    onSessionClick,
    loading = false,
    error = null,
  }: SessionsTableProps) {
    const table = useReactTable({
      data: sessions,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
  
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Last 10 sessions</CardTitle>
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
                      onClick={() => onSessionClick?.(row.original)}
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
                            <Sessions /> {/* Replace with your actual icon */}
                          </EmptyMedia>
                          <EmptyTitle>Sessions</EmptyTitle>
                          <EmptyDescription>No sessions found for this unit.</EmptyDescription>
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