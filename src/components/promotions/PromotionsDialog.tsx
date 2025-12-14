// src/components/promotions/PromotionDialog.tsx

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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LocationOption {
  id: string;
  name: string;
}

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

interface PromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PromotionFormData) => Promise<void>;
  mode: "add" | "edit";
  promotion?: Promotion;
  locations: LocationOption[];
  locationsLoading?: boolean;
  prefillLocationId?: string;
}

function toDateTimeLocalValue(date?: Date): string {
  if (!date) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function PromotionDialog({
  open,
  onOpenChange,
  onSubmit,
  mode,
  promotion,
  locations,
  locationsLoading = false,
  prefillLocationId,
}: PromotionDialogProps) {
  const [form, setForm] = useState<PromotionFormData>({
    title: "",
    description: "",
    imageUrl: "",
    isActive: true,
    locationId: "",
    priorityWeight: "",
    qrPayload: "",
    redemptionCode: "",
    redemptionType: "QR",
    termsAndConditions: "",
    validFrom: "",
    validTo: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when dialog opens or promotion changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && promotion) {
        setForm({
          title: promotion.title,
          description: promotion.description ?? "",
          imageUrl: promotion.imageUrl ?? "",
          isActive: promotion.isActive,
          locationId: promotion.locationId ?? "",
          priorityWeight:
            promotion.priorityWeight != null
              ? String(promotion.priorityWeight)
              : "",
          qrPayload: promotion.qrPayload ?? "",
          redemptionCode: promotion.redemptionCode ?? "",
          redemptionType: promotion.redemptionType ?? "QR",
          termsAndConditions: promotion.termsAndConditions ?? "",
          validFrom: toDateTimeLocalValue(promotion.validFrom),
          validTo: toDateTimeLocalValue(promotion.validTo),
        });
      } else {
        // Add mode - reset form with optional prefill
        setForm({
          title: "",
          description: "",
          imageUrl: "",
          isActive: true,
          locationId: prefillLocationId ?? "",
          priorityWeight: "",
          qrPayload: "",
          redemptionCode: "",
          redemptionType: "QR",
          termsAndConditions: "",
          validFrom: "",
          validTo: "",
        });
      }
      setError(null);
    }
  }, [open, mode, promotion, prefillLocationId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (saving) return;
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = form.title.trim();
    if (!trimmedTitle || !form.locationId) {
      setError("Title and Location are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSubmit(form);
      // Parent will close the dialog on success
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save promotion";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "New promotion" : "Edit promotion"}
            </DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? "Create a new promotion for a specific location."
                : "Update promotion details."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="promo-title">Title</Label>
              <Input
                id="promo-title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Promotion title"
                required
                disabled={saving}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="promo-description">Description</Label>
              <Textarea
                id="promo-description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description"
                rows={2}
                disabled={saving}
              />
            </div>

            {/* Image URL */}
            <div className="grid gap-2">
              <Label htmlFor="promo-image">Image URL</Label>
              <Input
                id="promo-image"
                type="url"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="https://example.com/image.jpg"
                disabled={saving}
              />
            </div>

            {/* Location */}
            <div className="grid gap-2">
              <Label htmlFor="promo-location">Location</Label>
              <Select
                value={form.locationId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, locationId: value }))
                }
                disabled={saving || locationsLoading}
              >
                <SelectTrigger id="promo-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the location this promotion applies to
              </p>
            </div>

            {/* Priority Weight */}
            <div className="grid gap-2">
              <Label htmlFor="promo-priority">Priority weight</Label>
              <Input
                id="promo-priority"
                type="number"
                value={form.priorityWeight}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priorityWeight: e.target.value,
                  }))
                }
                placeholder="0"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Higher number = shown first
              </p>
            </div>

            {/* Valid From */}
            <div className="grid gap-2">
              <Label htmlFor="promo-valid-from">Valid from</Label>
              <Input
                id="promo-valid-from"
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, validFrom: e.target.value }))
                }
                disabled={saving}
              />
            </div>

            {/* Valid To */}
            <div className="grid gap-2">
              <Label htmlFor="promo-valid-to">Valid to</Label>
              <Input
                id="promo-valid-to"
                type="datetime-local"
                value={form.validTo}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, validTo: e.target.value }))
                }
                disabled={saving}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="promo-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
                disabled={saving}
              />
              <Label htmlFor="promo-active" className="cursor-pointer">
                Active
              </Label>
            </div>

            {/* Redemption Type */}
            <div className="grid gap-2">
              <Label htmlFor="promo-redemption-type">Redemption type</Label>
              <Input
                id="promo-redemption-type"
                value={form.redemptionType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    redemptionType: e.target.value,
                  }))
                }
                placeholder='e.g. "QR", "CODE"'
                disabled={saving}
              />
            </div>

            {/* QR Payload */}
            <div className="grid gap-2">
              <Label htmlFor="promo-qr-payload">QR payload</Label>
              <Input
                id="promo-qr-payload"
                value={form.qrPayload}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, qrPayload: e.target.value }))
                }
                disabled={saving}
              />
            </div>

            {/* Redemption Code */}
            <div className="grid gap-2">
              <Label htmlFor="promo-redemption-code">Redemption code</Label>
              <Input
                id="promo-redemption-code"
                value={form.redemptionCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    redemptionCode: e.target.value,
                  }))
                }
                disabled={saving}
              />
            </div>

            {/* Terms and Conditions */}
            <div className="grid gap-2">
              <Label htmlFor="promo-terms">Terms and conditions</Label>
              <Textarea
                id="promo-terms"
                value={form.termsAndConditions}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    termsAndConditions: e.target.value,
                  }))
                }
                rows={2}
                disabled={saving}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
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
              ) : mode === "add" ? (
                "Create promotion"
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