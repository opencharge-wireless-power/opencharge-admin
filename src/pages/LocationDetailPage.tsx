// src/pages/LocationDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  type DocumentData,
  type Timestamp,
  collectionGroup,
} from "firebase/firestore";
import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";

// Reusable components
import { LocationInfoCards } from "@/components/locations/LocationInfoCards";
import { UnitsTable } from "@/components/locations/UnitsTable";
import { LocationSessionsTable } from "@/components/locations/LocationSessionsTable";
import { EditLocationDialog } from "@/components/locations/EditLocationDialog";
import { EditUnitDialog } from "@/components/locations/EditUnitDialog";
import { SessionDetailDrawer } from "@/components/locations/SessionDetailDrawer";
import { EditImagesDialog } from "@/components/locations/EditImagesDialog";
import { PromotionsSection } from "@/components/locations/PromotionsSection";
import { EngageCampaignsTable } from "@/components/locations/EngageCampaignsTable";
import { CampaignsSection } from "@/components/locations/CampaignsSection";

// UI components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Types & helpers
import type {
  Location,
  EditFormState,
  Unit,
  UnitEditForm,
  Session,
  Promotion,
  DateFilter,
  OpenHours,
  UnitHealth,
  UnitMetrics,
  UnitInteractions,
  StoreEngageCampaign,
} from "../types/Opencharge";
import { ORDERED_DAYS } from "../utils/Format";

interface LocationCampaign {
  id: string;
  brandId?: string;
  name: string;
  active: boolean;
  engagements: number;
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
}

