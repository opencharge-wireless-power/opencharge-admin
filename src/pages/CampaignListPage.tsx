// src/pages/CampaignListPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  doc,
  setDoc,
  type DocumentData,
  type Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Plus} from "lucide-react";
import { PulseLoader } from "@/components/common/loading/pulse-loader";
import { PageHeader } from "../components/layout/PageHeader";

import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { NewBrandDialog } from "@/components/campaigns/NewBrandDialog";
import { NewCampaignDialog } from "@/components/campaigns/NewCampaignDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Brand {
  id: string;
  name: string;
}

interface LocationItem {
  id: string;
  name: string;
  brand?: string;
  storeLocation?: string;
  qrCode?: string;
}

interface CampaignListItem {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  active: boolean;
  engagements: number;
  locationCount: number;
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/^-+|-+$/g, "");

// If a location doesn't have qrCode stored, fall back to derived one
function deriveQrCodeFromLocation(
  data: DocumentData,
  _id: string  // TODO: Check why id parameter is not used in deriveQrCodeFromLocation
): string | undefined {
  const brand = (data.brand as string | undefined) ?? "";
  const storeLocation = (data.storeLocation as string | undefined) ?? "";
  if (!brand || !storeLocation) return undefined;

  const brandSlug = slugify(brand);
  const storeSlug = slugify(storeLocation);
  if (!brandSlug || !storeSlug) return undefined;

  return `https://opencharge.io/e/${brandSlug}/${storeSlug}`;
}

