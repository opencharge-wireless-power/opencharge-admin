// src/pages/UnitsListPage.tsx
import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  type DocumentData,
} from "firebase/firestore";
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Grid,
} from "@mui/material";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import type { Unit } from "../types/Opencharge"; 

type StatusFilter = "all" | "online" | "offline" | "warning";

// Unit used in the list: base Unit + a few convenience fields
type ListUnit = Unit & {
  locationId?: string;
  healthStatus?: string;
  needsMaintenance: boolean;
};

// small helper for Firestore timestamps / nulls
function tsToDate(value: any): Date | undefined {
  return value && typeof value.toDate === "function"
    ? value.toDate()
    : undefined;
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

export function UnitsListPage() {
  const navigate = useNavigate();

  const [units, setUnits] = useState<ListUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [inUseOnly, setInUseOnly] = useState<boolean>(false);
  const [maintenanceOnly, setMaintenanceOnly] = useState<boolean>(false);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setLoading(true);
        setError(null);

        const snap = await getDocs(collection(db, "units"));

        const items: ListUnit[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const metrics = (data.metrics as DocumentData | undefined) ?? {};
          const health = (data.health as DocumentData | undefined) ?? {};

          const status =
            (metrics.status as string | undefined) ??
            (data.status as string | undefined);

          const healthStatus = health.status as string | undefined;

          const positionField =
                (metrics.position as string | undefined) ??
                (data.position as string | undefined) ??
                undefined;

          const lastHeartbeat = tsToDate(data.lastHeartbeat);
          const lastInteraction = tsToDate(data.lastInteraction);
          const lastSessionTimestamp = tsToDate(data.lastSessionTimestamp);

          const lastSessionDuration =
            typeof data.lastSessionDuration === "number"
              ? (data.lastSessionDuration as number)
              : undefined;

          const totalSessions =
            typeof data.totalSessions === "number"
              ? (data.totalSessions as number)
              : typeof metrics.totalSessions === "number"
              ? (metrics.totalSessions as number)
              : undefined;

          const totalInteractions =
            typeof data.totalInteractions === "number"
              ? (data.totalInteractions as number)
              : typeof metrics.totalInteractions === "number"
              ? (metrics.totalInteractions as number)
              : undefined;

          const particleDeviceId =
            (metrics.particleDeviceId as string | undefined) ??
            (data.particleDeviceId as string | undefined);

          const base: ListUnit = {
            id: docSnap.id,
            name:
              (metrics.name as string | undefined) ??
              (data.name as string | undefined) ??
              docSnap.id,
            position: positionField,
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

            // list-specific extras
            locationId: data.locationId as string | undefined,
            healthStatus,
            needsMaintenance:
              (health.needsMaintenance as boolean | undefined) ?? false,
          };

          return base;
        });

        // sort by location then name
        items.sort((a, b) => {
          const la = a.locationId ?? "";
          const lb = b.locationId ?? "";
          if (la !== lb) return la.localeCompare(lb);
          return a.name.localeCompare(b.name);
        });

        setUnits(items);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load units";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void fetchUnits();
  }, []);

  // ---------- KPI stats ----------
  const totalUnits = units.length;
  const onlineCount = units.filter((u) => u.status === "online").length;
  const offlineCount = units.filter((u) => u.status === "offline").length;
  const warningCount = units.filter(
    (u) => u.healthStatus === "warning" || u.status === "warning"
  ).length;
  const inUseCount = units.filter((u) => u.inUse).length;
  const maintenanceCount = units.filter((u) => u.needsMaintenance).length;

  // distinct locations
  const locationOptions: string[] = Array.from(
    new Set(
      units
        .map((u) => u.locationId)
        .filter((id): id is string => !!id)
    )
  ).sort((a, b) => a.localeCompare(b));

  // filters
  const filteredUnits = units.filter((u) => {
    if (locationFilter !== "all") {
      if (!u.locationId || u.locationId !== locationFilter) return false;
    }

    if (statusFilter !== "all") {
      if (statusFilter === "warning") {
        if (u.healthStatus !== "warning" && u.status !== "warning") return false;
      } else {
        if (u.status !== statusFilter) return false;
      }
    }

    if (inUseOnly && !u.inUse) return false;
    if (maintenanceOnly && !u.needsMaintenance) return false;

    return true;
  });

  const handleLocationChange = (e: ChangeEvent<{ value: unknown }>) => {
    setLocationFilter(e.target.value as string);
  };

  const handleStatusChange = (e: ChangeEvent<{ value: unknown }>) => {
    setStatusFilter(e.target.value as StatusFilter);
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
            Units
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
          Units
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Monitor all charging units, filter by location, status and health, and
          drill into a unit for full details.
        </Typography>
      </Box>

      {/* KPI cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
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
              Units
            </Typography>
            <Typography variant="h4">{totalUnits}</Typography>
            <Typography variant="caption" color="text.secondary">
              Total deployed
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
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
              Online
            </Typography>
            <Typography variant="h4">{onlineCount}</Typography>
            <Typography variant="caption" color="text.secondary">
              Reporting as online
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
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
              Offline
            </Typography>
            <Typography variant="h4">{offlineCount}</Typography>
            <Typography variant="caption" color="text.secondary">
              Not currently online
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
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
              Warning / degraded
            </Typography>
            <Typography variant="h4">{warningCount}</Typography>
            <Typography variant="caption" color="text.secondary">
              Health status warning
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
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
              In use
            </Typography>
            <Typography variant="h4">{inUseCount}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Currently charging
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {maintenanceCount} need maintenance
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="location-filter-label">Location</InputLabel>
            <Select
              labelId="location-filter-label"
              label="Location"
              value={locationFilter}
              onChange={handleLocationChange as any}
            >
              <MenuItem value="all">All locations</MenuItem>
              {locationOptions.map((loc) => (
                <MenuItem key={loc} value={loc}>
                  {loc}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={handleStatusChange as any}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="online">Online</MenuItem>
              <MenuItem value="offline">Offline</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Stack direction="row" spacing={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={inUseOnly}
                onChange={(e) => setInUseOnly(e.target.checked)}
                size="small"
              />
            }
            label="In use only"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={maintenanceOnly}
                onChange={(e) => setMaintenanceOnly(e.target.checked)}
                size="small"
              />
            }
            label="Needs maintenance only"
          />
        </Stack>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Unit</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Health</TableCell>
              <TableCell>In use</TableCell>
              <TableCell>Last heartbeat</TableCell>
              <TableCell align="right">Last session (min)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUnits.map((u) => (
              <TableRow
                key={u.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/units/${u.id}`)}
              >
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.locationId ?? "—"}</TableCell>
                <TableCell>{u.position ?? "—"}</TableCell>
                <TableCell>
                  {u.status ? (
                    <Chip
                      label={u.status}
                      size="small"
                      color={
                        u.status === "online"
                          ? "success"
                          : u.status === "offline"
                          ? "default"
                          : "warning"
                      }
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {u.needsMaintenance ? (
                    <Chip
                      label={u.healthStatus ?? "Needs maintenance"}
                      size="small"
                      color="warning"
                    />
                  ) : u.healthStatus ? (
                    <Chip
                      label={u.healthStatus}
                      size="small"
                      color={
                        u.healthStatus === "warning" ? "warning" : "default"
                      }
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {u.inUse ? (
                    <Chip label="In use" size="small" color="info" />
                  ) : (
                    <Chip label="Idle" size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>{formatDateTime(u.lastHeartbeat)}</TableCell>
                <TableCell align="right">
                  {u.lastSessionDuration != null
                    ? u.lastSessionDuration.toFixed(0)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}

            {filteredUnits.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography
                    align="center"
                    variant="body2"
                    sx={{ py: 2 }}
                    color="text.secondary"
                  >
                    No units match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </MainLayout>
  );
}