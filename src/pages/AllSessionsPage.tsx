// src/pages/AllSessionsPage.tsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  type DocumentData,
} from "firebase/firestore";
import {
  Box,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Drawer,
  IconButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";

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

interface AppChargingEvent {
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

  const [sessions, setSessions] = useState<SessionItem[]>([]);

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

          const startRaw = data.start as any;
          const endRaw = data.end as any;

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
      <MainLayout>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Sessions
          </Typography>
          <Typography color="error">{error}</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Sessions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Usage and performance of all charging sessions across locations and
          units. Click a session to see app details when available.
        </Typography>
      </Box>

      {/* KPI cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Sessions last 7 days */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Sessions (last 7 days)
            </Typography>
            <Typography variant="h4">{sessionsLast7Days}</Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {sessionsToday} today
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Out of {totalSessions} total sessions
            </Typography>
          </Paper>
        </Grid>

        {/* Avg duration */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Avg duration (last 7 days)
            </Typography>
            <Typography variant="h4">
              {avgDurationLast7 != null
                ? `${avgDurationLast7.toFixed(1)} min`
                : "–"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Based on completed sessions
            </Typography>
          </Paper>
        </Grid>

        {/* Total charge time */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Total charge time (last 7 days)
            </Typography>
            <Typography variant="h4">
              {formatMinutesAsHours(totalDurationLast7)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sum of all session durations
            </Typography>
          </Paper>
        </Grid>

        {/* Active locations */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Active locations (last 7 days)
            </Typography>
            <Typography variant="h4">{activeLocationsLast7}</Typography>
            <Typography variant="caption" color="text.secondary">
              Out of {totalLocations} total locations
            </Typography>
          </Paper>
        </Grid>

        {/* Success rate card */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              mt: { xs: 0, md: 2 },
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Session success rate (last 7 days)
            </Typography>
            <Typography variant="h4">
              {successRateLast7 != null
                ? `${successRateLast7.toFixed(1)}%`
                : "–"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {successSessionsLast7} successful
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {failedSessionsLast7} failed / errored
            </Typography>
          </Paper>
        </Grid>

        {/* App-linked sessions */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              mt: { xs: 0, md: 2 },
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              App-linked sessions (last 7 days)
            </Typography>
            <Typography variant="h4">{appSessionsLast7}</Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {sessionsLast7Days > 0
                ? `${Math.round(
                    (appSessionsLast7 / sessionsLast7Days) * 100
                  )}% of sessions`
                : "–"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Avg battery delta:{" "}
              {avgAppBatteryDeltaLast7 != null
                ? `${avgAppBatteryDeltaLast7.toFixed(0)}%`
                : "–"}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Top locations table */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Top 5 locations by sessions (last 7 days)
        </Typography>

        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell align="right">Sessions</TableCell>
                <TableCell align="right">Total charge time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topLocations.map((loc) => (
                <TableRow key={loc.locationId ?? loc.locationName}>
                  <TableCell>{loc.locationName}</TableCell>
                  <TableCell align="right">{loc.sessions}</TableCell>
                  <TableCell align="right">
                    {formatMinutesAsHours(loc.totalDurationMinutes)}
                  </TableCell>
                </TableRow>
              ))}

              {topLocations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography
                      align="center"
                      variant="body2"
                      sx={{ py: 2 }}
                      color="text.secondary"
                    >
                      No sessions recorded in the last 7 days.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Device mix table */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Device mix (last 7 days)
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          Top device types seen in sessions over the last week.
        </Typography>

        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Device type</TableCell>
                <TableCell align="right">Sessions</TableCell>
                <TableCell align="right">% of sessions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deviceMix.map((d) => (
                <TableRow key={d.deviceType}>
                  <TableCell>{d.deviceType}</TableCell>
                  <TableCell align="right">{d.sessions}</TableCell>
                  <TableCell align="right">
                    {d.share.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}

              {deviceMix.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography
                      align="center"
                      variant="body2"
                      sx={{ py: 2 }}
                      color="text.secondary"
                    >
                      No device data available for the last 7 days.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Recent sessions table */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent sessions
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          Last {recentSessions.length} sessions across all locations. Click a
          row to view app details if available.
        </Typography>

        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>App</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Ended</TableCell>
                <TableCell align="right">Duration (min)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentSessions.map((s) => (
                <TableRow
                  key={s.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => {
                    void handleSessionClick(s);
                  }}
                >
                  <TableCell>
                    <Typography variant="body2">
                      {s.locationName ?? s.locationId ?? "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {s.unitName ?? s.unitId ?? "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {s.appLinked ? (
                      <Chip
                        size="small"
                        color="info"
                        label={
                          s.appBatteryDelta != null
                            ? `App (${s.appBatteryDelta.toFixed(0)}%)`
                            : "App"
                        }
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {s.status ? (
                      <Chip
                        label={
                          s.status === "completed"
                            ? "Completed"
                            : "In progress"
                        }
                        size="small"
                        color={
                          s.status === "completed" ? "success" : "info"
                        }
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(s.startedAt)}</TableCell>
                  <TableCell>{formatDateTime(s.endedAt)}</TableCell>
                  <TableCell align="right">
                    {s.durationMinutes != null
                      ? s.durationMinutes.toFixed(0)
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}

              {recentSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography align="center" sx={{ py: 2 }}>
                      No sessions found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* SIDE PANEL: selected session + app details */}
      <Drawer
        anchor="right"
        open={Boolean(selectedSession)}
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 500, md: 650, lg: 720 } },
        }}
      >
        {selectedSession && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Session details
                </Typography>
                <Typography variant="h6">
                  {selectedSession.unitName ??
                    selectedSession.unitId ??
                    selectedSession.id}
                </Typography>
              </Box>
              <IconButton
                onClick={handleCloseDrawer}
                size="small"
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            {/* Content */}
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                px: 2,
                py: 2,
              }}
            >
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {/* Summary */}
                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="subtitle1" gutterBottom>
                      Summary
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Location
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {selectedSession.locationName ??
                        selectedSession.locationId ??
                        "–"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Unit
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {selectedSession.unitName ??
                        selectedSession.unitId ??
                        "–"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Status
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {selectedSession.status ?? "–"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Started
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {formatDateTime(selectedSession.startedAt)}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Ended
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {formatDateTime(selectedSession.endedAt)}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {selectedSession.durationMinutes != null
                        ? `${selectedSession.durationMinutes.toFixed(
                            0
                          )} min`
                        : "–"}
                    </Typography>
                  </Paper>
                </Grid>

                {/* App summary */}
                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="subtitle1" gutterBottom>
                      App summary
                    </Typography>

                    {!selectedSession.appLinked ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        No app data recorded for this session.
                      </Typography>
                    ) : (
                      <>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Device
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          {(selectedSession.appDeviceMake ?? "Unknown") +
                            " " +
                            (selectedSession.appDeviceModel ?? "")}
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          App location
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          {selectedSession.appLocationId ?? "–"}
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Battery change
                        </Typography>
                        <Typography variant="body1">
                          {selectedSession.appBatteryStartLevel != null &&
                          selectedSession.appBatteryEndLevel != null &&
                          selectedSession.appBatteryDelta != null
                            ? `${selectedSession.appBatteryStartLevel}% → ${
                                selectedSession.appBatteryEndLevel
                              }% (${selectedSession.appBatteryDelta.toFixed(
                                0
                              )}%)`
                            : selectedSession.appBatteryDelta != null
                            ? `${selectedSession.appBatteryDelta.toFixed(
                                0
                              )}%`
                            : "–"}
                        </Typography>
                      </>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              {/* App charging events table */}
              <Typography variant="subtitle1" gutterBottom>
                App charging events
              </Typography>

              {appEventsLoading && (
                <Box
                  sx={{ display: "flex", justifyContent: "center", my: 2 }}
                >
                  <CircularProgress size={24} />
                </Box>
              )}

              {appEventsError && (
                <Typography color="error" sx={{ mb: 1 }}>
                  {appEventsError}
                </Typography>
              )}

              {!appEventsLoading && !appEventsError && (
                <TableContainer
                  component={Paper}
                  sx={{
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    mb: 2,
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Battery</TableCell>
                        <TableCell>Wireless</TableCell>
                        <TableCell>Plugged type</TableCell>
                        <TableCell>Device</TableCell>
                        <TableCell>Location (app)</TableCell>
                        <TableCell>Source</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {appEvents.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDateTime(e.timestamp)}</TableCell>
                          <TableCell>
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
                          <TableCell>
                            {e.isWireless != null
                              ? e.isWireless
                                ? "Yes"
                                : "No"
                              : "–"}
                          </TableCell>
                          <TableCell>{e.pluggedType ?? "–"}</TableCell>
                          <TableCell>
                            {(e.deviceMake ?? "Unknown") +
                              " " +
                              (e.deviceModel ?? "")}
                          </TableCell>
                          <TableCell>{e.locationId ?? "–"}</TableCell>
                          <TableCell>{e.source ?? "–"}</TableCell>
                        </TableRow>
                      ))}

                      {appEvents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography
                              align="center"
                              variant="body2"
                              color="text.secondary"
                              sx={{ py: 2 }}
                            >
                              No app charging events logged for this session.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </MainLayout>
  );
}