// src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";

interface SessionItem {
  id: string;
  locationId?: string;
  locationName?: string;
  unitId?: string;
  unitName?: string;
  status?: string;
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
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

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locationsCount, setLocationsCount] = useState(0);
  const [unitsCount, setUnitsCount] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [activePromotionsCount, setActivePromotionsCount] = useState(0);
  const [sessionsLast7DaysCount, setSessionsLast7DaysCount] = useState(0);

  const [recentSessions, setRecentSessions] = useState<SessionItem[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Locations
        const locationsSnap = await getDocs(collection(db, "locations"));
        setLocationsCount(locationsSnap.size);

        // Units
        const unitsSnap = await getDocs(collection(db, "units"));
        setUnitsCount(unitsSnap.size);

        // Promotions
        const promosSnap = await getDocs(collection(db, "promotions"));
        const activePromos = promosSnap.docs.filter((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return Boolean(data.isActive);
        });
        setActivePromotionsCount(activePromos.length);

        // Sessions
        const sessionsSnap = await getDocs(collection(db, "sessions"));
        setSessionsCount(sessionsSnap.size);

        const now = new Date();
        const sevenDaysAgo = new Date(
          now.getTime() - 7 * 24 * 60 * 60 * 1000
        );

        // Map sessions
        const sessions: SessionItem[] = sessionsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const startedTs = data.startedAt as Timestamp | undefined;
          const endedTs = data.endedAt as Timestamp | undefined;

          return {
            id: docSnap.id,
            locationId: data.locationId as string | undefined,
            locationName: data.locationName as string | undefined,
            unitId: data.unitId as string | undefined,
            unitName: data.unitName as string | undefined,
            status: data.status as string | undefined,
            startedAt: startedTs ? startedTs.toDate() : undefined,
            endedAt: endedTs ? endedTs.toDate() : undefined,
            durationMinutes:
              typeof data.durationMinutes === "number"
                ? (data.durationMinutes as number)
                : undefined,
          };
        });

        // Sessions last 7 days
        const last7DaysCount = sessions.filter((s) => {
          if (!s.startedAt) return false;
          return s.startedAt >= sevenDaysAgo;
        }).length;
        setSessionsLast7DaysCount(last7DaysCount);

        // Recent 10 sessions (most recent first)
        sessions.sort((a, b) => {
          const ta = a.startedAt?.getTime() ?? 0;
          const tb = b.startedAt?.getTime() ?? 0;
          return tb - ta;
        });

        setRecentSessions(sessions.slice(0, 10));

        setError(null);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load dashboard data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardData();
  }, []);

  return (
    <MainLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          High-level overview of Opencharge locations, units, sessions and
          promotions.
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && (
        <>
          {/* KPI cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
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
                  Locations
                </Typography>
                <Typography variant="h4">{locationsCount}</Typography>
                <Typography variant="caption" color="text.secondary">
                  With at least one Opencharge unit
                </Typography>
              </Paper>
            </Grid>

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
                  Units
                </Typography>
                <Typography variant="h4">{unitsCount}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Total charging units deployed
                </Typography>
              </Paper>
            </Grid>

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
                <Typography variant="h4">
                  {sessionsLast7DaysCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Out of {sessionsCount} total sessions
                </Typography>
              </Paper>
            </Grid>

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
                  Active promotions
                </Typography>
                <Typography variant="h4">
                  {activePromotionsCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Currently running offers
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Recent sessions table */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent sessions
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              Last 10 sessions across all locations.
            </Typography>

            <TableContainer
              component={Paper}
              sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Location</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Ended</TableCell>
                    <TableCell align="right">Duration (min)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSessions.map((s) => (
                    <TableRow key={s.id}>
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
                        {s.status ? (
                          <Chip
                            label={s.status}
                            size="small"
                            color={
                              s.status === "completed"
                                ? "success"
                                : s.status === "in_progress"
                                ? "info"
                                : "default"
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
                      <TableCell colSpan={6}>
                        <Typography align="center" sx={{ py: 2 }}>
                          No sessions found yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}
    </MainLayout>
  );
}