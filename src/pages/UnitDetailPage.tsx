// src/pages/UnitDetailPage.tsx
import { useEffect, useState } from "react";
import { Timestamp } from 'firebase/firestore';
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  type DocumentData,
} from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { PulseLoader } from "@/components/common/loading/pulse-loader";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

import { db } from "../firebase";
import type { Unit, UnitHealth, UnitMetrics, UnitInteractions } from "../types/Opencharge";

import { SessionsTable } from "@/components/units/SessionsTable";
import { InteractionsTable } from "@/components/units/InteractionsTable";
import { UnitDetailsDrawer } from "@/components/units/UnitDetailsDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ----- helpers -----

function tsToDate(value: Timestamp | null | undefined): Date | undefined {
  return value?.toDate();
}

function numOrUndefined(v: unknown): number | undefined {
  const num = Number(v);
  return !Number.isNaN(num) ? num : undefined;
}

function dateFromMs(value: unknown): Date | undefined {
  const ms = numOrUndefined(value);
  return ms && ms > 0 ? new Date(ms) : undefined;
}

function formatDate(date?: Date): string {
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

// ----- local types -----
interface UnitWithExtras extends Unit {
  locationId?: string;
  healthStatus?: string;
  needsMaintenance?: boolean;
}

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

function InfoItem({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}


// ----- component -----
export function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [unit, setUnit] = useState<UnitWithExtras | null>(null);
  const [loadingUnit, setLoadingUnit] = useState(true);
  const [unitError, setUnitError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [interactions, setInteractions] = useState<InteractionRow[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsError, setInteractionsError] = useState<string | null>(
    null
  );

  // Drawer state for details
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(
    null
  );
  const [selectedInteraction, setSelectedInteraction] =
    useState<InteractionRow | null>(null);
  const [sessionAppEvents, setSessionAppEvents] = useState<
    AppChargingEventRow[]
  >([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const drawerOpen = Boolean(selectedSession || selectedInteraction);

  const closeDrawer = () => {
    setSelectedSession(null);
    setSelectedInteraction(null);
    setSessionAppEvents([]);
    setDrawerError(null);
  };

  // -------- load unit ----------
  useEffect(() => {
    const loadUnit = async () => {
      if (!id) {
        setUnitError("No unit ID");
        setLoadingUnit(false);
        return;
      }

      try {
        setLoadingUnit(true);
        setUnitError(null);

        const ref = doc(db, "units", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setUnitError("Unit not found");
          setLoadingUnit(false);
          return;
        }

        const data = snap.data() as DocumentData;

        const metrics = (data.metrics as DocumentData | undefined) ?? {};
        const health = (data.health as DocumentData | undefined) ?? {};

        const status =
          (metrics.status as string | undefined) ??
          (data.status as string | undefined);

        const lastHeartbeat = tsToDate(data.lastHeartbeat);
        const lastInteraction = tsToDate(data.lastInteraction);
        const lastSessionTimestamp = tsToDate(data.lastSessionTimestamp);

        const lastSessionDuration = numOrUndefined(data.lastSessionDuration);

        const totalSessions =
          numOrUndefined(data.totalSessions) ??
          numOrUndefined(metrics.totalSessions);

        const totalInteractions =
          numOrUndefined(data.totalInteractions) ??
          numOrUndefined(metrics.totalInteractions);

        const particleDeviceId =
          (metrics.particleDeviceId as string | undefined) ??
          (data.particleDeviceId as string | undefined);

        const u: UnitWithExtras = {
          id: snap.id,
          name:
            (metrics.name as string | undefined) ??
            (data.name as string | undefined) ??
            snap.id,
          position:
            (metrics.position as string | undefined) ??
            (data.position as string | undefined),
          status,
          inUse: (data.inUse as boolean | undefined) ?? false,

          currentDeviceType: data.currentDeviceType as string | undefined,
          currentMode: data.currentMode as string | undefined,

          lastHeartbeat,
          lastInteraction,
          lastSessionTimestamp,

          lastInteractionType:
            (data.lastInteractionType as string | undefined) ??
            (metrics.lastInteractionType as string | undefined),
          lastInteractionMode:
            (data.lastInteractionMode as string | undefined) ??
            (metrics.lastInteractionMode as string | undefined),
          lastInteractionDeviceType:
            (data.lastInteractionDeviceType as string | undefined) ??
            (metrics.lastInteractionDeviceType as string | undefined),

          lastSessionDuration,
          lastSessionMode:
            (data.lastSessionMode as string | undefined) ??
            (metrics.lastSessionMode as string | undefined),
          lastSessionDeviceType:
            (data.lastSessionDeviceType as string | undefined) ??
            (metrics.lastSessionDeviceType as string | undefined),

          totalSessions,
          totalInteractions,
          particleDeviceId,
          
          health: health as UnitHealth, 
          metrics: metrics as UnitMetrics,
          interactions: data.interactions as UnitInteractions,

          locationId: data.locationId as string | undefined,
          healthStatus: health.status as string | undefined,
          needsMaintenance:
            (health.needsMaintenance as boolean | undefined) ?? false,
        };

        setUnit(u);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load unit";
        setUnitError(msg);
      } finally {
        setLoadingUnit(false);
      }
    };

    void loadUnit();
  }, [id]);

  // -------- load sessions & interactions once we know particleDeviceId ----------
  useEffect(() => {
    if (!unit?.particleDeviceId) {
      setSessions([]);
      setInteractions([]);
      return;
    }

    const deviceId = unit.particleDeviceId;

    const loadSessions = async () => {
      try {
        setSessionsLoading(true);
        setSessionsError(null);

        const ref = collection(db, "chargesessions");
        const qSessions = query(ref, where("id", "==", deviceId), limit(50));
        const snap = await getDocs(qSessions);

        const rows: SessionRow[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const start = tsToDate(data.start);
          const end = tsToDate(data.end);
          const durationMinutes = numOrUndefined(data.duration);

          return {
            id: docSnap.id,
            start,
            end,
            durationMinutes,
            mode: data.mode as string | undefined,
            deviceType: data.deviceType as string | undefined,
            status: end ? "completed" : "in_progress",

            appLinked: data.appLinked as boolean | undefined,
            appBatteryDelta: numOrUndefined(data.appBatteryDelta),
            appBatteryStartLevel: numOrUndefined(data.appBatteryStartLevel),
            appBatteryEndLevel: numOrUndefined(data.appBatteryEndLevel),
            appDeviceMake: data.appDeviceMake as string | undefined,
            appDeviceModel: data.appDeviceModel as string | undefined,
            appLocationId: data.appLocationId as string | undefined,
          };
        });

        rows.sort((a, b) => {
          const ta = a.start?.getTime() ?? 0;
          const tb = b.start?.getTime() ?? 0;
          return tb - ta;
        });

        setSessions(rows.slice(0, 10));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load sessions";
        setSessionsError(msg);
      } finally {
        setSessionsLoading(false);
      }
    };

    const loadInteractions = async () => {
      try {
        setInteractionsLoading(true);
        setInteractionsError(null);

        const interactionsRef = collection(db, "interactions");
        const qInteractions = query(
          interactionsRef,
          where("deviceId", "==", deviceId),
          limit(50)
        );
        const snap = await getDocs(qInteractions);

        const rows: InteractionRow[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          let time: Date | undefined;
          const tsRaw = data.timestamp;

          if (tsRaw && typeof tsRaw.toDate === "function") {
            time = tsRaw.toDate();
          } else if (typeof tsRaw === "number") {
            time = new Date(tsRaw);
          } else if (typeof tsRaw === "string") {
            const cleaned = tsRaw.replace(" at ", " ");
            const parsed = new Date(cleaned);
            if (!isNaN(parsed.getTime())) {
              time = parsed;
            }
          }

          if (!time) {
            const dateISO = data.dateISO;
            const hour = data.hourOfDay;
            if (dateISO && typeof hour === "number") {
              const h = hour.toString().padStart(2, "0");
              const fallback = new Date(`${dateISO}T${h}:00:00Z`);
              if (!isNaN(fallback.getTime())) {
                time = fallback;
              }
            }
          }

          return {
            id: docSnap.id,
            time,
            type: data.type as string | undefined,
            mode: data.mode as string | undefined,
            deviceType: data.deviceType as string | undefined,

            appLinked: data.appLinked as boolean | undefined,
            appBatteryStartLevel: numOrUndefined(data.appBatteryStartLevel),
            appDeviceMake: data.appDeviceMake as string | undefined,
            appDeviceModel: data.appDeviceModel as string | undefined,
            appSource: data.appSource as string | undefined,
            appDeviceIdHash: data.appDeviceIdHash as string | undefined,
          };
        });

        rows.sort((a, b) => {
          const ta = a.time?.getTime() ?? 0;
          const tb = b.time?.getTime() ?? 0;
          return tb - ta;
        });

        setInteractions(rows.slice(0, 10));
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load interactions";
        setInteractionsError(msg);
      } finally {
        setInteractionsLoading(false);
      }
    };

    void loadSessions();
    void loadInteractions();
  }, [unit?.particleDeviceId]);

  // -------- handlers to open drawer --------
  const handleSessionRowClick = async (session: SessionRow) => {
    setSelectedInteraction(null);
    setSelectedSession(session);
    setSessionAppEvents([]);
    setDrawerError(null);

    try {
      setDrawerLoading(true);
      const sessionRef = doc(db, "chargesessions", session.id);
      const eventsRef = collection(sessionRef, "appChargingEvents");
      const eventsSnap = await getDocs(eventsRef);

      const events: AppChargingEventRow[] = eventsSnap.docs.map((docSnap) => {
        const data = docSnap.data() as DocumentData;
        return {
          id: docSnap.id,
          time:
            dateFromMs(data.timestampMs) ?? dateFromMs(data.startTimestampMs),
          batteryLevel: numOrUndefined(data.batteryLevel),
          batteryDelta: numOrUndefined(data.batteryDelta),
          isWireless: data.isWireless as boolean | undefined,
          pluggedType: data.pluggedType as string | undefined,
          deviceMake: data.deviceMake as string | undefined,
          deviceModel: data.deviceModel as string | undefined,
          locationId: data.locationId as string | undefined,
        };
      });

      events.sort((a, b) => {
        const ta = a.time?.getTime() ?? 0;
        const tb = b.time?.getTime() ?? 0;
        return ta - tb;
      });

      setSessionAppEvents(events);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load app charging events";
      setDrawerError(msg);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleInteractionRowClick = (interaction: InteractionRow) => {
    setSelectedSession(null);
    setSessionAppEvents([]);
    setDrawerError(null);
    setSelectedInteraction(interaction);
  };

  // ---------- simple guards ----------
  if (!id) {
    return (
      <>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Unit</h1>
          <div className="rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">No unit ID</p>
          </div>
        </div>
      </>
    );
  }

  if (loadingUnit) {
    return (
      <>
        <div className="flex justify-center py-8">
          <PulseLoader size={8} pulseCount={4} speed={1.5} />
        </div>
      </>
    );
  }

  if (unitError || !unit) {
    return (
      <>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Unit</h1>
          <div className="rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {unitError ?? "Unit not found"}
            </p>
          </div>
        </div>
      </>
    );
  }

  // ---------- main UI ----------
  return (
    <>
    <PageHeader
      title="Unit"
      breadcrumbs={[
        { label: "Units", href: "/units" },
        { label: unit.name },
      ]}
    />

    

    
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{unit.name}</h1>
            {unit.status && (
              <Badge
                variant={
                  unit.status === "online"
                    ? "default"
                    : unit.status === "offline"
                    ? "secondary"
                    : "outline"
                }
              >
                {unit.status}
              </Badge>
            )}
            {unit.inUse && <Badge variant="outline">In use</Badge>}
            {unit.needsMaintenance && (
              <Badge variant="destructive">Needs maintenance</Badge>
            )}
          </div>

          {unit.locationId && <Badge variant="outline">{unit.locationId}</Badge>}
        </div>

        {/* Info cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Summary */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoItem label="Location" value={unit.locationId ?? "—"} />
              <InfoItem label="Position" value={unit.position ?? "—"} />
              <InfoItem
                label="Particle device ID"
                value={unit.particleDeviceId ?? "—"}
              />
              <InfoItem label="Current mode" value={unit.currentMode ?? "—"} />
              <InfoItem
                label="Current device type"
                value={unit.currentDeviceType ?? "—"}
              />
            </CardContent>
          </Card>

          {/* Health */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoItem label="Status" value={unit.healthStatus ?? "—"} />
              <InfoItem
                label="Needs maintenance"
                value={unit.needsMaintenance ? "Yes" : "No"}
              />
              <InfoItem
                label="Last calculated"
                value={formatDate(
                  tsToDate((unit.metrics as any)?.calculatedAt)
                )}
              />
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last heartbeat</p>
                <p className="text-sm">{formatDateTime(unit.lastHeartbeat)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Last interaction
                </p>
                <p className="text-sm">
                  {formatDateTime(unit.lastInteraction)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(unit.lastInteractionType ?? "—") +
                    " · " +
                    (unit.lastInteractionMode ?? "—") +
                    " · " +
                    (unit.lastInteractionDeviceType ?? "—")}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last session</p>
                <p className="text-sm">
                  {formatDateTime(unit.lastSessionTimestamp)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(unit.lastSessionDuration != null
                    ? `${unit.lastSessionDuration.toFixed(0)} min`
                    : "—") +
                    " · " +
                    (unit.lastSessionMode ?? "—") +
                    " · " +
                    (unit.lastSessionDeviceType ?? "—")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card className="shadow-none bg-accent border-0">
            <CardHeader>
              <CardTitle className="text-base">Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Total interactions
                </p>
                <p className="text-3xl font-bold">
                  {unit.totalInteractions ?? "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total sessions</p>
                <p className="text-3xl font-bold">
                  {unit.totalSessions ?? "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions Table */}
        <SessionsTable
          sessions={sessions}
          onSessionClick={handleSessionRowClick}
          loading={sessionsLoading}
          error={sessionsError}
        />

        {/* Interactions Table */}
        <InteractionsTable
          interactions={interactions}
          onInteractionClick={handleInteractionRowClick}
          loading={interactionsLoading}
          error={interactionsError}
        />

        {/* Details Drawer */}
        <UnitDetailsDrawer
          open={drawerOpen}
          onOpenChange={(open) => !open && closeDrawer()}
          selectedSession={selectedSession}
          selectedInteraction={selectedInteraction}
          sessionAppEvents={sessionAppEvents}
          loading={drawerLoading}
          error={drawerError}
        />
      </div>
    </>
  );
}