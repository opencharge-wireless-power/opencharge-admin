// src/pages/PromotionsPage.tsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { PageHeader } from "../components/layout/PageHeader";
import { PulseLoader } from "@/components/common/loading/pulse-loader";
import { useAuth } from "../hooks/useAuth";
import { Plus } from "lucide-react";

import { PromotionsTable } from "@/components/promotions/PromotionsTable";
import { PromotionDialog } from "@/components/promotions/PromotionsDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Promotion {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  locationId?: string;
  priorityWeight?: number;
  qrPayload?: string;
  redemptionCode?: string;
  redemptionType?: string;
  termsAndConditions?: string;
  validFrom?: Date;
  validTo?: Date;
}

interface PromotionFormData {
  title: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  locationId: string;
  priorityWeight: string;
  qrPayload: string;
  redemptionCode: string;
  redemptionType: string;
  termsAndConditions: string;
  validFrom: string;
  validTo: string;
}

interface LocationOption {
  id: string;
  name: string;
}

export function PromotionsPage() {
  const { role } = useAuth();
  const canEdit = role === "admin";
  const [searchParams] = useSearchParams();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Locations for dropdown
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  // Which location we are filtering by on the list view
  const [locationFilterId, setLocationFilterId] = useState<string>("all");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingPromotion, setEditingPromotion] = useState<
    Promotion | undefined
  >();

  // --- Read locationId from ?locationId=... when URL changes ---
  useEffect(() => {
    const locIdFromUrl = searchParams.get("locationId");
    if (locIdFromUrl) {
      setLocationFilterId(locIdFromUrl);
    }
  }, [searchParams]);

  // Fetch promotions + locations
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Promotions
        const promosRef = collection(db, "promotions");
        const promosSnapshot = await getDocs(promosRef);

        const promoItems: Promotion[] = promosSnapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const validFromRaw = data.validFrom as number | Timestamp | undefined;
          const validToRaw = data.validTo as number | Timestamp | undefined;

          let validFrom: Date | undefined;
          let validTo: Date | undefined;

          if (typeof validFromRaw === "number") {
            validFrom = new Date(validFromRaw);
          } else if (
            validFromRaw &&
            typeof (validFromRaw as Timestamp).toDate === "function"
          ) {
            validFrom = (validFromRaw as Timestamp).toDate();
          }

          if (typeof validToRaw === "number") {
            validTo = new Date(validToRaw);
          } else if (
            validToRaw &&
            typeof (validToRaw as Timestamp).toDate === "function"
          ) {
            validTo = (validToRaw as Timestamp).toDate();
          }

          return {
            id: docSnap.id,
            title: (data.title as string) ?? "Untitled promotion",
            description: data.description as string | undefined,
            imageUrl: data.imageUrl as string | undefined,
            isActive: (data.isActive as boolean | undefined) ?? false,
            locationId: data.locationId as string | undefined,
            priorityWeight:
              typeof data.priorityWeight === "number"
                ? (data.priorityWeight as number)
                : undefined,
            qrPayload: data.qrPayload as string | undefined,
            redemptionCode: data.redemptionCode as string | undefined,
            redemptionType: data.redemptionType as string | undefined,
            termsAndConditions:
              (data.termsAndConditions as string | undefined) ?? undefined,
            validFrom,
            validTo,
          };
        });

        // sort promotions
        promoItems.sort((a, b) => {
          if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1;
          }
          const pa = a.priorityWeight ?? 0;
          const pb = b.priorityWeight ?? 0;
          if (pb !== pa) return pb - pa;
          const da = a.validFrom?.getTime() ?? 0;
          const db = b.validFrom?.getTime() ?? 0;
          return db - da;
        });

        setPromotions(promoItems);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load promotions";
        setError(message);
      } finally {
        setLoading(false);
      }

      // Locations (for dropdowns)
      try {
        const locRef = collection(db, "locations");
        const locSnapshot = await getDocs(locRef);

        const locItems: LocationOption[] = locSnapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const name =
            (data.name as string | undefined) ??
            (data.address as string | undefined) ??
            docSnap.id;
          return {
            id: docSnap.id,
            name,
          };
        });

        // sort by name
        locItems.sort((a, b) => a.name.localeCompare(b.name));

        setLocationOptions(locItems);
        setLocationsError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load locations";
        setLocationsError(message);
      } finally {
        setLocationsLoading(false);
      }
    };

    void fetchData();
  }, []);

  const openAddDialog = () => {
    setDialogMode("add");
    setEditingPromotion(undefined);
    setDialogOpen(true);
  };

  const openEditDialog = (promo: Promotion) => {
    setDialogMode("edit");
    setEditingPromotion(promo);
    setDialogOpen(true);
  };

  const handleSubmit = async (form: PromotionFormData) => {
    const priorityNumber =
      form.priorityWeight.trim().length > 0
        ? Number(form.priorityWeight.trim())
        : null;

    const validFromMs =
      form.validFrom.trim().length > 0
        ? new Date(form.validFrom.trim()).getTime()
        : null;
    const validToMs =
      form.validTo.trim().length > 0
        ? new Date(form.validTo.trim()).getTime()
        : null;

    const baseData: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
      locationId: form.locationId.trim(),
      priorityWeight:
        priorityNumber !== null && !Number.isNaN(priorityNumber)
          ? priorityNumber
          : null,
      qrPayload: form.qrPayload.trim(),
      redemptionCode: form.redemptionCode.trim(),
      redemptionType: form.redemptionType.trim(),
      termsAndConditions: form.termsAndConditions.trim(),
      validFrom: validFromMs,
      validTo: validToMs,
    };

    if (dialogMode === "add") {
      const ref = await addDoc(collection(db, "promotions"), baseData);

      const newPromo: Promotion = {
        id: ref.id,
        title: baseData.title as string,
        description: baseData.description as string,
        imageUrl: baseData.imageUrl as string,
        isActive: baseData.isActive as boolean,
        locationId: baseData.locationId as string,
        priorityWeight:
          (baseData.priorityWeight as number | null) ?? undefined,
        qrPayload: baseData.qrPayload as string,
        redemptionCode: baseData.redemptionCode as string,
        redemptionType: baseData.redemptionType as string,
        termsAndConditions: baseData.termsAndConditions as string,
        validFrom:
          typeof baseData.validFrom === "number"
            ? new Date(baseData.validFrom)
            : undefined,
        validTo:
          typeof baseData.validTo === "number"
            ? new Date(baseData.validTo)
            : undefined,
      };

      setPromotions((prev) => [newPromo, ...prev]);
    } else if (dialogMode === "edit" && editingPromotion) {
      const ref = doc(db, "promotions", editingPromotion.id);
      await updateDoc(ref, baseData);

      setPromotions((prev) =>
        prev.map((p) =>
          p.id === editingPromotion.id
            ? {
                id: editingPromotion.id,
                title: baseData.title as string,
                description: baseData.description as string,
                imageUrl: baseData.imageUrl as string,
                isActive: baseData.isActive as boolean,
                locationId: baseData.locationId as string,
                priorityWeight:
                  (baseData.priorityWeight as number | null) ?? undefined,
                qrPayload: baseData.qrPayload as string,
                redemptionCode: baseData.redemptionCode as string,
                redemptionType: baseData.redemptionType as string,
                termsAndConditions: baseData.termsAndConditions as string,
                validFrom:
                  typeof baseData.validFrom === "number"
                    ? new Date(baseData.validFrom)
                    : undefined,
                validTo:
                  typeof baseData.validTo === "number"
                    ? new Date(baseData.validTo)
                    : undefined,
              }
            : p
        )
      );
    }

    setDialogOpen(false);
  };

  const getLocationName = (id?: string): string => {
    if (!id) return "-";
    const match = locationOptions.find((l) => l.id === id);
    return match ? match.name : id;
  };

  // --- Filtered promotions according to locationFilterId ---
  const filteredPromotions = promotions.filter((p) =>
    locationFilterId === "all" ? true : p.locationId === locationFilterId
  );

  if (loading) {
    return (
     
         <>
      <PageHeader
        title="Sessions"
        breadcrumbs={[{ label: "Sessions", href: "/sessions" }]}
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
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Promotions</h1>
          <div className="rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Promotions" breadcrumbs={[{ label: "Promotions", href: "/promotions" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Header section */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">
            Manage all promotions across locations.
            </p>
          </div>
          <div className="flex gap-2">
          {canEdit && (
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add promotion
            </Button>
          )}
          </div>
        </div>

        {/* Location Filter Warning */}
        {locationsError && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/10 p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Couldn't load locations for dropdown: {locationsError}
            </p>
          </div>
        )}

        {/* Filter by location */}
        <div className="flex items-center gap-2 max-w-xs">
          <Label htmlFor="location-filter" className="text-sm whitespace-nowrap">
            Filter by location
          </Label>
          <Select
            value={locationFilterId}
            onValueChange={setLocationFilterId}
          >
            <SelectTrigger id="location-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locationOptions.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Promotions Table */}
        <PromotionsTable
          promotions={filteredPromotions}
          onEdit={canEdit ? openEditDialog : undefined}
          getLocationName={getLocationName}
          canEdit={canEdit}
        />

        {/* Add/Edit Dialog */}
        <PromotionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          mode={dialogMode}
          promotion={editingPromotion}
          locations={locationOptions}
          locationsLoading={locationsLoading}
          prefillLocationId={
            locationFilterId === "all" ? undefined : locationFilterId
          }
        />
      </div>
    </>
  );
}