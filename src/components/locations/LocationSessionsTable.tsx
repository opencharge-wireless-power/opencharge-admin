// src/components/locations/LocationSessionsTable.tsx

import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatDateTime,
  formatDurationMinutes,
} from "@/utils/Format";
import type { Session, DateFilter, Unit } from "@/types/Opencharge";

interface LocationSessionsTableProps {
  sessions: Session[];
  units: Unit[];
  loading?: boolean;
  error?: string | null;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  unitFilter: string;
  onUnitFilterChange: (unitId: string) => void;
  inProgressOnly: boolean;
  onInProgressOnlyChange: (checked: boolean) => void;
  onSessionClick?: (session: Session) => void;
}

export function LocationSessionsTable({
  sessions,
  units,
  loading = false,
  error = null,
  dateFilter,
  onDateFilterChange,
  unitFilter,
  onUnitFilterChange,
  inProgressOnly,
  onInProgressOnlyChange,
  onSessionClick,
}: LocationSessionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent sessions</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date filter */}
          <div className="space-y-2">
            <Label>Date range</Label>
            <ToggleGroup
              type="single"
              value={dateFilter}
              onValueChange={(value) =>
                value && onDateFilterChange(value as DateFilter)
              }
              className="justify-start"
            >
              <ToggleGroupItem value="all" size="sm">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="today" size="sm">
                Today
              </ToggleGroupItem>
              <ToggleGroupItem value="week" size="sm">
                This week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" size="sm">
                This month
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Unit filter */}
          <div className="space-y-2">
            <Label htmlFor="unit-filter">Unit</Label>
            <Select value={unitFilter} onValueChange={onUnitFilterChange}>
              <SelectTrigger id="unit-filter" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* In progress only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="in-progress"
              checked={inProgressOnly}
              onCheckedChange={onInProgressOnlyChange}
            />
            <Label
              htmlFor="in-progress"
              className="text-sm font-normal cursor-pointer"
            >
              In progress only
            </Label>
          </div>
        </div>

        {/* Table */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className={onSessionClick ? "cursor-pointer" : ""}
                    onClick={() => onSessionClick?.(session)}
                  >
                    <TableCell>
                      <span className="text-sm font-medium">
                        {session.unitName ?? session.unitId ?? "-"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">
                        {formatDateTime(session.startedAt)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">
                        {session.inProgress
                          ? "—"
                          : formatDateTime(session.endedAt)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">
                        {session.inProgress
                          ? "—"
                          : formatDurationMinutes(session.durationMinutes)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={session.inProgress ? "default" : "secondary"}
                      >
                        {session.inProgress ? "In progress" : "Completed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No sessions found with the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
