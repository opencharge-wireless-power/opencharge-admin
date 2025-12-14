// src/pages/CampaignDetailPage.tsx
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  addDoc,
  setDoc,
  type DocumentData,
  type Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PulseLoader } from "@/components/common/loading/pulse-loader";
import { RecentEngagementsTable } from "@/components/campaigns/RecentEngagementTable";
import { ArrowLeft, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { QRCodeSVG } from "qrcode.react";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";

const DEFAULT_BRAND_ID = "starbucks"; // fallback for legacy /campaigns/:id route

interface Campaign {
  id: string;
  brandId: string;
  name: string;
  description?: string;
  active: boolean;
  engagements: number;
  locationIds: string[];
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EngagementEvent {
  id: string;
  createdAt?: Date;
  deviceBrand?: string;
  deviceName?: string;
  deviceOS?: string;
  deviceType?: string;
  raw?: DocumentData;
}

interface EditFormState {
  name: string;
  description: string;
  targetUrl: string;
  url: string;
  active: boolean;
  locationIds: string[];
}

interface StoreCampaignRow {
  id: string;
  brandSlug?: string;
  storeSlug?: string;
  locationId?: string;
  engagements: number;
  active: boolean;
  url?: string;
  targetUrl?: string;
  createdAt?: Date;

  // joined from locations collection
  locationName?: string;
  locationCity?: string;
  locationBrand?: string;
  locationStoreLocation?: string;
  qrCode?: string;
}

interface LocationItem {
  id: string;
  name: string;
  brand?: string;
  storeLocation?: string;
  qrCode?: string;
}

interface OsStat {
  key: string;
  label: string;
  count: number;
  percent: number;
}

// Simple date helpers
function formatDate(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

const slugify = (value: string) =>
  value
    .normalize("NFD") // split accents from letters
    .replace(/[\u0300-\u036f]/g, "") // remove accents (ê -> e)
    .toLowerCase()
    .replace(/&/g, "and")
    // remove everything that is NOT a–z or 0–9
    // (this strips spaces, dashes, apostrophes, etc.)
    .replace(/[^a-z0-9]/g, "");

// If a location doesn't have qrCode stored, fall back to derived one
function deriveQrCodeFromLocation(
  data: DocumentData,
  id: string
): string | undefined {
  const brand = (data.brand as string | undefined) ?? "";
  const storeLocation = (data.storeLocation as string | undefined) ?? "";
  if (!brand || !storeLocation) return undefined;

  const brandSlug = slugify(brand);
  const storeSlug = slugify(storeLocation);
  if (!brandSlug || !storeSlug) return undefined;

  return `https://opencharge.io/e/${brandSlug}/${storeSlug}`;
}

// -------- OS breakdown from engagement events --------
function computeOsBreakdown(events: EngagementEvent[]): OsStat[] {
  if (!events || events.length === 0) return [];

  const counts: Record<string, number> = {};

  for (const ev of events) {
    const raw = (ev.deviceOS || ev.deviceType || "")
      .toString()
      .toLowerCase()
      .trim();

    let key: string;

    if (!raw) {
      key = "unknown";
    } else if (raw.includes("android")) {
      key = "android";
    } else if (raw.includes("ios") || raw.includes("iphone") || raw.includes("ipad")) {
      key = "ios";
    } else if (raw.includes("windows")) {
      key = "windows";
    } else if (raw.includes("mac")) {
      key = "mac";
    } else {
      key = "other";
    }

    counts[key] = (counts[key] || 0) + 1;
  }

  const total = events.length;
  const labels: Record<string, string> = {
    android: "Android",
    ios: "iOS",
    windows: "Windows",
    mac: "macOS",
    other: "Other",
    unknown: "Unknown",
  };

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: labels[key] ?? key,
      count,
      percent: Math.round((count / total) * 100),
    }));
}

