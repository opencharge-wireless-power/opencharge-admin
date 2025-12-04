// src/pages/UnitDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import type { Unit } from "../types/Opencharge"; // adjust path if needed

// ----- helpers -----
function tsToDate(value: any): Date | undefined {
  return value && typeof value.toDate === "function"
    ? value.toDate()
    : undefined;
}

function numOrUndefined(v: any): number | undefined {
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
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
}

interface InteractionRow {
  id: string;
  time?: Date;
  type?: string;
  mode?: string;
  deviceType?: string;
}

// ----- component -----
export function UnitDetailPage() {
  // route param MUST match App.tsx: /units/:id
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
          position: metrics.position as string | undefined,
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

    // No orderBy here – just filter by device and limit,
    // then sort client-side.
    const q = query(
      ref,
      where("id", "==", deviceId),
      limit(50)
    );

    const snap = await getDocs(q);

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
      };
    });

    // sort newest first by start date, then take top 10
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
    if (!deviceId || !unit?.particleDeviceId) {
      setInteractions([]);
      return;
    }

   try {
      setInteractionsLoading(true);
      setInteractionsError(null);

      const interactionsRef = collection(db, "interactions");

      // Get all interactions for this unit — no orderBy, so no index needed
      const q = query(interactionsRef, where("deviceId", "==", deviceId));
      const snap = await getDocs(q);

      const rows = snap.docs.map((docSnap) => {
        const data = docSnap.data() as DocumentData;

        let time: Date | undefined;
        const tsRaw = data.timestamp;

        // A) Firestore Timestamp
        if (tsRaw && typeof tsRaw.toDate === "function") {
          time = tsRaw.toDate();
        }
        // B) numeric milliseconds
        else if (typeof tsRaw === "number") {
          time = new Date(tsRaw);
        }
        // C) String like: "3 December 2025 at 16:00:53 UTC+2"
        else if (typeof tsRaw === "string") {
          const cleaned = tsRaw.replace(" at ", " ");
          const parsed = new Date(cleaned);
          if (!isNaN(parsed.getTime())) {
            time = parsed;
          }
        }

        // D) Fallback using dateISO + hourOfDay
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
          type: data.type,
          mode: data.mode,
          deviceType: data.deviceType,
        };
      });

      // Sort newest → oldest using JS
      rows.sort((a, b) => {
        const ta = a.time?.getTime() ?? 0;
        const tb = b.time?.getTime() ?? 0;
        return tb - ta;
      });

      // Only keep the latest 10
      setInteractions(rows.slice(0, 10));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load interactions";
      setInteractionsError(msg);
    } finally {
      setInteractionsLoading(false);
    }
  };

    void loadSessions();
    void loadInteractions();
  }, [unit?.particleDeviceId]);

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
                  <TableCell>Mode</TableCell>
                  <TableCell>Device type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Duration (min)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDateTime(s.start)}</TableCell>
                    <TableCell>{formatDateTime(s.end)}</TableCell>
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
                    <TableCell colSpan={6}>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {interactions.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{formatDateTime(i.time)}</TableCell>
                    <TableCell>{i.type ?? "—"}</TableCell>
                    <TableCell>{i.mode ?? "—"}</TableCell>
                    <TableCell>{i.deviceType ?? "—"}</TableCell>
                  </TableRow>
                ))}

                {interactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
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
    </MainLayout>
  );
}