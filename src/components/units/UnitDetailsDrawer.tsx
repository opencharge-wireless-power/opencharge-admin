// src/components/units/UnitDetailsDrawer.tsx

import { PulseLoader } from "@/components/common/loading/pulse-loader";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
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
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface AppChargingEventRow {
  id: string;
  time?: Date;
  batteryLevel?: number;
  batteryDelta?: number;
  isWireless?: boolean;
  pluggedType?: string;
  deviceMake?: string;
  deviceModel?: string;
  locationId?: string;
}

interface UnitDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSession?: SessionRow | null;
  selectedInteraction?: InteractionRow | null;
  sessionAppEvents?: AppChargingEventRow[];
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

function InfoItem({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </span>
    </div>
  );
}



function SessionDetails({
  session,
  appEvents,
  loading,
  error,
}: {
  session: SessionRow;
  appEvents: AppChargingEventRow[];
  loading: boolean;
  error: string | null;
}) {
  const startLevel = session.appBatteryStartLevel;
  const endLevel = session.appBatteryEndLevel;
  const delta =
    session.appBatteryDelta ??
    (startLevel != null && endLevel != null ? endLevel - startLevel : undefined);

  const hasApp =
    session.appLinked ||
    session.appBatteryDelta != null ||
    session.appDeviceMake ||
    session.appDeviceModel;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoItem label="Status" value={session.status ?? "—"} />
            <InfoItem label="Started" value={formatDateTime(session.start)} />
            <InfoItem label="Ended" value={formatDateTime(session.end)} />
            <InfoItem
              label="Duration"
              value={
                session.durationMinutes != null
                  ? `${session.durationMinutes.toFixed(0)} min`
                  : "—"
              }
            />
            <InfoItem
              label="Mode / device"
              value={`${session.mode ?? "—"} · ${session.deviceType ?? "—"}`}
            />
          </CardContent>
        </Card>

        {/* App Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">App summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoItem
              label="App linked"
              value={session.appLinked ? "Yes" : "No"}
            />
            <InfoItem
              label="Device"
              value={
                session.appDeviceMake || session.appDeviceModel
                  ? `${session.appDeviceMake ?? ""}${
                      session.appDeviceMake && session.appDeviceModel ? " " : ""
                    }${session.appDeviceModel ?? ""}`
                  : "—"
              }
            />
            <InfoItem
              label="App location"
              value={session.appLocationId ?? "—"}
            />
            <InfoItem
              label="Battery change"
              value={
                startLevel != null && endLevel != null ? (
                  <>
                    {startLevel}% → {endLevel}%{" "}
                    {delta != null && `(${delta > 0 ? "+" : ""}${delta}%)`}
                  </>
                ) : delta != null ? (
                  `${delta > 0 ? "+" : ""}${delta}%`
                ) : (
                  "—"
                )
              }
            />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold mb-4">App charging events</h3>

        {loading && (
          <div className="flex justify-center py-8">
            <PulseLoader size={8} pulseCount={4} speed={1.5} />
          </div>
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {!loading &&
          !error &&
          !hasApp &&
          appEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No app data recorded for this session.
            </p>
          )}

        {!loading && !error && appEvents.length > 0 && (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Wireless</TableHead>
                  <TableHead>Plugged type</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Location (app)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appEvents.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDateTime(e.time)}</TableCell>
                    <TableCell>
                      {e.batteryLevel != null ? `${e.batteryLevel}%` : "—"}
                      {e.batteryDelta != null &&
                        ` (${e.batteryDelta > 0 ? "+" : ""}${e.batteryDelta}%)`}
                    </TableCell>
                    <TableCell>{e.isWireless ? "Yes" : "No"}</TableCell>
                    <TableCell>{e.pluggedType ?? "—"}</TableCell>
                    <TableCell>
                      {e.deviceMake || e.deviceModel
                        ? `${e.deviceMake ?? ""}${
                            e.deviceMake && e.deviceModel ? " " : ""
                          }${e.deviceModel ?? ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>{e.locationId ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function InteractionDetails({
  interaction,
}: {
  interaction: InteractionRow;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoItem label="Time" value={formatDateTime(interaction.time)} />
          <InfoItem label="Type" value={interaction.type ?? "—"} />
          <InfoItem
            label="Mode / device"
            value={`${interaction.mode ?? "—"} · ${
              interaction.deviceType ?? "—"
            }`}
          />
        </CardContent>
      </Card>

      {/* App Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">App details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoItem
            label="App linked"
            value={interaction.appLinked ? "Yes" : "No"}
          />
          <InfoItem
            label="Device"
            value={
              interaction.appDeviceMake || interaction.appDeviceModel
                ? `${interaction.appDeviceMake ?? ""}${
                    interaction.appDeviceMake && interaction.appDeviceModel
                      ? " "
                      : ""
                  }${interaction.appDeviceModel ?? ""}`
                : "—"
            }
          />
          <InfoItem
            label="App battery level"
            value={
              interaction.appBatteryStartLevel != null
                ? `${interaction.appBatteryStartLevel}%`
                : "—"
            }
          />
          <InfoItem label="App source" value={interaction.appSource ?? "—"} />
          <InfoItem
            label="Device hash"
            value={interaction.appDeviceIdHash ?? "—"}
            mono
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function UnitDetailsDrawer({
  open,
  onOpenChange,
  selectedSession,
  selectedInteraction,
  sessionAppEvents = [],
  loading = false,
  error = null,
}: UnitDetailsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="space-y-4 w-full sm:w-[800px]" >
        <SheetHeader>
          <SheetTitle>
            {selectedSession ? "Session details" : "Interaction details"}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-6"> 
            <div className="mt-6">
            {selectedSession && (
                <SessionDetails
                session={selectedSession}
                appEvents={sessionAppEvents}
                loading={loading}
                error={error}
                />
            )}

            {selectedInteraction && !selectedSession && (
                <InteractionDetails interaction={selectedInteraction} />
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