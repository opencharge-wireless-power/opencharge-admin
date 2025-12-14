// src/components/sessions/SessionDetailsSheet.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
  } from "@/components/ui/sheet";
import { PulseLoader } from "@/components/common/loading/pulse-loader"
import { Button } from "@/components/ui/button";

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
  appLinked?: boolean;
  appBatteryDelta?: number;
  appBatteryStartLevel?: number;
  appBatteryEndLevel?: number;
  appDeviceMake?: string;
  appDeviceModel?: string;
  appLocationId?: string;
}

export interface AppChargingEvent {
  id: string;
  timestamp?: Date;
  batteryLevel?: number;
  startBatteryLevel?: number;
  batteryDelta?: number;
  isWireless?: boolean;
  pluggedType?: string;
  deviceMake?: string;
  deviceModel?: string;
  locationId?: string;
  source?: string;
}

interface SessionDetailsSheetProps {
  session: SessionItem | null;
  appEvents: AppChargingEvent[];
  appEventsLoading: boolean;
  appEventsError: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function SessionDetailsSheet({
  session,
  appEvents,
  appEventsLoading,
  appEventsError,
  open,
  onOpenChange,
}: SessionDetailsSheetProps) {
  if (!session) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="space-y-4 w-full sm:w-[800px]" >
        <SheetHeader>
          <SheetTitle>
            {session.unitName ?? session.unitId ?? session.id}
          </SheetTitle>
          <SheetDescription>Session details</SheetDescription>
        </SheetHeader>
    
        <SheetBody className="space-y-6">   
         {/* Summary */}
          <Card className="shadow-none bg-accent">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Location (full row) */}
                <div className="col-span-1 md:col-span-2">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">
                    {session.locationName ?? session.locationId ?? "–"}
                    </p>
                </div>

                {/* Unit */}
                <div>
                    <p className="text-sm text-muted-foreground">Unit</p>
                    <p className="text-sm font-medium">
                    {session.unitName ?? session.unitId ?? "–"}
                    </p>
                </div>

                {/* Status */}
                <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-sm font-medium">{session.status ?? "–"}</p>
                </div>

                {/* Started */}
                <div>
                    <p className="text-sm text-muted-foreground">Started</p>
                    <p className="text-sm font-medium">
                    {formatDateTime(session.startedAt)}
                    </p>
                </div>

                {/* Ended */}
                <div>
                    <p className="text-sm text-muted-foreground">Ended</p>
                    <p className="text-sm font-medium">
                    {formatDateTime(session.endedAt)}
                    </p>
                </div>

                {/* Duration (full row or leave normal) */}
                <div className="col-span-1 md:col-span-2">
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">
                    {session.durationMinutes != null
                        ? `${session.durationMinutes.toFixed(0)} min`
                        : "–"}
                    </p>
                </div>
                </div>


            </CardContent>
          </Card>

          {/* App summary */}
          <Card className="shadow-none bg-accent">
            <CardHeader>
              <CardTitle className="text-base">App Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!session.appLinked ? (
                <p className="text-sm text-muted-foreground">
                  No app data recorded for this session.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Device</p>
                    <p className="text-sm font-medium">
                      {(session.appDeviceMake ?? "Unknown") +
                        " " +
                        (session.appDeviceModel ?? "")}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      App Location
                    </p>
                    <p className="text-sm font-medium">
                      {session.appLocationId ?? "–"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Battery Change
                    </p>
                    <p className="text-sm font-medium">
                      {session.appBatteryStartLevel != null &&
                      session.appBatteryEndLevel != null &&
                      session.appBatteryDelta != null
                        ? `${session.appBatteryStartLevel}% → ${
                            session.appBatteryEndLevel
                          }% (${session.appBatteryDelta.toFixed(0)}%)`
                        : session.appBatteryDelta != null
                        ? `${session.appBatteryDelta.toFixed(0)}%`
                        : "–"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <h3 className="text-base font-semibold mb-3">
              App Charging Events
            </h3>

            {appEventsLoading && (
              <div className="flex justify-center py-8">
                {/* Pulsing circle */}
                <PulseLoader size={8} pulseCount={4} speed={1.5} />
              </div>
            )}

            {appEventsError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                {appEventsError}
              </div>
            )}

            {!appEventsLoading && !appEventsError && (
              <Card className="shadow-none">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Battery</TableHead>
                        <TableHead>Wireless</TableHead>
                        <TableHead>Plugged</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appEvents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <p className="text-sm text-muted-foreground">
                              No app charging events logged for this session.
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        appEvents.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">
                              {formatDateTime(e.timestamp)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.startBatteryLevel != null ||
                              e.batteryLevel != null
                                ? `${e.startBatteryLevel ?? "?"}% → ${
                                    e.batteryLevel ?? "?"
                                  }%${
                                    e.batteryDelta != null
                                      ? ` (${e.batteryDelta.toFixed(0)}%)`
                                      : ""
                                  }`
                                : "–"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.isWireless != null
                                ? e.isWireless
                                  ? "Yes"
                                  : "No"
                                : "–"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.pluggedType ?? "–"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {(e.deviceMake ?? "Unknown") +
                                " " +
                                (e.deviceModel ?? "")}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.locationId ?? "–"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.source ?? "–"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

        </SheetBody>

        <SheetFooter className="flex justify-between">
            <SheetClose asChild>
              <Button
                variant="outline"
                onClick={() => open && onOpenChange(false)}
              >
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>

      </SheetContent>
    </Sheet>
  );
}