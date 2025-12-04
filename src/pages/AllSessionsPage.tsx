// src/pages/AllSessionsPage.tsx
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import type { DocumentData, Timestamp } from "firebase/firestore";
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CloseIcon from "@mui/icons-material/Close";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";






// Shared types & helpers
import type {
  Session,
  UnitLookup,
  DateFilterSessions
} from "../types/Opencharge";

import {
  formatDateTime,
  formatDurationMinutes,
} from "../utils/Format";

export function AllSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterSessions>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [inProgressOnly, setInProgressOnly] = useState<boolean>(false);

  // Drawer
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch sessions across ALL locations (latest 200)
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Load all units so we can join sessions => units
        const unitsSnap = await getDocs(collection(db, "units"));

        const unitsById = new Map<string, UnitLookup>();
        const unitsByParticleId = new Map<string, UnitLookup>();

        unitsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const unit: UnitLookup = {
            id: docSnap.id,
            name: (data.name as string) ?? "Unit",
            locationId: data.locationId as string | undefined,
            particleDeviceId: data.particleDeviceId as string | undefined,
          };

          unitsById.set(unit.id, unit);
          if (unit.particleDeviceId) {
            unitsByParticleId.set(unit.particleDeviceId, unit);
          }
        });

        // 2) Load chargesessions (latest 200)
        const sessionsRef = collection(db, "chargesessions");
        const qSessions = query(
          sessionsRef,
          orderBy("start", "desc"),
          limit(200)
        );

        const snapshot = await getDocs(qSessions);

        const items: Session[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const startTs = data.start as Timestamp | undefined;
          const endTs = data.end as Timestamp | undefined;

          const startedAt = startTs ? startTs.toDate() : undefined;
          const endedAt = endTs ? endTs.toDate() : undefined;

          const durationMinutes =
            typeof data.duration === "number"
              ? (data.duration as number)
              : undefined;

          const inProgress = !endedAt;

          const particleDeviceId = data.id as string | undefined;
          const unitIdFromSession = data.unitId as string | undefined;

          // Try to resolve the unit:
          //  - first by unitId
          //  - then by particleDeviceId
          let unit: UnitLookup | undefined;
          if (unitIdFromSession && unitsById.has(unitIdFromSession)) {
            unit = unitsById.get(unitIdFromSession);
          } else if (
            particleDeviceId &&
            unitsByParticleId.has(particleDeviceId)
          ) {
            unit = unitsByParticleId.get(particleDeviceId);
          }

          return {
            id: docSnap.id,
            locationId: unit?.locationId,
            unitId: unitIdFromSession ?? unit?.id,
            unitName: unit?.name,
            particleDeviceId,
            deviceType: data.deviceType as string | undefined,
            mode: data.mode as string | undefined,
            startedAt,
            endedAt,
            durationMinutes,
            inProgress,
            raw: data,
          };
        });

        setSessions(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load sessions";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchSessions();
  }, []);

  // Distinct options
  const locationOptions: string[] = Array.from(
    new Set(
      sessions
        .map((s) => s.locationId)
        .filter((id): id is string => !!id)
    )
  ).sort((a, b) => a.localeCompare(b));

  const unitOptions: string[] = Array.from(
    new Set(
      sessions
        .map((s) => s.unitName ?? s.unitId)
        .filter((x): x is string => !!x)
    )
  ).sort((a, b) => a.localeCompare(b));

  // Apply filters in-memory
  const filteredSessions: Session[] = (() => {
    if (!sessions.length) return [];

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const last7 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
      0,
      0,
      0,
      0
    );
    const last30 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 30,
      0,
      0,
      0,
      0
    );

    return sessions.filter((s) => {
      // in-progress filter
      if (inProgressOnly && !s.inProgress) return false;

      // location filter
      if (locationFilter !== "all") {
        if (!s.locationId || s.locationId !== locationFilter) return false;
      }

      // unit filter
      if (unitFilter !== "all") {
        const nameOrId = s.unitName ?? s.unitId ?? "";
        if (nameOrId !== unitFilter) return false;
      }

      // date filter
      if (!s.startedAt) return false;

      if (dateFilter === "today") {
        return s.startedAt >= startOfToday;
      }

      if (dateFilter === "last7") {
        return s.startedAt >= last7;
      }

      if (dateFilter === "last30") {
        return s.startedAt >= last30;
      }

      // "all"
      return true;
    });
  })();

  const handleDateFilterChange = (
    _: React.MouseEvent<HTMLElement>,
    value: DateFilterSessions | null
  ) => {
    if (value) setDateFilter(value);
  };

  const handleLocationFilterChange = (e: ChangeEvent<{ value: unknown }>) => {
    setLocationFilter(e.target.value as string);
  };

  const handleUnitFilterChange = (e: ChangeEvent<{ value: unknown }>) => {
    setUnitFilter(e.target.value as string);
  };

  const openDetail = (session: Session) => {
    setSelectedSession(session);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
  };

  // RENDER
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
        <Typography variant="h4" gutterBottom>
          Sessions
        </Typography>
        <Typography color="error">{error}</Typography>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          All sessions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Latest 200 sessions across all locations (from chargesessions).
        </Typography>
      </Box>

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
        <ToggleButtonGroup
          size="small"
          value={dateFilter}
          exclusive
          onChange={handleDateFilterChange}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="last7">Last 7 days</ToggleButton>
          <ToggleButton value="last30">Last 30 days</ToggleButton>
        </ToggleButtonGroup>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="location-filter-label">Location</InputLabel>
            <Select
              labelId="location-filter-label"
              label="Location"
              value={locationFilter}
              onChange={handleLocationFilterChange as any}
            >
              <MenuItem value="all">All locations</MenuItem>
              {locationOptions.map((locId) => (
                <MenuItem key={locId} value={locId}>
                  {locId}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="unit-filter-label">Unit</InputLabel>
            <Select
              labelId="unit-filter-label"
              label="Unit"
              value={unitFilter}
              onChange={handleUnitFilterChange as any}
            >
              <MenuItem value="all">All units</MenuItem>
              {unitOptions.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={inProgressOnly}
                onChange={(e) => setInProgressOnly(e.target.checked)}
                size="small"
              />
            }
            label="In progress only"
          />
        </Stack>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell>Unit</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Ended</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSessions.map((s) => {
              const statusLabel = s.inProgress ? "In progress" : "Completed";

              let duration = s.durationMinutes;
              if (duration == null && s.startedAt && s.endedAt) {
                const diffMs = s.endedAt.getTime() - s.startedAt.getTime();
                duration = Math.round(diffMs / 60000);
              }

              const unitDisplay = s.unitName ?? s.unitId ?? "-";

              return (
                <TableRow
                  key={s.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => openDetail(s)}
                >
                  <TableCell>{s.locationId ?? "-"}</TableCell>
                  <TableCell>{unitDisplay}</TableCell>
                  <TableCell>{formatDateTime(s.startedAt)}</TableCell>
                  <TableCell>
                    {s.inProgress ? "—" : formatDateTime(s.endedAt)}
                  </TableCell>
                  <TableCell>
                    {s.inProgress ? "—" : formatDurationMinutes(duration)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusLabel}
                      color={s.inProgress ? "primary" : "default"}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredSessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography
                    align="center"
                    variant="body2"
                    sx={{ py: 1.5 }}
                  >
                    No sessions match the current filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Session detail drawer */}
      <Drawer anchor="right" open={detailOpen} onClose={closeDetail}>
        <Box
          sx={{
            width: 360,
            p: 2,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Typography variant="h6">Session details</Typography>
            <IconButton size="small" onClick={closeDetail}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {selectedSession ? (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Overview
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Session ID"
                    secondary={selectedSession.id}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Location ID"
                    secondary={selectedSession.locationId ?? "-"}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Unit"
                    secondary={
                      selectedSession.unitName ??
                      selectedSession.unitId ??
                      "-"
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Particle device ID"
                    secondary={selectedSession.particleDeviceId ?? "-"}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Device / Mode"
                    secondary={
                      selectedSession.deviceType || selectedSession.mode
                        ? `${selectedSession.deviceType ?? "-"} · ${
                            selectedSession.mode ?? "-"
                          }`
                        : "-"
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      selectedSession.inProgress
                        ? "In progress"
                        : "Completed"
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Started"
                    secondary={formatDateTime(selectedSession.startedAt)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Ended"
                    secondary={
                      selectedSession.inProgress
                        ? "—"
                        : formatDateTime(selectedSession.endedAt)
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Duration"
                    secondary={
                      selectedSession.inProgress
                        ? "—"
                        : formatDurationMinutes(
                            selectedSession.durationMinutes
                          )
                    }
                  />
                </ListItem>
              </List>

              {selectedSession.raw && (
                <>
                  <Typography
                    variant="subtitle2"
                    sx={{ mt: 2, mb: 1 }}
                    gutterBottom
                  >
                    Raw metadata
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: 12,
                      bgcolor: "grey.100",
                      p: 1,
                      borderRadius: 1,
                      overflow: "auto",
                      maxHeight: 260,
                    }}
                  >
                    {JSON.stringify(selectedSession.raw, null, 2)}
                  </Box>
                </>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No session selected.
            </Typography>
          )}
        </Box>
      </Drawer>
    </MainLayout>
  );
}