// src/components/locations/EditLocationDialog.tsx

import { useState, useEffect, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { Location, EditFormState, OpenHours } from "@/types/Opencharge";
import { ORDERED_DAYS } from "@/utils/Format";

interface EditLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location;
  onSubmit: (form: EditFormState) => Promise<void>;
}

export function EditLocationDialog({
  open,
  onOpenChange,
  location,
  onSubmit,
}: EditLocationDialogProps) {
  const [form, setForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && location) {
      const oh = location.openHours ?? {};
      setForm({
        name: location.name,
        address: location.address ?? "",
        city: location.city ?? "",
        country: location.country ?? "",
        category: location.category ?? "",
        brand: location.brand ?? "",
        storeLocation: location.storeLocation ?? "",
        qrCode: location.qrCode ?? "",
        priority: location.priority != null ? String(location.priority) : "",
        lat: location.lat != null ? String(location.lat) : "",
        lng: location.lng != null ? String(location.lng) : "",
        active: location.active,
        supportsOrdering: location.supportsOrdering,
        supportsPayments: location.supportsPayments,
        supportsPromotions: location.supportsPromotions,
        openHoursMon: oh.mon ?? "",
        openHoursTue: oh.tue ?? "",
        openHoursWed: oh.wed ?? "",
        openHoursThu: oh.thu ?? "",
        openHoursFri: oh.fri ?? "",
        openHoursSat: oh.sat ?? "",
        openHoursSun: oh.sun ?? "",
      });
      setError(null);
    }
  }, [open, location]);

  const handleChange = (field: keyof EditFormState, value: string | boolean) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;

    try {
      setSaving(true);
      setError(null);
      await onSubmit(form);
      // Parent will close the dialog on success
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save changes";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit location</DialogTitle>
            <DialogDescription>
              Update location details and configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => handleChange("country", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                disabled={saving}
              />
            </div>

            <Separator />

            {/* Brand Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="storeLocation">Store location</Label>
                <Input
                  id="storeLocation"
                  value={form.storeLocation}
                  onChange={(e) => handleChange("storeLocation", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="qrCode">QR Code URL</Label>
              <Input
                id="qrCode"
                value={form.qrCode}
                onChange={(e) => handleChange("qrCode", e.target.value)}
                disabled={saving}
                placeholder="Leave blank to auto-generate"
              />
            </div>

            <Separator />

            {/* Coordinates & Priority */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => handleChange("lat", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => handleChange("lng", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => handleChange("priority", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <Separator />

            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={form.active}
                  onCheckedChange={(checked) => handleChange("active", checked)}
                  disabled={saving}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Active
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="supportsOrdering"
                  checked={form.supportsOrdering}
                  onCheckedChange={(checked) =>
                    handleChange("supportsOrdering", checked)
                  }
                  disabled={saving}
                />
                <Label htmlFor="supportsOrdering" className="cursor-pointer">
                  Supports ordering
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="supportsPayments"
                  checked={form.supportsPayments}
                  onCheckedChange={(checked) =>
                    handleChange("supportsPayments", checked)
                  }
                  disabled={saving}
                />
                <Label htmlFor="supportsPayments" className="cursor-pointer">
                  Supports payments
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="supportsPromotions"
                  checked={form.supportsPromotions}
                  onCheckedChange={(checked) =>
                    handleChange("supportsPromotions", checked)
                  }
                  disabled={saving}
                />
                <Label htmlFor="supportsPromotions" className="cursor-pointer">
                  Supports promotions
                </Label>
              </div>
            </div>

            <Separator />

            {/* Opening Hours */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Opening hours</h3>
              {ORDERED_DAYS.map((day) => (
                <div key={day} className="grid gap-2">
                  <Label htmlFor={`hours-${day}`} className="uppercase">
                    {day}
                  </Label>
                  <Input
                    id={`hours-${day}`}
                    value={
                      form[`openHours${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof EditFormState] as string
                    }
                    onChange={(e) =>
                      handleChange(
                        `openHours${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof EditFormState,
                        e.target.value
                      )
                    }
                    placeholder="e.g., 9:00 AM - 5:00 PM"
                    disabled={saving}
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
