// src/pages/AllSessionsPage.tsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import {
  Activity,
  CheckCircle2,
  Clock,
  MapPin,
  Smartphone,
} from "lucide-react";

import { db } from "../firebase";
import { PageHeader } from "../components/layout/PageHeader";
import { OverviewCards } from "@/components/common/cards/overview-card";


import { PulseLoader } from "@/components/common/loading/pulse-loader";


import { SessionDetailsSheet, type AppChargingEvent } from "@/components/sessions/SessionDetailsSheet";
import { RecentSessionsTable } from "@/components/sessions/RecentSessionsTable";
import { TopLocationsChart } from "@/components/sessions/TopLocationsChart";
import { DeviceMixChart } from "@/components/sessions/DeviceMixChart";
import { Sessions } from "@/components/icons/Icons";


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

  // From the mobile app (stored on the session doc)
  appLinked?: boolean;
  appBatteryDelta?: number; // % change during the session
  appBatteryStartLevel?: number;
  appBatteryEndLevel?: number;
  appDeviceMake?: string;
  appDeviceModel?: string;
  appLocationId?: string;
}

interface TopLocation {
  locationId?: string;
  locationName: string;
  sessions: number;
  totalDurationMinutes: number;
}

interface DeviceMixItem {
  deviceType: string;
  sessions: number;
  share: number; // %
}


function formatMinutesAsHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 h";
  const hours = minutes / 60;
  if (hours < 1) {
    return `${minutes.toFixed(0)} min`;
  }
  return `${hours.toFixed(1)} h`;
}

