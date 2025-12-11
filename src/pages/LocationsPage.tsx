import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  type DocumentData,
} from "firebase/firestore";
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";

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
      <MainLayout>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Locations
          </Typography>
          <Typography color="error">{error}</Typography>
        </Box>
      </MainLayout>
    );
  }

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
        <Box>
          <Typography variant="h4" gutterBottom>
            Locations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage Opencharge venues and see sessions and unit utilisation per
            location.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openDialog}
        >
          New location
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Brand</TableCell>
              <TableCell>Store</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Sessions</TableCell>
              <TableCell>Units</TableCell>
              <TableCell>QR code</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Promotions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.map((loc) => (
              <TableRow
                key={loc.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/locations/${encodeURIComponent(loc.id)}`)}
              >
                <TableCell>{loc.brand ?? "—"}</TableCell>
                <TableCell>{loc.storeLocation ?? "—"}</TableCell>
                <TableCell>{loc.name}</TableCell>
                <TableCell>{loc.city ?? "—"}</TableCell>
                <TableCell>{loc.category ?? "—"}</TableCell>
                <TableCell>{loc.totalSessions ?? "—"}</TableCell>
                <TableCell>
                  {loc.unitTotal != null ? (
                    <Typography variant="body2">
                      {loc.unitInUse ?? 0} / {loc.unitTotal}
                    </Typography>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    noWrap
                    sx={{ maxWidth: 220 }}
                  >
                    {loc.qrCode ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  {loc.active ? (
                    <Chip label="Active" size="small" color="success" />
                  ) : (
                    <Chip label="Inactive" size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>
                  {loc.hasActivePromotions ? (
                    <Chip
                      label="Has promos"
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography
                    align="center"
                    variant="body2"
                    sx={{ py: 2 }}
                    color="text.secondary"
                  >
                    No locations yet. Click “New location” to add your first
                    store.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New location dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>New location</DialogTitle>
        <form onSubmit={handleCreateLocation}>
          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField
                label="Brand"
                value={form.brand}
                onChange={handleFormChange("brand")}
                required
                helperText="e.g. Starbucks, Vida e caffè"
              />
              <TextField
                label="Store location"
                value={form.storeLocation}
                onChange={handleFormChange("storeLocation")}
                required
                helperText="e.g. Sea Point, V&A Waterfront"
              />
              <TextField
                label="Display name"
                value={form.name}
                onChange={handleFormChange("name")}
                helperText="Optional – defaults to Brand + Store location"
              />
              <TextField
                label="Address"
                value={form.address}
                onChange={handleFormChange("address")}
                multiline
                minRows={2}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="City"
                  value={form.city}
                  onChange={handleFormChange("city")}
                  fullWidth
                />
                <TextField
                  label="Country"
                  value={form.country}
                  onChange={handleFormChange("country")}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Category"
                value={form.category}
                onChange={handleFormChange("category")}
                helperText='e.g. "cafe", "airport", "restaurant"'
              />
              <TextField
                label="QR code link"
                value={form.qrCode}
                onChange={handleFormChange("qrCode")}
                helperText="Engagement URL printed on the QR sticker, e.g. https://opencharge.io/e/sb/sp"
              />
              <TextField
                label="Priority"
                type="number"
                value={form.priority}
                onChange={handleFormChange("priority")}
                helperText="Lower numbers can be treated as higher priority in lists."
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.active}
                    onChange={handleFormChange("active") as any}
                  />
                }
                label="Active"
              />

              {saveError && (
                <Typography color="error" variant="body2">
                  {saveError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : "Create location"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </MainLayout>
  );
}