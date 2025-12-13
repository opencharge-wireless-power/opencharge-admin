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
import { db } from "../firebase";

import { PageHeader } from "../components/layout/PageHeader";
import { OverviewCards } from "@/components/common/cards/overview-card";
import { AppInsightsCard } from "@/components/dashboard/AppInsightsCard"
import { CampaignEngagementTables } from "@/components/dashboard/CampaignEngagementTables";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { Button } from "@/components/ui/button";
import {  RefreshCcw 
} from "lucide-react";
import { Campaigns, Promotions, Sessions, Units, LocationsDot, CampaignsQ } from "@/components/icons/Icons";
import { PulseLoader } from "@/components/common/loading/pulse-loader";

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
        let topCampaignOverall: { label: string; engagements: number } | null = null as { label: string; engagements: number } | null;

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

        if (topCampaignOverall !== null && topCampaignOverall.engagements > 0) {
          setTopCampaignLabel(topCampaignOverall.label);
        } else {
          setTopCampaignLabel(null);
        }

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

  if (loading) {
    return (
      <>
        <PageHeader
        title="Overview"
        breadcrumbs={[
          { label: "Overview", href: "/" },

        ]}
      />

        <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-2">
          {/* Pulsing circle */}
          <PulseLoader size={8} pulseCount={4} speed={1.5} />
        </div>
      </div>
      </>
    )
  }

  return (
    <>


      <PageHeader
        title="Overview"
        breadcrumbs={[
          { label: "Overview", href: "/" },

        ]}
      />
       <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
         {/*  HEADER SECTION  */}
         <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
            High-level overview of Opencharge locations, units, sessions,
            promotions and campaign engagement.
            </p>
          </div>
          {/* Action buttons for refreshing data */}
          <div className="flex gap-2">
            <Button variant="outline" size="icon">
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>


       </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Row 1: locations / units / sessions / promotions */}
          <OverviewCards
            columns={4}
            stats={[
              {
                title: "Locations",
                value: locationsCount.toString(),
                subtitle: `${locationsWithSessionsLast7} with sessions in last 7 days`,

                icon: LocationsDot,
              },
              {
                title: "Units",
                value: unitsCount.toString(),
                subtitle: `${activeUnitsCount} online • ${unitsNeedingMaintenanceCount} need maintenance`,

                icon: Units,
              },
              {
                title: "Sessions (last 7 days)",
                value: sessionsLast7DaysCount.toString(),
                subtitle: `
                  ${sessionsTodayCount} today •
                  Avg: ${
                    avgSessionDurationLast7 != null
                      ? `${avgSessionDurationLast7.toFixed(1)} min`
                      : "-"
                  } •
                  Total: ${sessionsCount}
                `,
        
                icon: Sessions,
              },
              {
                title: "Active promotions",
                value: activePromotionsCount.toString(),
                subtitle: "Currently running offers",
                icon: Promotions,

              },
            ]}
          />

          {/* Row 2: brands / campaigns / engagement */}
          <OverviewCards
            columns={4}
            stats={[
              {
                title: "Brands",
                value: brandsCount.toString(),
                subtitle: "In the Engage collection",
                icon: LocationsDot,
              },
              {
                title: "Campaigns",
                value: campaignsCount.toString(),
                subtitle: `${activeCampaignsCount} active`,
                icon: CampaignsQ,
              },
              {
                title: "Campaign engagements",
                value: campaignEngagementTotal.toString(),
                subtitle: "Sum of stored engagements",
                icon: Campaigns,
              },
              {
                title: "Engagement quality",
                value:
                  avgEngagementPerCampaign != null
                    ? avgEngagementPerCampaign.toFixed(1)
                    : "–",
                subtitle: `Top: ${topCampaignLabel ?? "–"}`,
                icon: Sessions,
              },
            ]}
          />


          {/* Row 2.5: App insights */}

          <AppInsightsCard
            appAdoptionLoading={appAdoptionLoading}
            appAdoption={appAdoption || undefined}
            appAvgBatteryDelta30={appAvgBatteryDelta30}
            appTopLocations30={appTopLocations30}
          />


          {/* Row 3: Top campaigns + brand slice */}
          <CampaignEngagementTables
            topCampaigns={topCampaigns}
            brandEngagements={brandEngagements}
          />

          {/* Recent sessions table */}
          <RecentSessionsTable sessions={recentSessions} />
        </>
      )}
    </>
  );
}