export function CampaignListPage() {
  const navigate = useNavigate();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");

  const [locations, setLocations] = useState<LocationItem[]>([]);

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New brand dialog
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);

  // New campaign dialog
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

  // ---------- Load brands once ----------
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setLoadingBrands(true);
        setError(null);

        const snap = await getDocs(collection(db, "engage"));
        const items: Brand[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? docSnap.id,
          };
        });

        items.sort((a, b) => a.name.localeCompare(b.name));
        setBrands(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load brands";
        setError(message);
      } finally {
        setLoadingBrands(false);
      }
    };

    void fetchBrands();
  }, []);

  // ---------- Load locations once ----------
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const snap = await getDocs(collection(db, "locations"));
        const items: LocationItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const explicitQr = data.qrCode as string | undefined;
          const derivedQr = deriveQrCodeFromLocation(data, docSnap.id);

          return {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? docSnap.id,
            brand: data.brand as string | undefined,
            storeLocation: data.storeLocation as string | undefined,
            qrCode: explicitQr ?? derivedQr,
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

  // ---------- Load campaigns when brand filter changes ----------
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (loadingBrands) return;

      try {
        setLoadingCampaigns(true);
        setError(null);

        const items: CampaignListItem[] = [];
        const brandMap = new Map(brands.map((b) => [b.id, b.name]));

        const loadBrandCampaigns = async (brandId: string) => {
          const campaignsRef = collection(db, "engage", brandId, "campaigns");
          const q = query(campaignsRef, orderBy("createdAt", "desc"));
          const snap = await getDocs(q);

          snap.docs.forEach((docSnap) => {
            const data = docSnap.data() as DocumentData;
            const createdTs = data.createdAt as Timestamp | undefined;

            items.push({
              id: docSnap.id,
              brandId,
              brandName: brandMap.get(brandId) ?? brandId,
              name: (data.name as string | undefined) ?? "Untitled campaign",
              active: (data.active as boolean | undefined) ?? false,
              engagements: (data.engagements as number | undefined) ?? 0,
              locationCount: Array.isArray(data.locationIds)
                ? data.locationIds.length
                : Array.isArray(data.locations)
                ? data.locations.length
                : 0,
              url: data.url as string | undefined,
              targetUrl: data.targetUrl as string | undefined,
              createdAt: createdTs ? createdTs.toDate() : undefined,
            });
          });
        };

        if (selectedBrandId === "all") {
          await Promise.all(brands.map((b) => loadBrandCampaigns(b.id)));
        } else {
          await loadBrandCampaigns(selectedBrandId);
        }

        items.sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? 0;
          const tb = b.createdAt?.getTime() ?? 0;
          return tb - ta;
        });

        setCampaigns(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load campaigns";
        setError(message);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    void fetchCampaigns();
  }, [selectedBrandId, brands, loadingBrands]);

  // ---------- Brand selection ----------
  const handleBrandChange = (value: string) => {
    setSelectedBrandId(value);
  };

  // ---------- New brand dialog ----------
  const handleCreateBrand = async (brandName: string) => {
    // Use brand name as document ID (can be updated to slug later)
    const brandId = brandName;
    const brandRef = doc(db, "engage", brandId);
    await setDoc(brandRef, {
      name: brandName,
      createdAt: serverTimestamp(),
    });

    const newBrand: Brand = {
      id: brandId,
      name: brandName,
    };

    setBrands((prev) => {
      const next = [...prev, newBrand];
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });

    setSelectedBrandId(brandId);
    setBrandDialogOpen(false);
  };

  // ---------- New campaign dialog ----------
  const handleCreateCampaign = async (data: {
    name: string;
    description: string;
    targetUrl: string;
    active: boolean;
    locationIds: string[];
  }) => {
    if (!selectedBrandId || selectedBrandId === "all") {
      throw new Error("Please select a brand first");
    }

    // 1) Create brand-level campaign (no QR URL here – QR comes from locations)
    const campaignsRef = collection(
      db,
      "engage",
      selectedBrandId,
      "campaigns"
    );
    const docRef = await addDoc(campaignsRef, {
      name: data.name,
      description: data.description,
      active: data.active,
      engagements: 0,
      locationIds: data.locationIds,
      // url intentionally omitted: QR is location-specific
      targetUrl: data.targetUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const campaignId = docRef.id;

    // 2) For each selected location, create a store-level Engage campaign doc
    for (const locId of data.locationIds) {
      const loc = locations.find((l) => l.id === locId);
      if (!loc || !loc.brand || !loc.storeLocation) {
        continue; // skip if we don't have enough info
      }

      const brandSlug = slugify(loc.brand);
      const storeSlug = slugify(loc.storeLocation);

      const storeCampaignsRef = collection(
        db,
        "engage",
        brandSlug,
        "stores",
        storeSlug,
        "campaigns"
      );

      // QR URL should come from location.qrCode
      const qrUrl = loc.qrCode ?? undefined;

      await addDoc(storeCampaignsRef, {
        campaignId,
        name: data.name,
        active: data.active,
        engagements: 0,
        url: qrUrl ?? null,
        targetUrl: data.targetUrl || null,
        locationId: loc.id,
        brandSlug,
        storeSlug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    setCampaignDialogOpen(false);

    // Navigate to the new campaign detail page (include brandId)
    navigate(`/campaigns/${selectedBrandId}/${docRef.id}`);
  };

  const isLoading = loadingBrands || loadingCampaigns;


  if (isLoading) {
    return (
    <>
      <PageHeader
        title="Campaigns"
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }]}
      />
      

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-2">
          {/* Pulsing circle */}
          <PulseLoader size={8} pulseCount={4} speed={1.5} />
        </div>
      </div>
    </>

    );
  }


  if (error) {
    return (
      <>
        <PageHeader
          title="Campaigns"
          breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }]}
        />
        <div className="">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <PageHeader
        title="Sessions"
        breadcrumbs={[{ label: "Sessions", href: "/sessions" }]}
      />


      
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">

        {/* Header section */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
            Manage advertiser campaigns and QR tracking.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedBrandId} onValueChange={handleBrandChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} ({b.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setBrandDialogOpen(true)}>
            New brand
          </Button>

          <Button
            onClick={() => setCampaignDialogOpen(true)}
            disabled={
              !selectedBrandId ||
              selectedBrandId === "all" ||
              brands.length === 0
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </Button>
        </div>
      

      {!isLoading && !error && (
        <CampaignsTable
          campaigns={campaigns}
          onCampaignClick={(campaign) =>
            navigate(`/campaigns/${campaign.brandId}/${campaign.id}`)
          }
          showBrandColumn={selectedBrandId === "all"}
        />
      )}

      </div>

      {/* Dialogs */}
      <NewBrandDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        onSubmit={handleCreateBrand}
      />

      <NewCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        onSubmit={handleCreateCampaign}
        locations={locations}
        brandId={selectedBrandId !== "all" ? selectedBrandId : null}
      />
    </>
  );
}