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

import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Grid,
  Stack,
  Button,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import { QRCodeSVG } from "qrcode.react";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";

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
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Campaign
          </Typography>
          <Typography color="error">No campaign ID</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (loading && !isCreateMode) {
    return (
      <MainLayout>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!isCreateMode && (error || !campaign)) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Campaign
          </Typography>
          <Typography color="error">
            {error ?? "Campaign not found"}
          </Typography>
        </Box>
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
          <Typography variant="h4">
            {isCreateMode ? "New campaign" : displayCampaign.name}
          </Typography>
          {!isCreateMode && (
            <Chip
              label={displayCampaign.active ? "Active" : "Inactive"}
              size="small"
              color={displayCampaign.active ? "success" : "default"}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`Brand: ${displayCampaign.brandId}`}
            size="small"
            variant="outlined"
          />
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={openEditDialog}
          >
            {isCreateMode ? "Create campaign" : "Edit campaign"}
          </Button>
        </Stack>
      </Box>

      {/* Info + summary */}
      {!isCreateMode && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Campaign info card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Campaign info
                </Typography>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Brand
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.brandId}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.description || "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Locations (IDs)
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.locationIds.length > 0
                      ? displayCampaign.locationIds.join(", ")
                      : "—"}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Short URL (legacy)
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.url || "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Target URL
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.targetUrl || "—"}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(displayCampaign.createdAt)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Last updated
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(displayCampaign.updatedAt)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Engagement summary card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Engagement summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Stored counter
                    </Typography>
                    <Typography variant="h4">
                       {totalStoreEngagements}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sum of <code>engagements</code> across all store campaigns
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Loaded events
                    </Typography>
                    <Typography variant="h4">{events.length}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last {events.length} events from{" "}
                      <code>engagements</code> sub-collection
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  OS breakdown (last {events.length} scans)
                </Typography>

                {osStats.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Not enough engagement data yet to show OS distribution.
                  </Typography>
                ) : (
                  <Box sx={{ mt: 0.5 }}>
                    {osStats.map((stat) => (
                      <Stack
                        key={stat.key}
                        direction="row"
                        justifyContent="space-between"
                        sx={{ py: 0.3 }}
                      >
                        <Typography variant="body2">
                          {stat.label}
                        </Typography>
                        <Typography variant="body2">
                          {stat.count} ({stat.percent}%)
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Locations running this campaign */}
      {!isCreateMode && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Locations running this campaign
          </Typography>

          {storeCampaignsLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {storeCampaignsError && (
            <Typography color="error" sx={{ mt: 1 }}>
              {storeCampaignsError}
            </Typography>
          )}

          {!storeCampaignsLoading &&
            !storeCampaignsError &&
            storeCampaigns.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                No store-level campaign documents found for this campaign yet.
                New campaigns created or edited with locations will automatically
                populate this section.
              </Typography>
            )}

          {!storeCampaignsLoading &&
            !storeCampaignsError &&
            storeCampaigns.length > 0 && (
              <TableContainer
                component={Paper}
                sx={{
                  mb: 3,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Location</TableCell>
                      <TableCell>City</TableCell>
                      <TableCell>QR link</TableCell>
                      <TableCell align="center">QR</TableCell>
                      <TableCell align="right">Engagements</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {storeCampaigns.map((row) => {
                      const name =
                        row.locationBrand && row.locationStoreLocation
                          ? `${row.locationBrand} – ${row.locationStoreLocation}`
                          : row.locationName ?? row.locationId ?? "—";

                      const qr = row.qrCode;

                      return (
                        <TableRow key={row.id}>
                          <TableCell>{name}</TableCell>
                          <TableCell>
                            {row.locationCity ?? "—"}
                          </TableCell>
                          <TableCell>
                            {qr ? (
                              <Typography
                                variant="caption"
                                sx={{ wordBreak: "break-all" }}
                                color="text.secondary"
                              >
                                {qr}
                              </Typography>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {qr ? (
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  p: 0.5,
                                  borderRadius: 1,
                                  border: "1px solid",
                                  borderColor: "divider",
                                  bgcolor: "background.paper",
                                }}
                              >
                                <QRCodeSVG value={qr} size={64} />
                              </Box>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {row.engagements}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.active ? "Active" : "Inactive"}
                              size="small"
                              color={row.active ? "success" : "default"}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
        </Box>
      )}

      {/* Recent engagement events */}
      {!isCreateMode && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent engagement events
          </Typography>

          {eventsLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {eventsError && (
            <Typography color="error" sx={{ mt: 1 }}>
              {eventsError}
            </Typography>
          )}

          {!eventsLoading && !eventsError && (
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
                    <TableCell>Device brand</TableCell>
                    <TableCell>Device name</TableCell>
                    <TableCell>OS</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>{formatDateTime(ev.createdAt)}</TableCell>
                      <TableCell>{ev.deviceBrand ?? "—"}</TableCell>
                      <TableCell>{ev.deviceName ?? "—"}</TableCell>
                      <TableCell>{ev.deviceOS ?? "—"}</TableCell>
                      <TableCell>{ev.deviceType ?? "—"}</TableCell>
                    </TableRow>
                  ))}

                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          align="center"
                          variant="body2"
                          sx={{ py: 2 }}
                          color="text.secondary"
                        >
                          No engagement events recorded yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Edit / Create dialog */}
      <Dialog
        open={editOpen}
        onClose={closeEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isCreateMode ? "Create campaign" : "Edit campaign"}
        </DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            {editForm && (
              <>
                <TextField
                  label="Name"
                  fullWidth
                  margin="normal"
                  value={editForm.name}
                  onChange={handleEditChange("name")}
                  required
                />
                <TextField
                  label="Description"
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={2}
                  value={editForm.description}
                  onChange={handleEditChange("description")}
                />
                <TextField
                  label="Target URL"
                  fullWidth
                  margin="normal"
                  value={editForm.targetUrl}
                  onChange={handleEditChange("targetUrl")}
                />
                <TextField
                  label="Short URL (QR - legacy)"
                  fullWidth
                  margin="normal"
                  value={editForm.url}
                  onChange={handleEditChange("url")}
                  helperText="Legacy short link; store-level QR URLs now come from locations."
                />

                <FormControl fullWidth margin="normal" size="small">
                  <InputLabel id="locations-label">Locations</InputLabel>
                  <Select
                    labelId="locations-label"
                    label="Locations"
                    multiple
                    value={editForm.locationIds}
                    onChange={handleLocationsChange as any}
                    renderValue={(selected) => {
                      const ids = selected as string[];
                      const names = ids
                        .map(
                          (id) =>
                            locations.find((l) => l.id === id)?.name ?? id
                        )
                        .join(", ");
                      return names;
                    }}
                  >
                    {locations.map((loc) => (
                      <MenuItem key={loc.id} value={loc.id}>
                        <Checkbox
                          checked={editForm.locationIds.includes(loc.id)}
                        />
                        <Typography variant="body2">
                          {loc.name}
                          {loc.storeLocation
                            ? ` – ${loc.storeLocation}`
                            : ""}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ mt: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.active}
                        onChange={handleEditChange("active")}
                      />
                    }
                    label="Active"
                  />
                </Box>

                {editError && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {editError}
                  </Typography>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditDialog} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={editSaving}>
              {editSaving
                ? "Saving..."
                : isCreateMode
                ? "Create campaign"
                : "Save changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </MainLayout>
  );
}