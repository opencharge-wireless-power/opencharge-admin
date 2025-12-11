// src/components/dashboard/RecentSessionsTable.tsx
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
  
  export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
    return (
      <Card className="shadow-none border-gray-200  text-gray-800">
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>
            Last 10 sessions across all locations (from chargesessions)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead className="text-right">Duration (min)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.locationName ?? session.locationId ?? "-"}
                    </TableCell>
                    <TableCell>
                      {session.unitName ?? session.unitId ?? "-"}
                    </TableCell>
                    <TableCell>
                      {session.status ? (
                        <Badge
                          variant={
                            session.status === "completed" ? "default" : "secondary"
                          }
                          className={
                            session.status === "completed"
                              ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100"
                              : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100"
                          }
                        >
                          {session.status === "completed"
                            ? "Completed"
                            : "In Progress"}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(session.startedAt)}</TableCell>
                    <TableCell>{formatDateTime(session.endedAt)}</TableCell>
                    <TableCell className="text-right">
                      {typeof session.durationMinutes === "number"
                        ? session.durationMinutes.toFixed(0)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No sessions found yet.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }