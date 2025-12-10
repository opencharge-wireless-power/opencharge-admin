// src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  type DocumentData,
  Timestamp,
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
  status?: "completed" | "in_progress";
  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
}

interface TopCampaign {
  brandName: string;
  campaignName: string;
  engagements: number;
}

interface BrandEngagement {
  brandId: string;
  brandName: string;
  engagements: number;
  campaignCount: number;
}

interface AppAdoptionMetrics {
  total: number;
  withApp: number;
  uniqueUnitsWithApp: number;
}

interface AppLocationRow {
  locationLabel: string;
  sessions: number;
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
  // App adoption / app insights
  const [appAdoption, setAppAdoption] =
    useState<AppAdoptionMetrics | null>(null);
  const [appAdoptionLoading, setAppAdoptionLoading] =
    useState<boolean>(true);
  const [appAvgBatteryDelta30, setAppAvgBatteryDelta30] =
    useState<number | null>(null);
  const [appTopLocations30, setAppTopLocations30] = useState<
    AppLocationRow[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Locations
  const [locationsCount, setLocationsCount] = useState(0);
  const [locationsWithSessionsLast7, setLocationsWithSessionsLast7] =
    useState(0);

  // Units
  const [unitsCount, setUnitsCount] = useState(0);
  const [activeUnitsCount, setActiveUnitsCount] = useState(0);
  const [unitsNeedingMaintenanceCount, setUnitsNeedingMaintenanceCount] =
    useState(0);

  // Sessions
  const [sessionsCount, setSessionsCount] = useState(0);
  const [sessionsLast7DaysCount, setSessionsLast7DaysCount] = useState(0);
  const [sessionsTodayCount, setSessionsTodayCount] = useState(0);
  const [avgSessionDurationLast7, setAvgSessionDurationLast7] = useState<
    number | null
  >(null);

  // Promotions
  const [activePromotionsCount, setActivePromotionsCount] = useState(0);

  // Brands / campaigns / engagement
  const [brandsCount, setBrandsCount] = useState(0);
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [activeCampaignsCount, setActiveCampaignsCount] = useState(0);
  const [campaignEngagementTotal, setCampaignEngagementTotal] =
    useState(0);
  const [avgEngagementPerCampaign, setAvgEngagementPerCampaign] =
    useState<number | null>(null);
  const [topCampaignLabel, setTopCampaignLabel] = useState<string | null>(
    null
  );

  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [brandEngagements, setBrandEngagements] = useState<
    BrandEngagement[]
  >([]);

  // Recent sessions
  const [recentSessions, setRecentSessions] = useState<SessionItem[]>([]);

  // ---------- Main dashboard data ----------
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // ---------- Locations ----------
        const locationsSnap = await getDocs(collection(db, "locations"));
        setLocationsCount(locationsSnap.size);

        const locationsById = new Map<string, { name: string }>();
        locationsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          locationsById.set(docSnap.id, {
            name: (data.name as string | undefined) ?? "Unnamed location",
          });
        });

        // ---------- Units ----------
        const unitsSnap = await getDocs(collection(db, "units"));
        setUnitsCount(unitsSnap.size);

        const unitsById = new Map<
          string,
          { name: string; locationId?: string }
        >();

        let activeUnits = 0;
        let unitsNeedingMaintenance = 0;

        unitsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const unitId = docSnap.id;
          unitsById.set(unitId, {
            name: (data.name as string | undefined) ?? "Unit",
            locationId: data.locationId as string | undefined,
          });

          const status = data.status as string | undefined;
          if (status === "online") activeUnits += 1;

          const health = data.health as
            | { needsMaintenance?: boolean }
            | undefined;
          if (health?.needsMaintenance) unitsNeedingMaintenance += 1;
        });

        setActiveUnitsCount(activeUnits);
        setUnitsNeedingMaintenanceCount(unitsNeedingMaintenance);

        // ---------- Promotions ----------
        const promosSnap = await getDocs(collection(db, "promotions"));
        const activePromos = promosSnap.docs.filter((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return Boolean(data.isActive);
        });
        setActivePromotionsCount(activePromos.length);

        // ---------- Sessions (chargesessions) ----------
        const sessionsSnap = await getDocs(collection(db, "chargesessions"));
        setSessionsCount(sessionsSnap.size);

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

        const sessions: SessionItem[] = sessionsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const startTs = data.start as Timestamp | undefined;
          const endTs = data.end as Timestamp | undefined;

          const startedAt = startTs ? startTs.toDate() : undefined;
          const endedAt = endTs ? endTs.toDate() : undefined;

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

          const status: "completed" | "in_progress" | undefined = endedAt
            ? "completed"
            : "in_progress";

          return {
            id: docSnap.id,
            locationId,
            locationName: location?.name,
            unitId,
            unitName: unit?.name,
            status,
            startedAt,
            endedAt,
            durationMinutes,
          };
        });

        // Session aggregates
        let last7Count = 0;
        let todayCount = 0;
        let durationSumLast7 = 0;
        let durationCountLast7 = 0;
        const locationIdsLast7 = new Set<string>();

        for (const s of sessions) {
          if (!s.startedAt) continue;

          if (s.startedAt >= sevenDaysAgo) {
            last7Count++;

            if (
              typeof s.durationMinutes === "number" &&
              !Number.isNaN(s.durationMinutes)
            ) {
              durationSumLast7 += s.durationMinutes;
              durationCountLast7++;
            }

            if (s.locationId) locationIdsLast7.add(s.locationId);

            if (s.startedAt >= todayStart) {
              todayCount++;
            }
          }
        }

        setSessionsLast7DaysCount(last7Count);
        setSessionsTodayCount(todayCount);
        setLocationsWithSessionsLast7(locationIdsLast7.size);
        setAvgSessionDurationLast7(
          durationCountLast7 > 0
            ? durationSumLast7 / durationCountLast7
            : null
        );

        // Recent 10 sessions
        sessions.sort((a, b) => {
          const ta = a.startedAt?.getTime() ?? 0;
          const tb = b.startedAt?.getTime() ?? 0;
          return tb - ta;
        });
        setRecentSessions(sessions.slice(0, 10));

        // ---------- Brands / campaigns / engagements ----------
        const brandsSnap = await getDocs(collection(db, "engage"));
        setBrandsCount(brandsSnap.size);

        let totalCampaigns = 0;
        let totalActiveCampaigns = 0;
        let totalEngagements = 0;
        let topCampaignOverall:
          | { label: string; engagements: number }
          | null = null;

        const brandNameById = new Map<string, string>();
        brandsSnap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const brandId = docSnap.id;
          const brandName = (data.name as string | undefined) ?? brandId;
          brandNameById.set(brandId, brandName);
        });

        const perBrandTotals = new Map<
          string,
          { engagements: number; campaignCount: number }
        >();
        const allCampaigns: TopCampaign[] = [];

        await Promise.all(
          brandsSnap.docs.map(async (brandDoc) => {
            const brandId = brandDoc.id;
            const brandName = brandNameById.get(brandId) ?? brandId;

            const campaignsSnap = await getDocs(
              collection(db, "engage", brandId, "campaigns")
            );

            totalCampaigns += campaignsSnap.size;

            campaignsSnap.forEach((campaignDoc) => {
              const data = campaignDoc.data() as DocumentData;

              const active = (data.active as boolean | undefined) ?? false;
              if (active) totalActiveCampaigns++;

              const rawEng = data.engagements;
              const engagements =
                typeof rawEng === "number" && !Number.isNaN(rawEng)
                  ? rawEng
                  : 0;

              totalEngagements += engagements;

              const name =
                (data.name as string | undefined) ??
                `${brandName} / ${campaignDoc.id}`;

              // For "top campaign" text in KPI
              if (
                !topCampaignOverall ||
                engagements > topCampaignOverall.engagements
              ) {
                topCampaignOverall = {
                  label: `${name} (${engagements})`,
                  engagements,
                };
              }

              // For top 5 campaigns table
              allCampaigns.push({
                brandName,
                campaignName: name,
                engagements,
              });

              // Per-brand totals
              const prev = perBrandTotals.get(brandId) ?? {
                engagements: 0,
                campaignCount: 0,
              };
              perBrandTotals.set(brandId, {
                engagements: prev.engagements + engagements,
                campaignCount: prev.campaignCount + 1,
              });
            });
          })
        );

        setCampaignsCount(totalCampaigns);
        setActiveCampaignsCount(totalActiveCampaigns);
        setCampaignEngagementTotal(totalEngagements);

        setAvgEngagementPerCampaign(
          totalCampaigns > 0 ? totalEngagements / totalCampaigns : null
        );

        setTopCampaignLabel(
          topCampaignOverall && topCampaignOverall.engagements > 0
            ? topCampaignOverall.label
            : null
        );

        // Top 5 campaigns
        allCampaigns.sort((a, b) => b.engagements - a.engagements);
        setTopCampaigns(allCampaigns.slice(0, 5));

        // Brand engagement summary
        const brandStats: BrandEngagement[] = [];
        perBrandTotals.forEach((value, brandId) => {
          brandStats.push({
            brandId,
            brandName: brandNameById.get(brandId) ?? brandId,
            engagements: value.engagements,
            campaignCount: value.campaignCount,
          });
        });
        brandStats.sort((a, b) => b.engagements - a.engagements);
        setBrandEngagements(brandStats);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load dashboard data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardData();
  }, []);

  // ---------- App adoption / app insights (last 30 days) ----------
  useEffect(() => {
    const fetchAppAdoption = async () => {
      try {
        setAppAdoptionLoading(true);

        const now = new Date();
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000
        );

        const ref = collection(db, "chargesessions");

        const q = query(
          ref,
          where("start", ">=", Timestamp.fromDate(thirtyDaysAgo)),
          limit(2000) // adjust if you expect very high volume
        );

        const snap = await getDocs(q);

        let total = 0;
        let withApp = 0;
        const unitsWithApp = new Set<string>();

        let batteryDeltaSum = 0;
        let batteryDeltaCount = 0;

        const locationMap = new Map<string, number>();

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          total++;

          const hasAppInfo =
            !!data.appLinked ||
            !!data.appDeviceMake ||
            !!data.appDeviceModel ||
            data.appBatteryDelta != null;

          if (!hasAppInfo) return;

          withApp++;

          const unitId =
            (data.unitId as string | undefined) ??
            (data.id as string | undefined);
          if (unitId) unitsWithApp.add(unitId);

          const delta =
            typeof data.appBatteryDelta === "number" &&
            !Number.isNaN(data.appBatteryDelta)
              ? (data.appBatteryDelta as number)
              : null;
          if (delta != null) {
            batteryDeltaSum += delta;
            batteryDeltaCount++;
          }

          const locLabel =
            (data.appLocationId as string | undefined) ??
            (data.locationId as string | undefined) ??
            "Unknown location";
          locationMap.set(locLabel, (locationMap.get(locLabel) ?? 0) + 1);
        });

        setAppAdoption({
          total,
          withApp,
          uniqueUnitsWithApp: unitsWithApp.size,
        });

        setAppAvgBatteryDelta30(
          batteryDeltaCount > 0
            ? batteryDeltaSum / batteryDeltaCount
            : null
        );

        const topLocs: AppLocationRow[] = Array.from(
          locationMap.entries()
        )
          .map(([locationLabel, sessions]) => ({
            locationLabel,
            sessions,
          }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 5);

        setAppTopLocations30(topLocs);
      } catch (err) {
        console.error("Failed to load app adoption metrics", err);
        setAppAdoption(null);
        setAppAvgBatteryDelta30(null);
        setAppTopLocations30([]);
      } finally {
        setAppAdoptionLoading(false);
      }
    };

    void fetchAppAdoption();
  }, []);

  return (
    <MainLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          High-level overview of Opencharge locations, units, sessions,
          promotions, campaign engagement and app usage.
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
          {/* Row 1: locations / units / sessions / promotions / app adoption */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Locations */}
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
                  {locationsWithSessionsLast7} with sessions in last 7 days
                </Typography>
              </Paper>
            </Grid>

            {/* Units */}
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {activeUnitsCount} online
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {unitsNeedingMaintenanceCount} need maintenance
                </Typography>
              </Paper>
            </Grid>

            {/* Sessions */}
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {sessionsTodayCount} today
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Avg duration:{" "}
                  {avgSessionDurationLast7 != null
                    ? `${avgSessionDurationLast7.toFixed(1)} min`
                    : "-"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Out of {sessionsCount} total sessions
                </Typography>
              </Paper>
            </Grid>

            {/* Promotions */}
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

            {/* App adoption (30 days) */}
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
                  App adoption (30 days)
                </Typography>
                {appAdoptionLoading || !appAdoption ? (
                  <>
                    <Typography variant="h4">–</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Loading app-linked sessions…
                    </Typography>
                  </>
                ) : appAdoption.total === 0 ? (
                  <>
                    <Typography variant="h4">0%</Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      No sessions recorded in last 30 days
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="h4">
                      {Math.round(
                        (appAdoption.withApp / appAdoption.total) * 100
                      )}
                      %
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {appAdoption.withApp} of {appAdoption.total} sessions
                      with app data
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {appAdoption.uniqueUnitsWithApp} units saw app
                      sessions
                    </Typography>
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Row 2: brands / campaigns / engagement */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Brands */}
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
                  Brands
                </Typography>
                <Typography variant="h4">{brandsCount}</Typography>
                <Typography variant="caption" color="text.secondary">
                  In the Engage collection
                </Typography>
              </Paper>
            </Grid>

            {/* Campaigns */}
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
                  Campaigns
                </Typography>
                <Typography variant="h4">{campaignsCount}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeCampaignsCount} active
                </Typography>
              </Paper>
            </Grid>

            {/* Campaign engagements */}
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
                  Campaign engagements
                </Typography>
                <Typography variant="h4">
                  {campaignEngagementTotal}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sum of stored <code>engagements</code> across campaigns
                </Typography>
              </Paper>
            </Grid>

            {/* Engagement quality */}
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
                  Engagement quality
                </Typography>
                <Typography variant="h4">
                  {avgEngagementPerCampaign != null
                    ? avgEngagementPerCampaign.toFixed(1)
                    : "–"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Avg engagements / campaign
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Top: {topCampaignLabel ?? "–"}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Row 2.5: App insights */}
          <Box sx={{ mb: 3 }}>
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
                App insights (last 30 days)
              </Typography>

              {appAdoptionLoading || !appAdoption ? (
                <Typography variant="body2" color="text.secondary">
                  Loading app usage insights…
                </Typography>
              ) : appAdoption.total === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No sessions recorded in the last 30 days.
                </Typography>
              ) : (
                <>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        App adoption
                      </Typography>
                      <Typography variant="h5">
                        {Math.round(
                          (appAdoption.withApp / appAdoption.total) *
                            100
                        )}
                        %
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {appAdoption.withApp} of {appAdoption.total}{" "}
                        sessions
                      </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        Units with app sessions
                      </Typography>
                      <Typography variant="h5">
                        {appAdoption.uniqueUnitsWithApp}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        Devices that saw at least one app-linked
                        session
                      </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        Avg battery delta (app)
                      </Typography>
                      <Typography variant="h5">
                        {appAvgBatteryDelta30 != null
                          ? `${appAvgBatteryDelta30.toFixed(0)}%`
                          : "–"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        Where <code>appBatteryDelta</code> was
                        reported
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="subtitle2" gutterBottom>
                    Top locations by app-linked sessions
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Location (from app)</TableCell>
                          <TableCell align="right">
                            App sessions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {appTopLocations30.map((row) => (
                          <TableRow key={row.locationLabel}>
                            <TableCell>{row.locationLabel}</TableCell>
                            <TableCell align="right">
                              {row.sessions}
                            </TableCell>
                          </TableRow>
                        ))}
                        {appTopLocations30.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2}>
                              <Typography
                                align="center"
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 1 }}
                              >
                                No app location data yet.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Paper>
          </Box>

          {/* Row 3: Top campaigns + brand slice */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              {/* Top 5 campaigns */}
              <Grid item xs={12} md={6}>
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
                    Top 5 campaigns by engagements
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Brand</TableCell>
                          <TableCell>Campaign</TableCell>
                          <TableCell align="right">
                            Engagements
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topCampaigns.map((c, idx) => (
                          <TableRow
                            key={`${c.brandName}-${c.campaignName}-${idx}`}
                          >
                            <TableCell>{c.brandName}</TableCell>
                            <TableCell>{c.campaignName}</TableCell>
                            <TableCell align="right">
                              {c.engagements}
                            </TableCell>
                          </TableRow>
                        ))}
                        {topCampaigns.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <Typography
                                align="center"
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 1 }}
                              >
                                No campaign engagement data yet.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* Engagement by brand */}
              <Grid item xs={12} md={6}>
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
                    Engagement by brand
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Brand</TableCell>
                          <TableCell align="right">
                            Engagements
                          </TableCell>
                          <TableCell align="right">
                            Campaigns
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {brandEngagements.map((b) => (
                          <TableRow key={b.brandId}>
                            <TableCell>{b.brandName}</TableCell>
                            <TableCell align="right">
                              {b.engagements}
                            </TableCell>
                            <TableCell align="right">
                              {b.campaignCount}
                            </TableCell>
                          </TableRow>
                        ))}
                        {brandEngagements.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <Typography
                                align="center"
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 1 }}
                              >
                                No brands or campaigns yet.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </Box>

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
              Last 10 sessions across all locations (from chargesessions).
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
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Ended</TableCell>
                    <TableCell align="right">
                      Duration (min)
                    </TableCell>
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
                            label={
                              s.status === "completed"
                                ? "Completed"
                                : "In progress"
                            }
                            size="small"
                            color={
                              s.status === "completed"
                                ? "success"
                                : "info"
                            }
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(s.startedAt)}</TableCell>
                      <TableCell>{formatDateTime(s.endedAt)}</TableCell>
                      <TableCell align="right">
                        {typeof s.durationMinutes === "number"
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