// src/components/campaigns/NewCampaignDialog.tsx

import { useState, type FormEvent } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface LocationItem {
  id: string;
  name: string;
  brand?: string;
  storeLocation?: string;
  qrCode?: string;
}

interface CampaignFormData {
  name: string;
  description: string;
  targetUrl: string;
  active: boolean;
  locationIds: string[];
}

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CampaignFormData) => Promise<void>;
  locations: LocationItem[];
  brandId: string | null;
}

export function NewCampaignDialog({
  open,
  onOpenChange,
  onSubmit,
  locations,
  brandId,
}: NewCampaignDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [active, setActive] = useState(true);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (saving) return;
    if (!newOpen) {
      // Reset form when closing
      setName("");
      setDescription("");
      setTargetUrl("");
      setActive(true);
      setLocationIds([]);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const toggleLocation = (locationId: string) => {
    setLocationIds((prev) => {
      if (prev.includes(locationId)) {
        return prev.filter((id) => id !== locationId);
      }
      return [...prev, locationId];
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !brandId || brandId === "all") {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        targetUrl: targetUrl.trim(),
        active,
        locationIds,
      });

      // Parent will close the dialog and navigate on success
      // Reset form
      setName("");
      setDescription("");
      setTargetUrl("");
      setActive(true);
      setLocationIds([]);
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create campaign";
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
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Create a new campaign with locations and tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Campaign Name */}
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name"
                required
                disabled={saving}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the campaign"
                rows={3}
                disabled={saving}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="campaign-active"
                checked={active}
                onCheckedChange={(checked) => setActive(checked === true)}
                disabled={saving}
              />
              <Label
                htmlFor="campaign-active"
                className="text-sm font-normal cursor-pointer"
              >
                Active
              </Label>
            </div>

            {/* Locations */}
            <div className="grid gap-2">
              <Label>Locations</Label>
              <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                {locations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No locations available
                  </p>
                ) : (
                  locations.map((loc) => (
                    <div key={loc.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`loc-${loc.id}`}
                        checked={locationIds.includes(loc.id)}
                        onCheckedChange={() => toggleLocation(loc.id)}
                        disabled={saving}
                      />
                      <Label
                        htmlFor={`loc-${loc.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {loc.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                QR URL is taken from each location's QR code and does not need
                to be configured here. You only set the final target URL for
                the campaign.
              </p>
            </div>

            {/* Target URL */}
            <div className="grid gap-2">
              <Label htmlFor="campaign-target-url">Target URL</Label>
              <Input
                id="campaign-target-url"
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com/landing-page"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Final destination after redirects (brand landing page).
              </p>
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
                  Creating...
                </>
              ) : (
                "Create campaign"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}