export function AllSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TODO: Check why sessions state is not used  - changed to _sessions for ESLint
  const [_sessions, setSessions] = useState<SessionItem[]>([]);


  // KPIs
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionsLast7Days, setSessionsLast7Days] = useState(0);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [avgDurationLast7, setAvgDurationLast7] = useState<number | null>(
    null
  );
  const [totalDurationLast7, setTotalDurationLast7] = useState(0);
  const [activeLocationsLast7, setActiveLocationsLast7] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);

  // Success metrics
  const [successSessionsLast7, setSuccessSessionsLast7] = useState(0);
  const [failedSessionsLast7, setFailedSessionsLast7] = useState(0);
  const [successRateLast7, setSuccessRateLast7] = useState<number | null>(
    null
  );

  // App metrics
  const [appSessionsLast7, setAppSessionsLast7] = useState(0);
  const [avgAppBatteryDeltaLast7, setAvgAppBatteryDeltaLast7] =
    useState<number | null>(null);

  // Tables
  const [topLocations, setTopLocations] = useState<TopLocation[]>([]);
  const [deviceMix, setDeviceMix] = useState<DeviceMixItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionItem[]>([]);

  // Selected session + appChargingEvents detail (for side drawer)
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(
    null
  );
  const [appEvents, setAppEvents] = useState<AppChargingEvent[]>([]);
  const [appEventsLoading, setAppEventsLoading] = useState(false);
  const [appEventsError, setAppEventsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // ----- Locations -----
        const locationsSnap = await getDocs(collection(db, "locations"));
        setTotalLocations(locationsSnap.size);

        const locationsById = new Map<string, { name: string }>();
        locationsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          locationsById.set(docSnap.id, {
            name: (data.name as string | undefined) ?? "Unnamed location",
          });
        });

        // ----- Units -----
        const unitsSnap = await getDocs(collection(db, "units"));
        const unitsById = new Map<
          string,
          { name: string; locationId?: string }
        >();
        unitsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          unitsById.set(docSnap.id, {
            name:
              (data.metrics?.name as string | undefined) ??
              (data.name as string | undefined) ??
              "Unit",
            locationId: data.locationId as string | undefined,
          });
        });

        // ----- Sessions (chargesessions) -----
        const sessionsSnap = await getDocs(collection(db, "chargesessions"));
        setTotalSessions(sessionsSnap.size);

        const now = new Date();
        const sevenDaysAgo = new Date(
          now.getTime() - 7 * 24 * 60 * 60 * 1000
        );
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0
        );

        const rawSessions: SessionItem[] = [];

        let last7Count = 0;
        let todayCount = 0;
        let durationSumLast7 = 0;
        let durationCountLast7 = 0;
        const locationIdsLast7 = new Set<string>();

        const locationAgg = new Map<string, TopLocation>(); // key = locationIdOrName

        // Success metrics
        let successesLast7 = 0;
        let failuresLast7 = 0;
        const deviceAgg = new Map<string, number>();

        // App metrics
        let appSessionsLast7Local = 0;
        let appBatteryDeltaSum = 0;
        let appBatteryDeltaCount = 0;

        sessionsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const startRaw = data.start as Timestamp | null | undefined;
          const endRaw = data.end as Timestamp | null | undefined;

          const startedAt =
            startRaw && typeof startRaw.toDate === "function"
              ? startRaw.toDate()
              : undefined;
          const endedAt =
            endRaw && typeof endRaw.toDate === "function"
              ? endRaw.toDate()
              : undefined;

          const durationMinutes =
            typeof data.duration === "number"
              ? (data.duration as number)
              : undefined;

          const unitId = data.unitId as string | undefined;
          const unit = unitId ? unitsById.get(unitId) : undefined;
          const locationId = unit?.locationId;
          const location = locationId
            ? locationsById.get(locationId)
            : undefined;

          const locationName =
            location?.name ?? locationId ?? "Unknown location";

          const status: "completed" | "in_progress" | undefined = endedAt
            ? "completed"
            : "in_progress";

          // App fields on the session doc
          const rawAppBatteryDelta = data.appBatteryDelta;
          const hasAppInfo =
            data.appLinked === true ||
            rawAppBatteryDelta != null ||
            data.appDeviceMake != null ||
            data.appDeviceModel != null ||
            data.appLocationId != null;

          const appLinked = Boolean(data.appLinked) || hasAppInfo;

          const appBatteryDelta =
            typeof rawAppBatteryDelta === "number" &&
            !Number.isNaN(rawAppBatteryDelta)
              ? (rawAppBatteryDelta as number)
              : undefined;

          const appBatteryStartLevel =
            typeof data.appBatteryStartLevel === "number"
              ? (data.appBatteryStartLevel as number)
              : undefined;

          const appBatteryEndLevel =
            typeof data.appBatteryEndLevel === "number"
              ? (data.appBatteryEndLevel as number)
              : undefined;

          const session: SessionItem = {
            id: docSnap.id,
            locationId,
            locationName,
            unitId,
            unitName: unit?.name,
            status,
            startedAt,
            endedAt,
            durationMinutes,
            appLinked,
            appBatteryDelta,
            appBatteryStartLevel,
            appBatteryEndLevel,
            appDeviceMake: data.appDeviceMake as string | undefined,
            appDeviceModel: data.appDeviceModel as string | undefined,
            appLocationId: data.appLocationId as string | undefined,
          };

          rawSessions.push(session);

          // ------ Only aggregate "last 7 days" metrics if we have a start time ------
          if (startedAt && startedAt >= sevenDaysAgo) {
            last7Count++;

            if (
              typeof durationMinutes === "number" &&
              !Number.isNaN(durationMinutes)
            ) {
              durationSumLast7 += durationMinutes;
              durationCountLast7++;
            }

            if (locationId) {
              locationIdsLast7.add(locationId);
            }

            // Aggregate by location for "Top locations"
            const locKey = locationId ?? locationName;
            const existingLoc = locationAgg.get(locKey) ?? {
              locationId,
              locationName,
              sessions: 0,
              totalDurationMinutes: 0,
            };
            existingLoc.sessions += 1;
            if (
              typeof durationMinutes === "number" &&
              !Number.isNaN(durationMinutes)
            ) {
              existingLoc.totalDurationMinutes += durationMinutes;
            }
            locationAgg.set(locKey, existingLoc);

            // Success / failure detection
            const outcomeRaw = (
              data.outcome as string | undefined
            )?.toLowerCase();
            const statusRaw = (
              data.status as string | undefined
            )?.toLowerCase();
            const successFlag =
              outcomeRaw === "successful" ||
              outcomeRaw === "success" ||
              data.success === true ||
              statusRaw === "completed";
            const failureFlag =
              outcomeRaw === "failed" ||
              outcomeRaw === "error" ||
              outcomeRaw === "aborted" ||
              data.success === false ||
              statusRaw === "failed";

            if (successFlag) {
              successesLast7++;
            } else if (failureFlag) {
              failuresLast7++;
            }

            // Device mix
            const deviceType =
              (data.deviceType as string | undefined) ??
              (data.lastSessionDeviceType as string | undefined) ??
              "unknown";

            const currentDeviceCount = deviceAgg.get(deviceType) ?? 0;
            deviceAgg.set(deviceType, currentDeviceCount + 1);

            // App metrics (only for last 7 days)
            if (appLinked) {
              appSessionsLast7Local++;
              if (appBatteryDelta != null) {
                appBatteryDeltaSum += appBatteryDelta;
                appBatteryDeltaCount++;
              }
            }

            // Today counter
            if (startedAt >= todayStart) {
              todayCount++;
            }
          }
        });

        // sort sessions by time desc & keep recent 50
        rawSessions.sort((a, b) => {
          const ta = a.startedAt?.getTime() ?? 0;
          const tb = b.startedAt?.getTime() ?? 0;
          return tb - ta;
        });
        setSessions(rawSessions);
        setRecentSessions(rawSessions.slice(0, 50));

        // ---- basic KPIs ----
        setSessionsLast7Days(last7Count);
        setSessionsToday(todayCount);
        setTotalDurationLast7(durationSumLast7);
        setActiveLocationsLast7(locationIdsLast7.size);
        setAvgDurationLast7(
          durationCountLast7 > 0
            ? durationSumLast7 / durationCountLast7
            : null
        );

        // ---- success metrics ----
        const totalOutcomeSessions = successesLast7 + failuresLast7;
        setSuccessSessionsLast7(successesLast7);
        setFailedSessionsLast7(failuresLast7);
        setSuccessRateLast7(
          totalOutcomeSessions > 0
            ? (successesLast7 / totalOutcomeSessions) * 100
            : null
        );

        // ---- App metrics ----
        setAppSessionsLast7(appSessionsLast7Local);
        setAvgAppBatteryDeltaLast7(
          appBatteryDeltaCount > 0
            ? appBatteryDeltaSum / appBatteryDeltaCount
            : null
        );

        // ---- Top locations ----
        const topLocs = Array.from(locationAgg.values()).sort(
          (a, b) => b.sessions - a.sessions
        );
        setTopLocations(topLocs.slice(0, 5));

        // ---- Device mix ----
        const deviceArray: DeviceMixItem[] = Array.from(deviceAgg.entries())
          .map(([deviceType, count]) => ({
            deviceType,
            sessions: count,
            share: last7Count > 0 ? (count / last7Count) * 100 : 0,
          }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 5);
        setDeviceMix(deviceArray);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load sessions";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  // Load appChargingEvents lazily when a row is clicked
  const handleSessionClick = async (session: SessionItem) => {
    setSelectedSession(session);
    setAppEvents([]);
    setAppEventsError(null);

    try {
      setAppEventsLoading(true);

      const eventsRef = collection(
        db,
        "chargesessions",
        session.id,
        "appChargingEvents"
      );
      const snap = await getDocs(eventsRef);

      const rows: AppChargingEvent[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as DocumentData;

        const tsMs = data.timestampMs as number | undefined;
        const startTsMs = data.startTimestampMs as number | undefined;
        let timestamp: Date | undefined;
        if (typeof tsMs === "number") {
          timestamp = new Date(tsMs);
        } else if (typeof startTsMs === "number") {
          timestamp = new Date(startTsMs);
        }

        const batteryLevel =
          typeof data.batteryLevel === "number"
            ? (data.batteryLevel as number)
            : undefined;

        const startBatteryLevel =
          typeof data.startBatteryLevel === "number"
            ? (data.startBatteryLevel as number)
            : undefined;

        const batteryDelta =
          typeof data.batteryDelta === "number"
            ? (data.batteryDelta as number)
            : undefined;

        return {
          id: docSnap.id,
          timestamp,
          batteryLevel,
          startBatteryLevel,
          batteryDelta,
          isWireless: data.isWireless === true,
          pluggedType: data.pluggedType as string | undefined,
          deviceMake: data.deviceMake as string | undefined,
          deviceModel: data.deviceModel as string | undefined,
          locationId: data.locationId as string | undefined,
          source: data.source as string | undefined,
        };
      });

      rows.sort((a, b) => {
        const ta = a.timestamp?.getTime() ?? 0;
        const tb = b.timestamp?.getTime() ?? 0;
        return tb - ta;
      });

      setAppEvents(rows);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load app charging events";
      setAppEventsError(msg);
    } finally {
      setAppEventsLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedSession(null);
    setAppEvents([]);
    setAppEventsError(null);
  };

  if (loading) {
    return (
    <>
      <PageHeader
        title="Sessions"
        breadcrumbs={[{ label: "Sessions", href: "/sessions" }]}
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-2">
          {/* Pulsing circle */}
          <PulseLoader size={8} pulseCount={4} speed={1.5} />
        </div>
      </div>
    </>

    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Sessions"
          breadcrumbs={[{ label: "Sessions", href: "/sessions" }]}
        />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        breadcrumbs={[{ label: "Sessions", href: "/sessions" }]}
      />

      <div className="gap-4 p-4 pt-0 ">
        {/* Header section */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
              Usage and performance of all charging sessions across locations
              and units. Click a session to see app details when available.
            </p>
          </div>
        </div>

        {/* KPI cards - Row 1 */}
        <OverviewCards
          columns={4}
          stats={[
            {
              title: "Sessions (last 7 days)",
              value: sessionsLast7Days.toString(),
              subtitle: `${sessionsToday} today • Out of ${totalSessions} total sessions`,
              icon: Sessions,
            },
            {
              title: "Avg Duration (last 7 days)",
              value:
                avgDurationLast7 != null
                  ? `${avgDurationLast7.toFixed(1)} min`
                  : "–",
              subtitle: "Based on completed sessions",
              icon: Clock,
            },
            {
              title: "Total Charge Time (last 7 days)",
              value: formatMinutesAsHours(totalDurationLast7),
              subtitle: "Sum of all session durations",
              icon: Activity,
            },
            {
              title: "Active Locations (last 7 days)",
              value: activeLocationsLast7.toString(),
              subtitle: `Out of ${totalLocations} total locations`,
              icon: MapPin,
            },
          ]}
        />

        {/* KPI cards - Row 2 */}
        <OverviewCards
          columns={2}
          stats={[
            {
              title: "Session Success Rate (last 7 days)",
              value:
                successRateLast7 != null
                  ? `${successRateLast7.toFixed(1)}%`
                  : "–",
              subtitle: `${successSessionsLast7} successful • ${failedSessionsLast7} failed / errored`,
              icon: CheckCircle2,
            },
            {
              title: "App-linked Sessions (last 7 days)",
              value: appSessionsLast7.toString(),
              subtitle: `${
                sessionsLast7Days > 0
                  ? `${Math.round(
                      (appSessionsLast7 / sessionsLast7Days) * 100
                    )}% of sessions`
                  : "–"
              } • Avg battery delta: ${
                avgAppBatteryDeltaLast7 != null
                  ? `${avgAppBatteryDeltaLast7.toFixed(0)}%`
                  : "–"
              }`,
              icon: Smartphone,
            },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top locations chart */}
          <TopLocationsChart locations={topLocations} />

          {/* Device mix chart */}
          <DeviceMixChart devices={deviceMix} />
        </div>


        {/* Recent sessions table */}
        <RecentSessionsTable 
          sessions={recentSessions} 
          onSessionClick={handleSessionClick}
        />
      </div>

      {/* SIDE PANEL: selected session + app details */}
      <SessionDetailsSheet
        session={selectedSession}
        appEvents={appEvents}
        appEventsLoading={appEventsLoading}
        appEventsError={appEventsError}
        open={Boolean(selectedSession)}
        onOpenChange={handleCloseDrawer}
      />
    </>
  );
}