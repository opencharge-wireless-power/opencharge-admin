// src/pages/UnitDetailPage.tsx
import { useEffect, useState } from "react";
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
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Grid,
  Stack,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Button,
  Drawer,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import type { Unit } from "../types/Opencharge";

// ----- helpers -----
function tsToDate(value: any): Date | undefined {
  return value && typeof value.toDate === "function"
    ? value.toDate()
    : undefined;
}

function numOrUndefined(v: any): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
}

function dateFromMs(value: any): Date | undefined {
  return typeof value === "number" && value > 0
    ? new Date(value)
    : undefined;
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

  // app-level fields stored on the chargesessions doc
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

  // app-level fields on the interaction
  appLinked?: boolean;
  appBatteryStartLevel?: number;
  appDeviceMake?: string;
  appDeviceModel?: string;
  appSource?: string;
  appDeviceIdHash?: string;
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
    if (drawerLoading) return;
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

          health: health as any,
          metrics: metrics as any,
          interactions: data.interactions as any,

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
          time: dateFromMs(data.timestampMs) ?? dateFromMs(data.startTimestampMs),
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

  // ---- helpers to render "App" chip in tables ----
  function renderSessionAppCell(s: SessionRow) {
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
      delta != null
        ? `App (${delta > 0 ? "+" : ""}${delta}% )`
        : "App";

    return <Chip label={label} size="small" color="primary" />;
  }

  function renderInteractionAppCell(i: InteractionRow) {
    const hasApp =
      i.appLinked ||
      i.appDeviceMake ||
      i.appDeviceModel ||
      i.appBatteryStartLevel != null ||
      i.appSource ||
      i.appDeviceIdHash;

    if (!hasApp) return "—";

    return <Chip label="App" size="small" color="primary" />;
  }

  // ---------- simple guards ----------
  if (!id) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Unit
          </Typography>
          <Typography color="error">No unit ID</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (loadingUnit) {
    return (
      <MainLayout>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (unitError || !unit) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Unit
          </Typography>
          <Typography color="error">
            {unitError ?? "Unit not found"}
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  // ---------- drawer render helpers ----------
  const renderSessionDrawer = (session: SessionRow) => {
    const hasApp =
      session.appLinked ||
      session.appBatteryDelta != null ||
      session.appDeviceMake ||
      session.appDeviceModel;

    const startLevel = session.appBatteryStartLevel;
    const endLevel = session.appBatteryEndLevel;
    const delta =
      session.appBatteryDelta ??
      (startLevel != null && endLevel != null
        ? endLevel - startLevel
        : undefined);

    return (
      <Box sx={{ p: 3, width: "100%", boxSizing: "border-box" }}>
        <Typography variant="h6" gutterBottom>
          Session details
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Summary card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Summary
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body1">
                    {session.status ?? "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Started
                  </Typography>
                  <Typography variant="body1">
                    {formatDateTime(session.start)}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Ended
                  </Typography>
                  <Typography variant="body1">
                    {formatDateTime(session.end)}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography variant="body1">
                    {session.durationMinutes != null
                      ? `${session.durationMinutes.toFixed(0)} min`
                      : "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Mode / device
                  </Typography>
                  <Typography variant="body1">
                    {(session.mode ?? "—") +
                      " · " +
                      (session.deviceType ?? "—")}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* App summary card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  App summary
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    App linked
                  </Typography>
                  <Typography variant="body1">
                    {session.appLinked ? "Yes" : "No"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Device
                  </Typography>
                  <Typography variant="body1">
                    {session.appDeviceMake || session.appDeviceModel
                      ? `${session.appDeviceMake ?? ""}${
                          session.appDeviceMake && session.appDeviceModel
                            ? " "
                            : ""
                        }${session.appDeviceModel ?? ""}`
                      : "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    App location
                  </Typography>
                  <Typography variant="body1">
                    {session.appLocationId ?? "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Battery change
                  </Typography>
                  <Typography variant="body1">
                    {startLevel != null && endLevel != null ? (
                      <>
                        {startLevel}% → {endLevel}%{" "}
                        {delta != null && `(${delta > 0 ? "+" : ""}${delta}%)`}
                      </>
                    ) : delta != null ? (
                      `${delta > 0 ? "+" : ""}${delta}%`
                    ) : (
                      "—"
                    )}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          App charging events
        </Typography>

        {drawerLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
            <CircularProgress size={20} />
          </Box>
        )}

        {drawerError && (
          <Typography color="error" sx={{ mb: 1 }}>
            {drawerError}
          </Typography>
        )}

        {!drawerLoading && !drawerError && !hasApp && sessionAppEvents.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No app data recorded for this session.
          </Typography>
        )}

        {!drawerLoading && !drawerError && sessionAppEvents.length > 0 && (
          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              mt: 1,
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
                </TableRow>
              </TableHead>
              <TableBody>
                {sessionAppEvents.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDateTime(e.time)}</TableCell>
                    <TableCell>
                      {e.batteryLevel != null ? `${e.batteryLevel}%` : "—"}
                      {e.batteryDelta != null &&
                        ` (${e.batteryDelta > 0 ? "+" : ""}${
                          e.batteryDelta
                        }%)`}
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
          </TableContainer>
        )}
      </Box>
    );
  };

  const renderInteractionDrawer = (interaction: InteractionRow) => (
    <Box sx={{ p: 3, width: "100%", boxSizing: "border-box" }}>
      <Typography variant="h6" gutterBottom>
        Interaction details
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Summary
              </Typography>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Time
                </Typography>
                <Typography variant="body1">
                  {formatDateTime(interaction.time)}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Type
                </Typography>
                <Typography variant="body1">
                  {interaction.type ?? "—"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Mode / device
                </Typography>
                <Typography variant="body1">
                  {(interaction.mode ?? "—") +
                    " · " +
                    (interaction.deviceType ?? "—")}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                App details
              </Typography>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  App linked
                </Typography>
                <Typography variant="body1">
                  {interaction.appLinked ? "Yes" : "No"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Device
                </Typography>
                <Typography variant="body1">
                  {interaction.appDeviceMake || interaction.appDeviceModel
                    ? `${interaction.appDeviceMake ?? ""}${
                        interaction.appDeviceMake && interaction.appDeviceModel
                          ? " "
                          : ""
                      }${interaction.appDeviceModel ?? ""}`
                    : "—"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  App battery level
                </Typography>
                <Typography variant="body1">
                  {interaction.appBatteryStartLevel != null
                    ? `${interaction.appBatteryStartLevel}%`
                    : "—"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  App source
                </Typography>
                <Typography variant="body1">
                  {interaction.appSource ?? "—"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Device hash
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
                >
                  {interaction.appDeviceIdHash ?? "—"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // ---------- main UI ----------
  return (
    <MainLayout>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            startIcon={<ArrowBackIcon />}
            size="small"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Typography variant="h4">{unit.name}</Typography>
          {unit.status && (
            <Chip
              label={unit.status}
              size="small"
              color={
                unit.status === "online"
                  ? "success"
                  : unit.status === "offline"
                  ? "default"
                  : "warning"
              }
            />
          )}
          {unit.inUse && <Chip label="In use" size="small" color="info" />}
          {unit.needsMaintenance && (
            <Chip label="Needs maintenance" size="small" color="warning" />
          )}
        </Stack>

        {unit.locationId && (
          <Chip label={unit.locationId} variant="outlined" />
        )}
      </Box>

      {/* Info cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Summary */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Location
                </Typography>
                <Typography variant="body1">
                  {unit.locationId ?? "—"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Position
                </Typography>
                <Typography variant="body1">
                  {unit.position ?? "—"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Particle device ID
                </Typography>
                <Typography variant="body1">
                  {unit.particleDeviceId ?? "—"}
                </Typography>
              </Box>

              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Current mode
                </Typography>
                <Typography variant="body1">
                  {unit.currentMode ?? "—"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Current device type
                </Typography>
                <Typography variant="body1">
                  {unit.currentDeviceType ?? "—"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Health */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Health
              </Typography>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body1">
                  {unit.healthStatus ?? "—"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Needs maintenance
                </Typography>
                <Typography variant="body1">
                  {unit.needsMaintenance ? "Yes" : "No"}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Last calculated
                </Typography>
                <Typography variant="body1">
                  {formatDate(
                    tsToDate((unit.metrics as any)?.calculatedAt)
                  )}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent activity */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent activity
              </Typography>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Last heartbeat
                </Typography>
                <Typography variant="body1">
                  {formatDateTime(unit.lastHeartbeat)}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Last interaction
                </Typography>
                <Typography variant="body1">
                  {formatDateTime(unit.lastInteraction)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(unit.lastInteractionType ?? "—") +
                    " · " +
                    (unit.lastInteractionMode ?? "—") +
                    " · " +
                    (unit.lastInteractionDeviceType ?? "—")}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last session
                </Typography>
                <Typography variant="body1">
                  {formatDateTime(unit.lastSessionTimestamp)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(unit.lastSessionDuration != null
                    ? `${unit.lastSessionDuration.toFixed(0)} min`
                    : "—") +
                    " · " +
                    (unit.lastSessionMode ?? "—") +
                    " · " +
                    (unit.lastSessionDeviceType ?? "—")}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Metrics */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Metrics
              </Typography>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total interactions
                </Typography>
                <Typography variant="h4">
                  {unit.totalInteractions ?? "—"}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total sessions
                </Typography>
                <Typography variant="h4">
                  {unit.totalSessions ?? "—"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Last 10 sessions */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Last 10 sessions
        </Typography>

        {sessionsLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {sessionsError && (
          <Typography color="error" sx={{ mb: 1 }}>
            {sessionsError}
          </Typography>
        )}

        {!sessionsLoading && !sessionsError && (
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
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>App</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Device type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Duration (min)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow
                    key={s.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => handleSessionRowClick(s)}
                  >
                    <TableCell>{formatDateTime(s.start)}</TableCell>
                    <TableCell>{formatDateTime(s.end)}</TableCell>
                    <TableCell>{renderSessionAppCell(s)}</TableCell>
                    <TableCell>{s.mode ?? "—"}</TableCell>
                    <TableCell>{s.deviceType ?? "—"}</TableCell>
                    <TableCell>{s.status ?? "—"}</TableCell>
                    <TableCell align="right">
                      {s.durationMinutes != null
                        ? s.durationMinutes.toFixed(0)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}

                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography
                        align="center"
                        variant="body2"
                        sx={{ py: 2 }}
                        color="text.secondary"
                      >
                        No sessions found for this unit.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Last 10 interactions */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Last 10 interactions
        </Typography>

        {interactionsLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {interactionsError && (
          <Typography color="error" sx={{ mb: 1 }}>
            {interactionsError}
          </Typography>
        )}

        {!interactionsLoading && !interactionsError && (
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
                  <TableCell>Time</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Device type</TableCell>
                  <TableCell>App</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {interactions.map((i) => (
                  <TableRow
                    key={i.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => handleInteractionRowClick(i)}
                  >
                    <TableCell>{formatDateTime(i.time)}</TableCell>
                    <TableCell>{i.type ?? "—"}</TableCell>
                    <TableCell>{i.mode ?? "—"}</TableCell>
                    <TableCell>{i.deviceType ?? "—"}</TableCell>
                    <TableCell>{renderInteractionAppCell(i)}</TableCell>
                  </TableRow>
                ))}

                {interactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography
                        align="center"
                        variant="body2"
                        sx={{ py: 2 }}
                        color="text.secondary"
                      >
                        No interactions recorded yet for this unit.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Right-hand details drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 520, md: 640, lg: 720 } },
        }}
      >
        {selectedSession && renderSessionDrawer(selectedSession)}
        {!selectedSession &&
          selectedInteraction &&
          renderInteractionDrawer(selectedInteraction)}
      </Drawer>
    </MainLayout>
  );
}