export function InfoItem({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}

export function CampaignDetailPage() {
  // Support both new style /campaigns/:brandId/:campaignId
  // and legacy /campaigns/:id
  const params = useParams<{
    brandId?: string;
    campaignId?: string;
    id?: string;
  }>();

  const navigate = useNavigate();

  const brandIdParam = params.brandId;
  const campaignIdParam = params.campaignId;
  const legacyId = params.id;

  // Effective IDs we actually use
  const effectiveCampaignId = campaignIdParam ?? legacyId ?? null;
  const effectiveBrandId =
    brandIdParam ?? (legacyId ? DEFAULT_BRAND_ID : null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Engagements list
  const [events, setEvents] = useState<EngagementEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Per-location store campaigns
  const [storeCampaigns, setStoreCampaigns] = useState<StoreCampaignRow[]>([]);
  const [storeCampaignsLoading, setStoreCampaignsLoading] = useState(true);
  const [storeCampaignsError, setStoreCampaignsError] =
    useState<string | null>(null);

  // Locations list (for dropdown)
  const [locations, setLocations] = useState<LocationItem[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isCreateMode = effectiveCampaignId === "new";

   // Sum of engagements across all store-level campaign docs
  const totalStoreEngagements = storeCampaigns.reduce(
    (sum, row) =>
      sum + (typeof row.engagements === "number" ? row.engagements : 0),
    0
  );

  // --------- Load all locations (for dropdown + QR + slugs) ----------
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const snap = await getDocs(collection(db, "locations"));
        const items: LocationItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? docSnap.id,
            brand: data.brand as string | undefined,
            storeLocation: data.storeLocation as string | undefined,
            qrCode: (data.qrCode as string | undefined) ??
              deriveQrCodeFromLocation(data, docSnap.id),
          };
        });
        items.sort((a, b) => a.name.localeCompare(b.name));
        setLocations(items);
      } catch (err) {
        console.error("Failed to load locations", err);
      }
    };

    void fetchLocations();
  }, []);

  // --------- Load campaign (view / edit existing) ----------
  useEffect(() => {
    const load = async () => {
      if (!effectiveBrandId || !effectiveCampaignId || isCreateMode) {
        // In create mode we don't load an existing doc
        if (!isCreateMode && (!effectiveBrandId || !effectiveCampaignId)) {
          setError("No campaign ID");
          setLoading(false);
        } else {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const ref = doc(
          db,
          "engage",
          effectiveBrandId,
          "campaigns",
          effectiveCampaignId
        );
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Campaign not found");
          setLoading(false);
          return;
        }

        const data = snap.data() as DocumentData;

        const createdRaw =
          (data.createdAt as Timestamp | undefined) ??
          (data.createAt as Timestamp | undefined); // handle older typo
        const updatedRaw = data.updatedAt as Timestamp | undefined;

        const createdAt = createdRaw ? createdRaw.toDate() : undefined;
        const updatedAt = updatedRaw ? updatedRaw.toDate() : undefined;

        const locationIds: string[] = Array.isArray(data.locationIds)
          ? (data.locationIds as string[])
          : Array.isArray(data.locations)
          ? (data.locations as string[])
          : [];

        const c: Campaign = {
          id: snap.id,
          brandId: effectiveBrandId,
          name: (data.name as string | undefined) ?? "Untitled campaign",
          description: data.description as string | undefined,
          active: (data.active as boolean | undefined) ?? false,
          engagements: (data.engagements as number | undefined) ?? 0,
          locationIds,
          url: data.url as string | undefined,
          targetUrl: data.targetUrl as string | undefined,
          createdAt,
          updatedAt,
        };

        setCampaign(c);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load campaign";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [effectiveBrandId, effectiveCampaignId, isCreateMode]);

// --------- Load engagement events based on store-level campaigns ----------
useEffect(() => {
  const loadEvents = async () => {
    if (isCreateMode) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    // If we don't yet have store campaigns, nothing to load
    if (!storeCampaigns || storeCampaigns.length === 0) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    try {
      setEventsLoading(true);
      setEventsError(null);

      const allEvents: EngagementEvent[] = [];

      for (const row of storeCampaigns) {
        if (!row.brandSlug || !row.storeSlug) continue;

        const engagementsRef = collection(
          db,
          "engage",
          row.brandSlug,
          "stores",
          row.storeSlug,
          "campaigns",
          row.id,
          "engagements"
        );

        // Fetch up to 100 events per store (tweak if you want)
        const snap = await getDocs(query(engagementsRef, limit(100)));

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const tsRaw =
            data.timeStamp as number | Timestamp | undefined | null;
          const createdRaw = data.createdAt as Timestamp | undefined;

          let createdAt: Date | undefined;

          if (typeof tsRaw === "number") {
            createdAt = new Date(tsRaw);
          } else if (tsRaw && typeof (tsRaw as Timestamp).toDate === "function") {
            createdAt = (tsRaw as Timestamp).toDate();
          } else if (
            createdRaw &&
            typeof (createdRaw as Timestamp).toDate === "function"
          ) {
            createdAt = (createdRaw as Timestamp).toDate();
          }

          allEvents.push({
            id: docSnap.id,
            createdAt,
            deviceBrand: data.deviceBrand as string | undefined,
            deviceName: data.deviceName as string | undefined,
            deviceOS: data.deviceOS as string | undefined,
            deviceType: data.deviceType as string | undefined,
            raw: data,
          });
        });
      }

      // Newest first
      allEvents.sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        return tb - ta;
      });

      setEvents(allEvents);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load engagement events";
      setEventsError(msg);
    } finally {
      setEventsLoading(false);
    }
  };

  void loadEvents();
}, [storeCampaigns, isCreateMode]);

  // --------- Load per-location store campaigns ----------
  useEffect(() => {
    const loadStoreCampaigns = async () => {
      if (!effectiveCampaignId || isCreateMode) {
        setStoreCampaignsLoading(false);
        return;
      }

      try {
        setStoreCampaignsLoading(true);
        setStoreCampaignsError(null);

        // 1) Fetch all store-level campaign docs that reference this campaignId
        const cgRef = collectionGroup(db, "campaigns");
        const qStores = query(
          cgRef,
          where("campaignId", "==", effectiveCampaignId)
        );
        const snap = await getDocs(qStores);

        const baseRows: StoreCampaignRow[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const createdTs = data.createdAt as Timestamp | undefined;

          return {
            id: docSnap.id,
            brandSlug: data.brandSlug as string | undefined,
            storeSlug: data.storeSlug as string | undefined,
            locationId: data.locationId as string | undefined,
            engagements:
              typeof data.engagements === "number" ? data.engagements : 0,
            active: (data.active as boolean | undefined) ?? false,
            url: data.url as string | undefined,
            targetUrl: data.targetUrl as string | undefined,
            createdAt: createdTs ? createdTs.toDate() : undefined,
          };
        });

        if (baseRows.length === 0) {
          setStoreCampaigns([]);
          setStoreCampaignsLoading(false);
          return;
        }

        // 2) Fetch location metadata for each distinct locationId
        const locationIds = Array.from(
          new Set(
            baseRows
              .map((r) => r.locationId)
              .filter((id): id is string => !!id)
          )
        );

        const locationMap = new Map<
          string,
          {
            name: string;
            city?: string;
            brand?: string;
            storeLocation?: string;
            qrCode?: string;
          }
        >();

        for (const locId of locationIds) {
          const locRef = doc(db, "locations", locId);
          const locSnap = await getDoc(locRef);
          if (!locSnap.exists()) continue;

          const data = locSnap.data() as DocumentData;
          const explicitQr = data.qrCode as string | undefined;
          const derivedQr = deriveQrCodeFromLocation(data, locSnap.id);

          locationMap.set(locId, {
            name: (data.name as string | undefined) ?? locSnap.id,
            city: data.city as string | undefined,
            brand: data.brand as string | undefined,
            storeLocation: data.storeLocation as string | undefined,
            qrCode: explicitQr ?? derivedQr,
          });
        }

        // 3) Enrich rows with location meta
        const enriched = baseRows.map((row) => {
          const meta = row.locationId ? locationMap.get(row.locationId) : undefined;
          return {
            ...row,
            locationName: meta?.name,
            locationCity: meta?.city,
            locationBrand: meta?.brand,
            locationStoreLocation: meta?.storeLocation,
            qrCode: meta?.qrCode ?? row.url,
          };
        });

        // Sort by engagements desc
        enriched.sort((a, b) => b.engagements - a.engagements);

        setStoreCampaigns(enriched);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load location breakdown";
        setStoreCampaignsError(msg);
      } finally {
        setStoreCampaignsLoading(false);
      }
    };

    void loadStoreCampaigns();
  }, [effectiveCampaignId, isCreateMode]);

  // --------- Helper to sync store-level campaign docs to locations ----------
