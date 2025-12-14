// src/components/locations/EditUnitDialog.tsx

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
import type { Unit, UnitEditForm } from "@/types/Opencharge";

interface EditUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  unit?: Unit;
  onSubmit: (form: UnitEditForm) => Promise<void>;
}

export function EditUnitDialog({
  open,
  onOpenChange,
  mode,
  unit,
  onSubmit,
}: EditUnitDialogProps) {
  const [form, setForm] = useState<UnitEditForm>({
    name: "",
    position: "",
    status: "online",
    inUse: false,
    totalSessions: "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && unit) {
        setForm({
          id: unit.id,
          name: unit.name,
          position: unit.position ?? "",
          status: unit.status ?? "",
          inUse: !!unit.inUse,
          totalSessions: String(unit.totalSessions ?? 0),
        });
      } else {
        setForm({
          name: "",
          position: "",
          status: "online",
          inUse: false,
          totalSessions: "0",
        });
      }
      setError(null);
    }
  }, [open, mode, unit]);

  const handleChange = (
    field: keyof UnitEditForm,
    value: string | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      await onSubmit(form);
      // Parent will close the dialog on success
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save unit";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "Add unit" : "Edit unit"}
            </DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? "Add a new unit to this location."
                : "Update unit details."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="unit-name">Unit name</Label>
              <Input
                id="unit-name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder='e.g., "SBSP-BR05"'
                required
                disabled={saving}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit-position">Position</Label>
              <Input
                id="unit-position"
                value={form.position}
                onChange={(e) => handleChange("position", e.target.value)}
                placeholder="e.g., Boardroom, Oval Power Table"
                disabled={saving}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit-status">Status</Label>
              <Input
                id="unit-status"
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                placeholder='e.g., "online", "offline", "maintenance"'
                disabled={saving}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit-sessions">Total sessions</Label>
              <Input
                id="unit-sessions"
                type="number"
                value={form.totalSessions}
                onChange={(e) => handleChange("totalSessions", e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="unit-inuse"
                checked={form.inUse}
                onCheckedChange={(checked) => handleChange("inUse", checked)}
                disabled={saving}
              />
              <Label htmlFor="unit-inuse" className="cursor-pointer">
                In use right now
              </Label>
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
              ) : mode === "add" ? (
                "Add unit"
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
