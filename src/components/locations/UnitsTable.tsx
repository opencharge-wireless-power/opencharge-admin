// src/components/locations/UnitsTable.tsx

import { Fragment } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatDateTime, formatPercent } from "@/utils/Format";
import type { Unit } from "@/types/Opencharge";

interface UnitsTableProps {
  units: Unit[];
  loading?: boolean;
  error?: string | null;
  canEdit?: boolean;
  onAddUnit?: () => void;
  onEditUnit?: (unit: Unit) => void;
  onUnitClick?: (unitId: string) => void;
}

interface GroupedUnits {
  position: string;
  units: Unit[];
}

function groupUnitsByPosition(units: Unit[]): GroupedUnits[] {
  const grouped = new Map<string, Unit[]>();

  units.forEach((unit) => {
    const pos = unit.position || "Unspecified";
    if (!grouped.has(pos)) {
      grouped.set(pos, []);
    }
    grouped.get(pos)!.push(unit);
  });

  return Array.from(grouped.entries())
    .map(([position, units]) => ({ position, units }))
    .sort((a, b) => a.position.localeCompare(b.position));
}

export function UnitsTable({
  units,
  loading = false,
  error = null,
  canEdit = false,
  onAddUnit,
  onEditUnit,
  onUnitClick,
}: UnitsTableProps) {
  const groupedUnits = groupUnitsByPosition(units);
  const headerColSpan = canEdit ? 8 : 7;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Units at this location</CardTitle>
          {canEdit && onAddUnit && (
            <Button size="sm" onClick={onAddUnit}>
              Add unit
            </Button>
          )}
        </div>
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
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last heartbeat</TableHead>
                <TableHead>Last interaction</TableHead>
                <TableHead>Last session</TableHead>
                <TableHead className="text-right">Success / Fault</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>

            <TableBody>
              {groupedUnits.map((group) => (
                <Fragment key={group.position}>
                  {/* Group header */}
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={headerColSpan}>
                      <span className="text-sm font-medium">
                        {group.position}
                      </span>
                    </TableCell>
                  </TableRow>

                  {/* Units in this group */}
                  {group.units.map((unit) => {
                    const healthStatus = unit.health?.status ?? "unknown";
                    const healthNeedsMaintenance =
                      unit.health?.needsMaintenance ?? false;

                    return (
                      <TableRow
                        key={unit.id}
                        className={onUnitClick ? "cursor-pointer" : ""}
                        onClick={() => onUnitClick?.(unit.id)}
                      >
                        {/* Unit name + device type */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{unit.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {unit.currentDeviceType ?? "-"}
                              {unit.currentMode ? ` · ${unit.currentMode}` : ""}
                            </p>
                          </div>
                        </TableCell>

                        {/* Status / in use */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {unit.status && (
                              <Badge
                                variant={
                                  unit.status === "online"
                                    ? "default"
                                    : unit.status === "offline"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="w-fit"
                              >
                                {unit.status}
                              </Badge>
                            )}
                            {unit.inUse && (
                              <Badge variant="outline" className="w-fit">
                                In use
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Health */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={
                                healthStatus === "healthy"
                                  ? "default"
                                  : healthStatus === "degraded"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="w-fit"
                            >
                              {healthStatus}
                            </Badge>
                            {healthNeedsMaintenance && (
                              <Badge variant="destructive" className="w-fit">
                                Needs maintenance
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Last heartbeat */}
                        <TableCell>
                          <p className="text-sm">
                            {formatDateTime(unit.lastHeartbeat)}
                          </p>
                        </TableCell>

                        {/* Last interaction */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm">
                              {formatDateTime(unit.lastInteraction)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {unit.lastInteractionType ?? "-"}
                            </p>
                          </div>
                        </TableCell>

                        {/* Last session */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm">
                              {formatDateTime(unit.lastSessionTimestamp)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {unit.lastSessionDuration != null
                                ? `${unit.lastSessionDuration.toFixed(0)} min`
                                : "-"}
                            </p>
                          </div>
                        </TableCell>

                        {/* Success / Fault rates */}
                        <TableCell className="text-right">
                          <div className="space-y-0.5">
                            <p className="text-sm">
                              {formatPercent(unit.metrics?.successRate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPercent(unit.metrics?.faultRate)}
                            </p>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditUnit?.(unit);
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}

              {groupedUnits.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={headerColSpan}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No units found for this location.
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
