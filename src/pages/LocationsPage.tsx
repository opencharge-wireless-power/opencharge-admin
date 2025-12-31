import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  type DocumentData,
} from "firebase/firestore";

import { LocationsTable } from "@/components/locations/LocationsTable";
import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";

import { Plus} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PulseLoader } from "@/components/common/loading/pulse-loader";
import { PageHeader } from "../components/layout/PageHeader";

import { db } from "../firebase";


interface LocationItem {
  id: string;
  name: string;
  brand?: string;
  storeLocation?: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  qrCode?: string;
  totalSessions?: number;
  unitInUse?: number;
  unitTotal?: number;
  active?: boolean;
  hasActivePromotions?: boolean;
}

interface NewLocationForm {
  brand: string;
  storeLocation: string;
  name: string;
  address: string;
  city: string;
  country: string;
  category: string;
  qrCode: string;
  priority: number;
  active: boolean;
}

export function LocationsPage() {
  const navigate = useNavigate();

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-location dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<NewLocationForm>({
    brand: "",
    storeLocation: "",
    name: "",
    address: "",
    city: "",
    country: "",
    category: "",
    qrCode: "",
    priority: 0,
    active: true,
  });

  // -------- Load locations --------
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const snap = await getDocs(collection(db, "locations"));
        const items: LocationItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          return {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? docSnap.id,
            brand: data.brand as string | undefined,
            storeLocation: data.storeLocation as string | undefined,
            address: data.address as string | undefined,
            city: data.city as string | undefined,
            country: data.country as string | undefined,
            category: data.category as string | undefined,
            qrCode: data.qrCode as string | undefined,
            totalSessions:
              typeof data.totalSessions === "number"
                ? (data.totalSessions as number)
                : undefined,
            unitInUse:
              typeof data.unitInUse === "number"
                ? (data.unitInUse as number)
                : undefined,
            unitTotal:
              typeof data.unitTotal === "number"
                ? (data.unitTotal as number)
                : undefined,
            active:
              typeof data.active === "boolean" ? (data.active as boolean) : undefined,
            hasActivePromotions:
              typeof data.hasActivePromotions === "boolean"
                ? (data.hasActivePromotions as boolean)
                : undefined,
          };
        });

        // Sort by brand then storeLocation
        items.sort((a, b) => {
          const ab = (a.brand ?? "").localeCompare(b.brand ?? "");
          if (ab !== 0) return ab;
          return (a.storeLocation ?? "").localeCompare(b.storeLocation ?? "");
        });

        setLocations(items);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load locations";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  // -------- New location dialog helpers --------

  const openDialog = () => {
    setSaveError(null);
    setForm({
      brand: "",
      storeLocation: "",
      name: "",
      address: "",
      city: "",
      country: "",
      category: "",
      qrCode: "",
      priority: 0,
      active: true,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  const handleFormChange =
    (field: keyof NewLocationForm) =>
    (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | {
        target: { checked: boolean };
      }
    ) => {
      if (field === "active") {
        setForm((prev) => ({ ...prev, active: (e as any).target.checked }));
      } else if (field === "priority") {
        const value = Number((e as any).target.value ?? 0);
        setForm((prev) => ({ ...prev, priority: value }));
      } else {
        const value = (e as any).target.value as string;
        setForm((prev) => ({
          ...prev,
          [field]: value,
          // Auto-set name if still empty and brand/storeLocation being typed
          ...(field === "brand" || field === "storeLocation"
            ? {
                name:
                  prev.name ||
                  `${field === "brand" ? value : prev.brand} ${
                    field === "storeLocation" ? value : prev.storeLocation
                  }`.trim(),
              }
            : {}),
        }));
      }
    };

  const handleCreateLocation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedBrand = form.brand.trim();
    const trimmedStore = form.storeLocation.trim();

    if (!trimmedBrand || !trimmedStore) {
      setSaveError("Brand and store location are required.");
      return;
    }

    // Document key: "brand - storeLocation"
    const docId = `${trimmedBrand} - ${trimmedStore}`;

    try {
      setSaving(true);
      setSaveError(null);

      const ref = doc(collection(db, "locations"), docId);

      await setDoc(ref, {
        // core identity
        name: form.name.trim() || `${trimmedBrand} ${trimmedStore}`,
        brand: trimmedBrand,
        storeLocation: trimmedStore,

        // address / meta
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        category: form.category.trim() || null,

        // QR link used on printed stickers
        qrCode: form.qrCode.trim() || null,

        // flags
        active: form.active,
        hasActivePromotions: false,

        // ordering / payments / promos flags default
        supportsOrdering: false,
        supportsPayments: false,
        supportsPromotions: false,

        // priority + counters
        priority: form.priority,
        totalSessions: 0,
        unitInUse: 0,
        unitTotal: 0,
      });

      // Optimistic add to list
      setLocations((prev) => {
        const next: LocationItem[] = [
          ...prev,
          {
            id: docId,
            name: form.name.trim() || `${trimmedBrand} ${trimmedStore}`,
            brand: trimmedBrand,
            storeLocation: trimmedStore,
            address: form.address.trim() || undefined,
            city: form.city.trim() || undefined,
            country: form.country.trim() || undefined,
            category: form.category.trim() || undefined,
            qrCode: form.qrCode.trim() || undefined,
            totalSessions: 0,
            unitInUse: 0,
            unitTotal: 0,
            active: form.active,
            hasActivePromotions: false,
          },
        ];
        next.sort((a, b) => {
          const ab = (a.brand ?? "").localeCompare(b.brand ?? "");
          if (ab !== 0) return ab;
          return (a.storeLocation ?? "").localeCompare(b.storeLocation ?? "");
        });
        return next;
      });

      setDialogOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create location";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  // -------- Render --------

  if (loading) {
    return (
    <>
      <PageHeader
        title="Locations"
        breadcrumbs={[{ label: "Locations", href: "/locations" }]}
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
        title="Locations"
        breadcrumbs={[{ label: "Locations", href: "/locations" }]}
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="flex items-center gap-2">
          {/*Error */}
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
        title="Locations"
        breadcrumbs={[{ label: "Locations", href: "/locations" }]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-sm text-muted-foreground">
          Manage Opencharge venues and see sessions and unit utilisation per
            site.
          </p>
        </div>

        <Button onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New location
        </Button>

      </div>


      {/* Table */}
   

      <LocationsTable
        data={locations}
        onRowClick={(id) =>
          navigate(`/locations/${encodeURIComponent(id)}`)
        }
      />
    </div>

      {/* New location dialog */}
      <Dialog open={dialogOpen}
        onOpenChange={(open) => {
          if (saving) return; // disable close while saving
          setDialogOpen(open);
        }}
        >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New location</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleCreateLocation}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                value={form.brand}
                onChange={handleFormChange("brand")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Store location</Label>
              <Input
                value={form.storeLocation}
                onChange={handleFormChange("storeLocation")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={form.name}
                onChange={handleFormChange("name")}
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={form.address}
                onChange={handleFormChange("address")}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={handleFormChange("city")}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={handleFormChange("country")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={handleFormChange("category")}
              />
            </div>

            <div className="space-y-2">
              <Label>QR code link</Label>
              <Input
                value={form.qrCode}
                onChange={handleFormChange("qrCode")}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={handleFormChange("priority")}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={form.active}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, active: Boolean(v) }))
                }
              />
              <Label>Active</Label>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}