// Uses existing storeCampaigns state so we don't create duplicates
const syncStoreCampaignDocs = async (
  campaignId: string,
  campaignName: string,
  active: boolean,
  targetUrl: string,
  newLocationIds: string[],
  previousLocationIds: string[]
) => {
  const newSet = new Set(newLocationIds);

  const ops: Promise<unknown>[] = [];

  // 1) For every location currently selected on the campaign
  for (const locId of newLocationIds) {
    const locMeta = locations.find((l) => l.id === locId);
    if (!locMeta) continue;

    // Any existing store-level docs for THIS campaign + location?
    const existingRowsForLoc = storeCampaigns.filter(
      (r) => r.locationId === locId
    );

    const brandSlug =
      locMeta.brand
        ? slugify(locMeta.brand)
        : existingRowsForLoc[0]?.brandSlug;
    const storeSlug =
      locMeta.storeLocation
        ? slugify(locMeta.storeLocation)
        : existingRowsForLoc[0]?.storeSlug;

    if (!brandSlug || !storeSlug) continue;

    const qr =
      locMeta.qrCode ?? `https://opencharge.io/e/${brandSlug}/${storeSlug}`;

    if (existingRowsForLoc.length > 0) {
      // ---- Existing store doc(s): UPDATE, don't create new ----
      for (const row of existingRowsForLoc) {
        const ref = doc(
          db,
          "engage",
          brandSlug,
          "stores",
          storeSlug,
          "campaigns",
          row.id // keep the original doc id so engagement counter continues
        );

        ops.push(
          setDoc(
            ref,
            {
              campaignId,
              name: campaignName,
              active,
              targetUrl: targetUrl || null,
              url: qr,
              brandSlug,
              storeSlug,
              locationId: locMeta.id,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
        );
      }
    } else {
      // ---- Brand-new location for this campaign: create one doc ----
      const ref = doc(
        db,
        "engage",
        brandSlug,
        "stores",
        storeSlug,
        "campaigns",
        campaignId // use campaignId as doc id for new ones
      );

      ops.push(
        setDoc(
          ref,
          {
            campaignId,
            name: campaignName,
            active,
            targetUrl: targetUrl || null,
            url: qr,
            brandSlug,
            storeSlug,
            locationId: locMeta.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }
  }

  // 2) Locations that were previously linked but are NOW REMOVED:
  //    mark all their existing store docs as inactive (do NOT create new ones)
  for (const prevId of previousLocationIds) {
    if (newSet.has(prevId)) continue; // still selected, handled above

    const rows = storeCampaigns.filter((r) => r.locationId === prevId);
    for (const row of rows) {
      if (!row.brandSlug || !row.storeSlug) continue;

      const ref = doc(
        db,
        "engage",
        row.brandSlug,
        "stores",
        row.storeSlug,
        "campaigns",
        row.id
      );

      ops.push(
        setDoc(
          ref,
          {
            active: false,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }
  }

  if (ops.length > 0) {
    await Promise.all(ops);
  }
};

  // --------- Edit / create dialog helpers ----------
  const openEditDialog = () => {
    // For create mode, open with empty defaults
    if (isCreateMode) {
      const form: EditFormState = {
        name: "",
        description: "",
        targetUrl: "",
        url: "",
        active: true,
        locationIds: [],
      };
      setEditForm(form);
      setEditError(null);
      setEditOpen(true);
      return;
    }

    if (!campaign) return;
    const form: EditFormState = {
      name: campaign.name,
      description: campaign.description ?? "",
      targetUrl: campaign.targetUrl ?? "",
      url: campaign.url ?? "",
      active: campaign.active,
      locationIds: campaign.locationIds ?? [],
    };
    setEditForm(form);
    setEditError(null);
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    if (editSaving) return;
    setEditOpen(false);
  };

  const handleEditChange =
    (field: keyof EditFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!editForm) return;

      if (field === "active") {
        setEditForm({ ...editForm, active: (e.target as any).checked });
      } else {
        setEditForm({ ...editForm, [field]: e.target.value });
      }
    };

  const handleLocationsChange = (e: ChangeEvent<{ value: unknown }>) => {
    if (!editForm) return;
    const value = e.target.value as string[];
    setEditForm({
      ...editForm,
      locationIds: value,
    });
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!effectiveBrandId || !editForm) return;

    try {
      setEditSaving(true);
      setEditError(null);

      const locationsSelected = editForm.locationIds ?? [];

      const baseData: Record<string, unknown> = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        targetUrl: editForm.targetUrl.trim() || null,
        url: editForm.url.trim() || null,
        active: editForm.active,
        locationIds: locationsSelected,
      };

      if (isCreateMode) {
        // Create new campaign (brand-level)
        const campaignsRef = collection(
          db,
          "engage",
          effectiveBrandId,
          "campaigns"
        );
        const newDocRef = await addDoc(campaignsRef, {
          ...baseData,
          engagements: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Create store-level campaign docs for selected locations
        await syncStoreCampaignDocs(
          newDocRef.id,
          editForm.name.trim(),
          editForm.active,
          editForm.targetUrl.trim(),
          locationsSelected,
          []
        );

        // After creating, navigate to real detail page
        navigate(`/campaigns/${effectiveBrandId}/${newDocRef.id}`, {
          replace: true,
        });
      } else if (effectiveCampaignId && campaign) {
        // Update existing campaign
        const updates: Record<string, unknown> = {
          ...baseData,
          updatedAt: serverTimestamp(),
        };

        const ref = doc(
          db,
          "engage",
          effectiveBrandId,
          "campaigns",
          effectiveCampaignId
        );
        await updateDoc(ref, updates);

        // Sync store-level docs (new + removed locations)
        await syncStoreCampaignDocs(
          effectiveCampaignId,
          editForm.name.trim(),
          editForm.active,
          editForm.targetUrl.trim(),
          locationsSelected,
          campaign.locationIds ?? []
        );

        const updatedCampaign: Campaign = {
          ...campaign,
          name: updates.name as string,
          description:
            (updates.description as string | null) ?? undefined,
          targetUrl:
            (updates.targetUrl as string | null) ?? undefined,
          url: (updates.url as string | null) ?? undefined,
          active: updates.active as boolean,
          locationIds: locationsSelected,
          updatedAt: new Date(),
        };

        setCampaign(updatedCampaign);
      }

      setEditOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save campaign";
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  // --------- Render guards ----------

    if (!effectiveBrandId || !effectiveCampaignId) {
      return (
        <MainLayout>
          <div className="mt-6 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Campaign</h1>
            <p className="text-sm text-destructive">No campaign ID</p>
          </div>
        </MainLayout>
      );
    }

    if (loading && !isCreateMode) {
      return (
        <MainLayout>
          <div className="flex justify-center mt-10">
            <PulseLoader size={8} pulseCount={4} speed={1.5} />
          </div>
        </MainLayout>
      );
    }

    if (!isCreateMode && (error || !campaign)) {
      return (
        <MainLayout>
          <div className="mt-6 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Campaign</h1>
            <p className="text-sm text-destructive">
              {error ?? "Campaign not found"}
            </p>
          </div>
        </MainLayout>
      );
    }


  // --------- Main UI ----------
  const displayCampaign = campaign ?? {
    // minimal dummy when in create mode so layout still works
    id: "new",
    brandId: effectiveBrandId,
    name: "New campaign",
    active: true,
    engagements: 0,
    locationIds: [],
  } as Campaign;

  const osStats = computeOsBreakdown(events);

  return (
    <>
      <PageHeader
        title="Campaign"
        breadcrumbs={[
          { label: "Campaigns", href: "/campaigns" },
          { label: displayCampaign.name },
        ]}
      />
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left */}
        <div className="flex items-center gap-3 flex-wrap">
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
            {isCreateMode ? "New campaign" : displayCampaign.name}
          </h1>

          {!isCreateMode && (
            <Badge
              variant={displayCampaign.active ? "default" : "secondary"}
            >
              {displayCampaign.active ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">
            Brand: {displayCampaign.brandId}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={openEditDialog}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            {isCreateMode ? "Create campaign" : "Edit campaign"}
          </Button>
        </div>
      </div>
      {/* Info + summary */}
      {!isCreateMode && (
       <div className="grid gap-4 md:grid-cols-2 mb-6">
       {/* Campaign info */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Campaign info
            </CardTitle>
          </CardHeader>
      
          <CardContent className="space-y-4 text-sm">
            <InfoItem
              label="Brand"
              value={displayCampaign.brandId}
            />
      
            <InfoItem
              label="Description"
              value={displayCampaign.description || "—"}
            />
      
            <InfoItem
              label="Locations (IDs)"
              value={
                displayCampaign.locationIds.length > 0
                  ? displayCampaign.locationIds.join(", ")
                  : "—"
              }
            />
      
            <Separator />
      
            <InfoItem
              label="Short URL (legacy)"
              value={displayCampaign.url || "—"}
            />
      
            <InfoItem
              label="Target URL"
              value={displayCampaign.targetUrl || "—"}
            />
      
            <Separator />
      
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                label="Created"
                value={formatDate(displayCampaign.createdAt)}
              />
              <InfoItem
                label="Last updated"
                value={formatDate(displayCampaign.updatedAt)}
              />
            </div>
          </CardContent>
        </Card>
      
        {/* Engagement summary */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Engagement summary
            </CardTitle>
          </CardHeader>
      
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Stored counter
                </p>
                <p className="text-3xl font-bold">
                  {totalStoreEngagements}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sum of <code className="px-1 py-0.5 rounded bg-muted">engagements</code>{" "}
                  across all store campaigns
                </p>
              </div>
      
              <div>
                <p className="text-sm text-muted-foreground">
                  Loaded events
                </p>
                <p className="text-3xl font-bold">
                  {events.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last {events.length} events from{" "}
                  <code className="px-1 py-0.5 rounded bg-muted">engagements</code>{" "}
                  sub-collection
                </p>
              </div>
            </div>
      
            <Separator />
      
            <div className="space-y-2">
              <p className="text-sm font-medium">
                OS breakdown (last {events.length} scans)
              </p>
      
              {osStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough engagement data yet to show OS distribution.
                </p>
              ) : (
                <div className="space-y-1">
                  {osStats.map((stat) => (
                    <div
                      key={stat.key}
                      className="flex justify-between text-sm"
                    >
                      <span>{stat.label}</span>
                      <span className="text-muted-foreground">
                        {stat.count} ({stat.percent}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
     </div>
     
      )}

      {/* Locations running this campaign */}
      {!isCreateMode && (
       <div className="mb-6">
       <h2 className="text-lg font-medium mb-3">
         Locations running this campaign
       </h2>
     
       {/* Loading */}
       {storeCampaignsLoading && (
         <div className="flex justify-center mt-2">
           <PulseLoader size={8} pulseCount={4} speed={1.5} />
         </div>
       )}
     
       {/* Error */}
       {storeCampaignsError && (
         <p className="text-destructive mt-1">{storeCampaignsError}</p>
       )}
     
       {/* Empty */}
       {!storeCampaignsLoading &&
         !storeCampaignsError &&
         storeCampaigns.length === 0 && (
           <p className="text-sm text-muted-foreground mt-1">
             No store-level campaign documents found for this campaign yet.
             New campaigns created or edited with locations will automatically
             populate this section.
           </p>
         )}
     
       {/* Table */}
       {!storeCampaignsLoading &&
         !storeCampaignsError &&
         storeCampaigns.length > 0 && (
           <div className="overflow-x-auto mt-3">
             <table className="w-full text-sm border border-divider rounded-lg">
               <thead className="bg-muted">
                 <tr>
                   <th className="p-2 text-left">Location</th>
                   <th className="p-2 text-left">City</th>
                   <th className="p-2 text-left">QR link</th>
                   <th className="p-2 text-center">QR</th>
                   <th className="p-2 text-right">Engagements</th>
                   <th className="p-2 text-left">Status</th>
                 </tr>
               </thead>
               <tbody>
                 {storeCampaigns.map((row) => {
                   const name =
                     row.locationBrand && row.locationStoreLocation
                       ? `${row.locationBrand} – ${row.locationStoreLocation}`
                       : row.locationName ?? row.locationId ?? "—";
     
                   const qr = row.qrCode;
     
                   return (
                     <tr key={row.id} className="border-t border-divider">
                       <td className="p-2">{name}</td>
                       <td className="p-2">{row.locationCity ?? "—"}</td>
                       <td className="p-2 break-words text-muted-foreground">
                         {qr ?? "—"}
                       </td>
                       <td className="p-2 text-center">
                         {qr ? (
                           <div className="inline-flex p-1 border border-divider rounded bg-background">
                             <QRCodeSVG value={qr} size={64} />
                           </div>
                         ) : (
                           "—"
                         )}
                       </td>
                       <td className="p-2 text-right">{row.engagements}</td>
                       <td className="p-2">
                         <Badge variant={row.active ? "default" : "outline"}>
                          {row.active ? "Active" : "Inactive"}
                        </Badge>

                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
         )}
       </div>
     
      )}

      {/* Recent engagement events */}
      {!isCreateMode && (
        <>
       
        <RecentEngagementsTable
        events={events}
        loading={eventsLoading}
        error={eventsError ?? undefined}
      />


        </>
      )}

      {/* Edit / Create dialog */}
      <Dialog open={editOpen} onOpenChange={closeEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {isCreateMode ? "Create campaign" : "Edit campaign"}
              </DialogTitle>
            </DialogHeader>
  
            {editForm && (
              <>
                {/* Name */}
                <div className="flex flex-col">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editForm.name}
                    onChange={handleEditChange("name")}
                    required
                  />
                </div>
  
                {/* Description */}
                <div className="flex flex-col">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editForm.description}
                    onChange={handleEditChange("description")}
                    className="h-20"
                    multiline
                  />
                </div>
  
                {/* Target URL */}
                <div className="flex flex-col">
                  <Label htmlFor="targetUrl">Target URL</Label>
                  <Input
                    id="targetUrl"
                    value={editForm.targetUrl}
                    onChange={handleEditChange("targetUrl")}
                  />
                </div>
  
                {/* Short URL */}
                <div className="flex flex-col">
                  <Label htmlFor="url">Short URL (QR - legacy)</Label>
                  <Input
                    id="url"
                    value={editForm.url}
                    onChange={handleEditChange("url")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Legacy short link; store-level QR URLs now come from locations.
                  </p>
                </div>
  
                {/* Locations multi-select */}
                <div className="flex flex-col">
                  <Label>Locations</Label>
                  <div className="grid gap-1 max-h-40 overflow-auto border rounded p-2">
                    {locations.map((loc: any) => (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={editForm.locationIds.includes(loc.id)}
                          onCheckedChange={() => handleLocationsChange(loc.id)}
                        />
                        <span className="text-sm">
                          {loc.name}
                          {loc.storeLocation ? ` – ${loc.storeLocation}` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
  
                {/* Active switch */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editForm.active}
                    onCheckedChange={handleEditChange("active")}
                    id="active-switch"
                  />
                  <Label htmlFor="active-switch">Active</Label>
                </div>
  
                {/* Error */}
                {editError && (
                  <p className="text-sm text-destructive">{editError}</p>
                )}
  
                {/* Actions */}
                <DialogFooter className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeEditDialog} disabled={editSaving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving
                      ? "Saving..."
                      : isCreateMode
                      ? "Create campaign"
                      : "Save changes"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}