function deriveQrCodeFromId(
  locationId: string | undefined,
  base = "https://opencharge.io/e"
): string {
  if (!locationId) return "";
  const parts = locationId.split("-").filter(Boolean);
  if (parts.length < 2) return "";

  const [brandPart, ...rest] = parts;
  const locationPart = rest.join("-");

  return `${base}/${brandPart}/${locationPart}`;
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------- Component ----------

export function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === "admin";

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Units
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  // Unit add/edit dialog
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [unitDialogMode, setUnitDialogMode] = useState<"add" | "edit">("add");
  const [selectedUnit, setSelectedUnit] = useState<Unit | undefined>(undefined);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Session filters
  const [sessionsDateFilter, setSessionsDateFilter] =
    useState<DateFilter>("all");
  const [sessionsUnitFilter, setSessionsUnitFilter] = useState<string>("all");
  const [sessionsInProgressOnly, setSessionsInProgressOnly] =
    useState<boolean>(false);

  // Session detail drawer
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Promotions
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);

  // Campaigns
  const [campaigns, setCampaigns] = useState<LocationCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  const [engageCampaigns, setEngageCampaigns] = useState<StoreEngageCampaign[]>(
    []
  );
  const [engageLoading, setEngageLoading] = useState(false);
  const [engageError, setEngageError] = useState<string | null>(null);

  // Images dialog
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false);

  // ---------- Fetch LOCATION ----------
  useEffect(() => {
    const fetchLocation = async () => {
      if (!id) {
        setError("No location ID");
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "locations", id);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) {
          setError("Location not found");
          setLoading(false);
          return;
        }

        const data = snapshot.data() as DocumentData;

        const lastAvailabilityTs = data.lastAvailabilityUpdate as
          | Timestamp
          | undefined;

        const openHours =
          data.openHours && typeof data.openHours === "object"
            ? (data.openHours as OpenHours)
            : undefined;

        const images =
          Array.isArray(data.images) && data.images.length > 0
            ? (data.images as string[])
            : [];

        const loc: Location = {
          id: snapshot.id,
          name: (data.name as string) ?? "Unnamed location",

          address: (data.address as string | undefined) ?? "",
          city: (data.city as string | undefined) ?? "",
          country: (data.country as string | undefined) ?? "",
          category: (data.category as string | undefined) ?? "",
          active: (data.active as boolean | undefined) ?? false,

          brand: (data.brand as string | undefined) ?? "",
          storeLocation: (data.storeLocation as string | undefined) ?? "",
          qrCode:
            (data.qrCode as string | undefined) ??
            deriveQrCodeFromId(snapshot.id),

          hasActivePromotion:
            (data.hasActivePromotion as boolean | undefined) ?? false,
          hasActivePromotions:
            (data.hasActivePromotions as boolean | undefined) ?? false,

          images,
          lastAvailabilityUpdate: lastAvailabilityTs
            ? lastAvailabilityTs.toDate()
            : undefined,

          lat: typeof data.lat === "number" ? (data.lat as number) : undefined,
          lng: typeof data.lng === "number" ? (data.lng as number) : undefined,

          priority:
            typeof data.priority === "number"
              ? (data.priority as number)
              : undefined,

          supportsOrdering:
            (data.supportsOrdering as boolean | undefined) ?? false,
          supportsPayments:
            (data.supportsPayments as boolean | undefined) ?? false,
          supportsPromotions:
            (data.supportsPromotions as boolean | undefined) ?? false,

          totalSessions: (data.totalSessions as number | undefined) ?? 0,
          unitInUse: (data.unitInUse as number | undefined) ?? 0,
          unitTotal: (data.unitTotal as number | undefined) ?? 0,

          openHours,
        };

        setLocation(loc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load location";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchLocation();
  }, [id]);

  // ---------- Fetch Engage Campaigns ----------
  useEffect(() => {
    const fetchEngageCampaigns = async () => {
      if (!location?.brand || !location?.storeLocation) return;

      setEngageLoading(true);
      setEngageError(null);

      try {
        const brandSlug = slugify(location.brand);
        const storeSlug = slugify(location.storeLocation);

        const campaignsRef = collection(
          db,
          "engage",
          brandSlug,
          "stores",
          storeSlug,
          "campaigns"
        );

        const snap = await getDocs(campaignsRef);

        const items: StoreEngageCampaign[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          return {
            id: docSnap.id,
            campaignId: (data.campaignId as string) ?? docSnap.id,
            name: (data.name as string) ?? "Untitled campaign",
            active: (data.active as boolean | undefined) ?? false,
            engagements:
              typeof data.engagements === "number" ? data.engagements : 0,
            url: data.url as string | undefined,
            targetUrl: data.targetUrl as string | undefined,
            brandSlug,
            storeSlug,
            locationId: location.id,
          };
        });

        setEngageCampaigns(items);
      } catch (err) {
        setEngageError(
          err instanceof Error ? err.message : "Failed to load Engage campaigns"
        );
      } finally {
        setEngageLoading(false);
      }
    };

    void fetchEngageCampaigns();
  }, [location]);

  // ---------- Fetch UNITS ----------
  useEffect(() => {
    const fetchUnits = async () => {
      if (!id) {
        setUnitsLoading(false);
        return;
      }

      try {
        const unitsRef = collection(db, "units");
        const qUnits = query(unitsRef, where("locationId", "==", id));
        const snapshot = await getDocs(qUnits);

        const unitItems: Unit[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const lastHeartbeatTs = data.lastHeartbeat as Timestamp | undefined;
          const lastInteractionTs = data.lastInteraction as
            | Timestamp
            | undefined;
          const lastSessionTs = data.lastSessionTimestamp as
            | Timestamp
            | undefined;

          const healthRaw = data.health as
            | {
                lastCalculated?: Timestamp;
                needsMaintenance?: boolean;
                status?: string;
              }
            | undefined;

          const metricsRaw = data.metrics as
            | {
                calculatedAt?: Timestamp;
                faultRate?: number;
                placementIssueRate?: number;
                retryRate?: number;
                successRate?: number;
                totalInteractions?: number;
                totalSessions?: number;
              }
            | undefined;

          const health: UnitHealth | undefined = healthRaw
            ? {
                lastCalculated: healthRaw.lastCalculated
                  ? healthRaw.lastCalculated.toDate()
                  : undefined,
                needsMaintenance: healthRaw.needsMaintenance ?? false,
                status: healthRaw.status,
              }
            : undefined;

          const metrics: UnitMetrics | undefined = metricsRaw
            ? {
                calculatedAt: metricsRaw.calculatedAt
                  ? metricsRaw.calculatedAt.toDate()
                  : undefined,
                faultRate:
                  typeof metricsRaw.faultRate === "number"
                    ? metricsRaw.faultRate
                    : undefined,
                placementIssueRate:
                  typeof metricsRaw.placementIssueRate === "number"
                    ? metricsRaw.placementIssueRate
                    : undefined,
                retryRate:
                  typeof metricsRaw.retryRate === "number"
                    ? metricsRaw.retryRate
                    : undefined,
                successRate:
                  typeof metricsRaw.successRate === "number"
                    ? metricsRaw.successRate
                    : undefined,
                totalInteractions:
                  typeof metricsRaw.totalInteractions === "number"
                    ? metricsRaw.totalInteractions
                    : undefined,
                totalSessions:
                  typeof metricsRaw.totalSessions === "number"
                    ? metricsRaw.totalSessions
                    : undefined,
              }
            : undefined;

          const interactions: UnitInteractions = {
            chargingStarted:
              typeof data["interactions.charging_started"] === "number"
                ? (data["interactions.charging_started"] as number)
                : undefined,
            hardwareFault:
              typeof data["interactions.hardware_fault"] === "number"
                ? (data["interactions.hardware_fault"] as number)
                : undefined,
            issueCleared:
              typeof data["interactions.issue_cleared"] === "number"
                ? (data["interactions.issue_cleared"] as number)
                : undefined,
            placementIssue:
              typeof data["interactions.placement_issue"] === "number"
                ? (data["interactions.placement_issue"] as number)
                : undefined,
            successfulCharge:
              typeof data["interactions.successful_charge"] === "number"
                ? (data["interactions.successful_charge"] as number)
                : undefined,
          };

          return {
            id: docSnap.id,
            name: (data.name as string) ?? "Unnamed unit",
            position: data.position as string | undefined,

            status: data.status as string | undefined,
            inUse:
              typeof data.inUse === "boolean"
                ? (data.inUse as boolean)
                : undefined,

            currentDeviceType: data.currentDeviceType as string | undefined,
            currentMode: data.currentMode as string | undefined,

            lastHeartbeat: lastHeartbeatTs ? lastHeartbeatTs.toDate() : undefined,
            lastInteraction: lastInteractionTs
              ? lastInteractionTs.toDate()
              : undefined,
            lastSessionTimestamp: lastSessionTs
              ? lastSessionTs.toDate()
              : undefined,

            lastInteractionType: data.lastInteractionType as string | undefined,
            lastInteractionMode: data.lastInteractionMode as string | undefined,
            lastInteractionDeviceType:
              (data.lastInteractionDeviceType as string | undefined) ??
              undefined,

            lastSessionDuration:
              typeof data.lastSessionDuration === "number"
                ? (data.lastSessionDuration as number)
                : undefined,
            lastSessionMode: data.lastSessionMode as string | undefined,
            lastSessionDeviceType:
              (data.lastSessionDeviceType as string | undefined) ?? undefined,

            totalSessions:
              typeof data.totalSessions === "number"
                ? (data.totalSessions as number)
                : metrics?.totalSessions,
            totalInteractions:
              typeof data.totalInteractions === "number"
                ? (data.totalInteractions as number)
                : metrics?.totalInteractions,

            particleDeviceId: data.particleDeviceId as string | undefined,

            health,
            metrics,
            interactions,
          };
        });

        setUnits(unitItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load units";
        setUnitsError(message);
      } finally {
        setUnitsLoading(false);
      }
    };

    void fetchUnits();
  }, [id]);

  // ---------- Fetch SESSIONS ----------
  useEffect(() => {
    const fetchSessions = async () => {
      if (!id) {
        setSessionsLoading(false);
        return;
      }

      if (!units || units.length === 0) {
        setSessions([]);
        setSessionsLoading(false);
        return;
      }

      try {
        const particleDeviceIds = units
          .map((u) => u.particleDeviceId)
          .filter((pid): pid is string => !!pid);

        if (particleDeviceIds.length === 0) {
          setSessions([]);
          setSessionsLoading(false);
          return;
        }

        const sessionsRef = collectionGroup(db, "sessions");
        const qSessions = query(
          sessionsRef,
          where("particleDeviceId", "in", particleDeviceIds),
          orderBy("startedAt", "desc"),
          limit(200)
        );

        const snapshot = await getDocs(qSessions);

        const sessionItems: Session[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const startedAtTs = data.startedAt as Timestamp | undefined;
          const endedAtTs = data.endedAt as Timestamp | undefined;

          const inProgress = !data.endedAt;

          const startedAt = startedAtTs ? startedAtTs.toDate() : undefined;
          const endedAt = endedAtTs ? endedAtTs.toDate() : undefined;

          let durationMinutes = 0;
          if (startedAt && endedAt) {
            const diff = endedAt.getTime() - startedAt.getTime();
            durationMinutes = diff / 1000 / 60;
          }

          const particleDeviceId = data.particleDeviceId as string | undefined;
          const matchingUnit = units.find(
            (u) => u.particleDeviceId === particleDeviceId
          );

          return {
            id: docSnap.id,
            locationId: data.locationId as string | undefined,
            unitId: data.unitId as string | undefined,
            unitName: matchingUnit?.name,
            startedAt,
            endedAt,
            inProgress,
            durationMinutes,
            raw: data,
          };
        });

        setSessions(sessionItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load sessions";
        setSessionsError(message);
      } finally {
        setSessionsLoading(false);
      }
    };

    void fetchSessions();
  }, [id, units]);

  // ---------- Fetch PROMOTIONS ----------
  useEffect(() => {
    const fetchPromotions = async () => {
      if (!id) {
        setPromotionsLoading(false);
        return;
      }

      try {
        const promotionsRef = collection(db, "promotions");
        const qPromotions = query(promotionsRef, where("locationId", "==", id));
        const snapshot = await getDocs(qPromotions);

        const promoItems: Promotion[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const validFromTs = data.validFrom as Timestamp | undefined;
          const validToTs = data.validTo as Timestamp | undefined;

          return {
            id: docSnap.id,
            title: (data.title as string) ?? "Untitled promotion",
            description: data.description as string | undefined,
            imageUrl: data.imageUrl as string | undefined,
            isActive: (data.isActive as boolean | undefined) ?? false,
            locationId: data.locationId as string | undefined,
            validFrom: validFromTs ? validFromTs.toDate() : undefined,
            validTo: validToTs ? validToTs.toDate() : undefined,
            priority:
              typeof data.priority === "number" ? data.priority : undefined,
          };
        });

        setPromotions(promoItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load promotions";
        setPromotionsError(message);
      } finally {
        setPromotionsLoading(false);
      }
    };

    void fetchPromotions();
  }, [id]);

  // ---------- Fetch CAMPAIGNS ----------
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!id) {
        setCampaignsLoading(false);
        return;
      }

      try {
        const brandsRef = collection(db, "brands");
        const brandsSnapshot = await getDocs(brandsRef);

        const allCampaigns: LocationCampaign[] = [];

        for (const brandDoc of brandsSnapshot.docs) {
          const brandId = brandDoc.id;
          const campaignsRef = collection(db, "brands", brandId, "campaigns");
          const campaignsSnapshot = await getDocs(campaignsRef);

          for (const campaignDoc of campaignsSnapshot.docs) {
            const campaignData = campaignDoc.data() as DocumentData;

            const locationIds = Array.isArray(campaignData.locationIds)
              ? (campaignData.locationIds as string[])
              : [];

            if (locationIds.includes(id)) {
              const createdAtTs = campaignData.createdAt as Timestamp | undefined;

              allCampaigns.push({
                id: campaignDoc.id,
                brandId,
                name: (campaignData.name as string) ?? "Untitled campaign",
                active: (campaignData.active as boolean | undefined) ?? false,
                engagements:
                  typeof campaignData.engagements === "number"
                    ? campaignData.engagements
                    : 0,
                url: campaignData.url as string | undefined,
                targetUrl: campaignData.targetUrl as string | undefined,
                createdAt: createdAtTs ? createdAtTs.toDate() : undefined,
              });
            }
          }
        }

        setCampaigns(allCampaigns);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load campaigns";
        setCampaignsError(message);
      } finally {
        setCampaignsLoading(false);
      }
    };

    void fetchCampaigns();
  }, [id]);

  // ---------- LOCATION EDIT HANDLERS ----------
  const handleLocationSubmit = async (form: EditFormState) => {
    if (!location) return;

    const ref = doc(db, "locations", location.id);

    const priorityNumber =
      form.priority.trim().length > 0 ? Number(form.priority.trim()) : null;

    const latNumber =
      form.lat.trim().length > 0 ? Number(form.lat.trim()) : null;
    const lngNumber =
      form.lng.trim().length > 0 ? Number(form.lng.trim()) : null;

    let qrCode = form.qrCode.trim();
    if (!qrCode) {
      qrCode = deriveQrCodeFromId(location.id);
    }

    const updates: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      storeLocation: form.storeLocation.trim(),
      qrCode,
      active: form.active,
      supportsOrdering: form.supportsOrdering,
      supportsPayments: form.supportsPayments,
      supportsPromotions: form.supportsPromotions,
    };

    if (priorityNumber !== null && !Number.isNaN(priorityNumber)) {
      updates.priority = priorityNumber;
    } else {
      updates.priority = null;
    }

    updates.lat =
      latNumber !== null && !Number.isNaN(latNumber) ? latNumber : null;
    updates.lng =
      lngNumber !== null && !Number.isNaN(lngNumber) ? lngNumber : null;

    const openHoursUpdates: OpenHours = {
      mon: form.openHoursMon.trim(),
      tue: form.openHoursTue.trim(),
      wed: form.openHoursWed.trim(),
      thu: form.openHoursThu.trim(),
      fri: form.openHoursFri.trim(),
      sat: form.openHoursSat.trim(),
      sun: form.openHoursSun.trim(),
    };

    updates.openHours = openHoursUpdates;

    await updateDoc(ref, updates);

    const newLocation: Location = {
      ...location,
      name: updates.name as string,
      address: updates.address as string,
      city: updates.city as string,
      country: updates.country as string,
      category: updates.category as string,
      brand: updates.brand as string,
      storeLocation: updates.storeLocation as string,
      qrCode: updates.qrCode as string,
      active: updates.active as boolean,
      supportsOrdering: updates.supportsOrdering as boolean,
      supportsPayments: updates.supportsPayments as boolean,
      supportsPromotions: updates.supportsPromotions as boolean,
      priority:
        priorityNumber !== null && !Number.isNaN(priorityNumber)
          ? priorityNumber
          : undefined,
      lat:
        latNumber !== null && !Number.isNaN(latNumber) ? latNumber : undefined,
      lng:
        lngNumber !== null && !Number.isNaN(lngNumber) ? lngNumber : undefined,
      openHours: openHoursUpdates,
    };

    setLocation(newLocation);
    setIsEditOpen(false);
  };

  // ---------- UNIT ADD / EDIT HANDLERS ----------
  const openAddUnitDialog = () => {
    setUnitDialogMode("add");
    setSelectedUnit(undefined);
    setIsUnitDialogOpen(true);
  };

  const openEditUnitDialog = (unit: Unit) => {
    setUnitDialogMode("edit");
    setSelectedUnit(unit);
    setIsUnitDialogOpen(true);
  };

  const handleUnitSubmit = async (form: UnitEditForm) => {
    if (!location) return;

    const totalSessionsNumber =
      form.totalSessions.trim().length > 0
        ? Number(form.totalSessions.trim())
        : 0;

    const baseData: Record<string, unknown> = {
      name: form.name.trim(),
      position: form.position.trim(),
      status: form.status.trim() || "online",
      inUse: form.inUse,
      totalSessions: Number.isNaN(totalSessionsNumber)
        ? 0
        : totalSessionsNumber,
    };

    if (unitDialogMode === "edit" && form.id) {
      const ref = doc(db, "units", form.id);
      await updateDoc(ref, baseData);

      setUnits((prev) =>
        prev.map((u) =>
          u.id === form.id
            ? {
                ...u,
                name: baseData.name as string,
                position: baseData.position as string,
                status: baseData.status as string,
                inUse: baseData.inUse as boolean,
                totalSessions: baseData.totalSessions as number,
              }
            : u
        )
      );
    } else {
      const ref = await addDoc(collection(db, "units"), {
        ...baseData,
        locationId: location.id,
        lastHeartbeat: serverTimestamp(),
      });

      const newUnit: Unit = {
        id: ref.id,
        name: baseData.name as string,
        position: baseData.position as string,
        status: baseData.status as string,
        inUse: baseData.inUse as boolean,
        totalSessions: baseData.totalSessions as number,
      };

      setUnits((prev) => [...prev, newUnit]);
    }

    setIsUnitDialogOpen(false);
  };

  // ---------- SESSION HANDLERS ----------
  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setSessionDetailOpen(true);
  };

  // ---------- SESSION FILTERING ----------
  const filteredSessions: Session[] = (() => {
    if (!sessions || sessions.length === 0) return [];

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
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
      0,
      0,
      0,
      0
    );
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0
    );

    return sessions.filter((s) => {
      if (sessionsInProgressOnly && !s.inProgress) return false;

      if (sessionsUnitFilter !== "all") {
        const unitId = units.find((u) => u.name === sessionsUnitFilter)?.id;
        if (s.unitId !== unitId) return false;
      }

      if (sessionsDateFilter === "today") {
        if (!s.startedAt) return false;
        return s.startedAt >= startOfToday;
      }

      if (sessionsDateFilter === "week") {
        if (!s.startedAt) return false;
        return s.startedAt >= startOfWeek;
      }

      if (sessionsDateFilter === "month") {
        if (!s.startedAt) return false;
        return s.startedAt >= startOfMonth;
      }

      return true;
    });
  })();

  // ---------- IMAGES HANDLERS ----------
  const handleImagesSubmit = async (images: string[]) => {
    if (!location) return;

    const ref = doc(db, "locations", location.id);
    await updateDoc(ref, { images });

    setLocation({ ...location, images });
    setImagesDialogOpen(false);
  };

  // ---------- RENDER ----------
  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (error || !location) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <p className="text-destructive">{error || "Location not found"}</p>
        </div>
      </MainLayout>
    );
  }

  const brandSlug = location.brand ? slugify(location.brand) : "";
  const storeSlug = location.storeLocation
    ? slugify(location.storeLocation)
    : "";

  return (
    <>
      <PageHeader
        title="Location"
        breadcrumbs={[{ label: "Locations", href: "/locations" }]}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              {location.name}
            </h1>
            <Badge variant={location.active ? "default" : "secondary"}>
              {location.active ? "Active" : "Inactive"}
            </Badge>
          </div>

          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setImagesDialogOpen(true)}
              >
                Edit images
              </Button>
              <Button onClick={() => setIsEditOpen(true)}>
                Edit location
              </Button>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <LocationInfoCards location={location} />

        {/* Promotions */}
        <PromotionsSection
          locationId={location.id}
          promotions={promotions}
          loading={promotionsLoading}
          error={promotionsError}
        />

        {/* Engage Campaigns */}
        {brandSlug && storeSlug && (
          <EngageCampaignsTable
            campaigns={engageCampaigns}
            brandSlug={brandSlug}
            storeSlug={storeSlug}
            loading={engageLoading}
            error={engageError}
          />
        )}

        {/* Regular Campaigns */}
        <CampaignsSection
          campaigns={campaigns}
          loading={campaignsLoading}
          error={campaignsError}
        />

        {/* Units Table */}
        <UnitsTable
          units={units}
          loading={unitsLoading}
          error={unitsError}
          canEdit={canEdit}
          onAddUnit={openAddUnitDialog}
          onEditUnit={openEditUnitDialog}
          onUnitClick={(unitId) => navigate(`/units/${unitId}`)}
        />

        {/* Sessions Table */}
        <LocationSessionsTable
          sessions={filteredSessions}
          units={units}
          loading={sessionsLoading}
          error={sessionsError}
          dateFilter={sessionsDateFilter}
          onDateFilterChange={setSessionsDateFilter}
          unitFilter={sessionsUnitFilter}
          onUnitFilterChange={setSessionsUnitFilter}
          inProgressOnly={sessionsInProgressOnly}
          onInProgressOnlyChange={setSessionsInProgressOnly}
          onSessionClick={handleSessionClick}
        />

        {/* Dialogs and Drawer */}
        <EditLocationDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          location={location}
          onSubmit={handleLocationSubmit}
        />

        <EditUnitDialog
          open={isUnitDialogOpen}
          onOpenChange={setIsUnitDialogOpen}
          mode={unitDialogMode}
          unit={selectedUnit}
          onSubmit={handleUnitSubmit}
        />

        <EditImagesDialog
          open={imagesDialogOpen}
          onOpenChange={setImagesDialogOpen}
          currentImages={location.images || []}
          onSubmit={handleImagesSubmit}
        />

        <SessionDetailDrawer
          open={sessionDetailOpen}
          onOpenChange={setSessionDetailOpen}
          session={selectedSession}
          location={location}
        />
      </div>
    </>
  );
}
