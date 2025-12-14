// src/components/locations/EditImagesDialog.tsx

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EditImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentImages: string[];
  onSubmit: (images: string[]) => Promise<void>;
}

export function EditImagesDialog({
  open,
  onOpenChange,
  currentImages,
  onSubmit,
}: EditImagesDialogProps) {
  const [imagesText, setImagesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setImagesText(currentImages.join("\n"));
      setError(null);
    }
  }, [open, currentImages]);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      const imageUrls = imagesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      await onSubmit(imageUrls);
      // Parent will close the dialog on success
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save images";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit location images</DialogTitle>
          <DialogDescription>
            Paste one image URL per line. These URLs are used both in the admin
            dashboard and in the mobile app.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="images-text">Image URLs</Label>
            <Textarea
              id="images-text"
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              placeholder={"https://...\nhttps://...\nhttps://..."}
              rows={8}
              disabled={saving}
            />
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
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save images"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
