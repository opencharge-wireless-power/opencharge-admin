// src/pages/PromotionsPage.tsx
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
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
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  CircularProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";

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

interface PromotionFormState {
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
  validFrom: string; // "YYYY-MM-DDTHH:mm"
  validTo: string;
}

interface LocationOption {
  id: string;
  name: string;
}

interface FilterOption {
  id: string;
  name: string;
}

function formatDate(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionFormState>({
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
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      imageUrl: "",
      isActive: true,
      // prefill from active filter if we have one
      locationId: locationFilterId === "all" ? "" : locationFilterId,
      priorityWeight: "",
      qrPayload: "",
      redemptionCode: "",
      redemptionType: "QR",
      termsAndConditions: "",
      validFrom: "",
      validTo: "",
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (promo: Promotion) => {
    setDialogMode("edit");
    setEditingId(promo.id);
    setForm({
      title: promo.title,
      description: promo.description ?? "",
      imageUrl: promo.imageUrl ?? "",
      isActive: promo.isActive,
      locationId: promo.locationId ?? "",
      priorityWeight:
        promo.priorityWeight != null ? String(promo.priorityWeight) : "",
      qrPayload: promo.qrPayload ?? "",
      redemptionCode: promo.redemptionCode ?? "",
      redemptionType: promo.redemptionType ?? "QR",
      termsAndConditions: promo.termsAndConditions ?? "",
      validFrom: toDateTimeLocalValue(promo.validFrom),
      validTo: toDateTimeLocalValue(promo.validTo),
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  const handleFormChange =
    (field: keyof PromotionFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (field === "isActive") {
        setForm((prev) => ({
          ...prev,
          isActive: event.target.checked,
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          [field]: event.target.value,
        }));
      }
    };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
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
      } else if (dialogMode === "edit" && editingId) {
        const ref = doc(db, "promotions", editingId);
        await updateDoc(ref, baseData);

        setPromotions((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  id: editingId,
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
                  termsAndConditions:
                    baseData.termsAndConditions as string,
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save promotion";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
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

  const filterOptions: FilterOption[] = [
    { id: "all", name: "All locations" },
    ...locationOptions,
  ];

  const currentFilterOption: FilterOption =
    locationFilterId === "all"
      ? filterOptions[0]
      : filterOptions.find((o) => o.id === locationFilterId) ?? {
          id: locationFilterId,
          name: locationFilterId,
        };

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
        <Typography variant="h4" gutterBottom>
          Promotions
        </Typography>
        <Typography color="error">{error}</Typography>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Promotions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage all promotions across locations.
          </Typography>
        </Box>

         {canEdit && (
            <Button variant="contained" onClick={openAddDialog}>
            Add promotion
            </Button>
        )}
      </Box>

      {locationsError && (
        <Typography color="warning.main" variant="body2" sx={{ mb: 1 }}>
          Couldn&apos;t load locations for dropdown: {locationsError}
        </Typography>
      )}

      {/* Filter by location */}
      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <Autocomplete
          options={filterOptions}
          getOptionLabel={(option) => option.name}
          value={currentFilterOption}
          onChange={(_, newValue) => {
            setLocationFilterId(newValue ? newValue.id : "all");
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Filter by location"
              margin="normal"
              fullWidth
            />
          )}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Priority</TableCell>
              <TableCell>Valid from</TableCell>
              <TableCell>Valid to</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPromotions.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.title}</TableCell>
                <TableCell>{getLocationName(p.locationId)}</TableCell>
                <TableCell>
                  <Chip
                    label={p.isActive ? "Active" : "Inactive"}
                    color={p.isActive ? "success" : "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  {p.priorityWeight ?? "-"}
                </TableCell>
                <TableCell>{formatDate(p.validFrom)}</TableCell>
                <TableCell>{formatDate(p.validTo)}</TableCell>
                <TableCell align="right">
                   {
                    canEdit && (
                        <Button
                        size="small"
                        onClick={() => openEditDialog(p)}
                        >
                        Edit
                        </Button>
                    )}
                </TableCell>
              </TableRow>
            ))}

            {filteredPromotions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography align="center" sx={{ py: 2 }}>
                    No promotions found for this filter.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {dialogMode === "add" ? "New promotion" : "Edit promotion"}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              margin="normal"
              value={form.title}
              onChange={handleFormChange("title")}
              required
            />
            <TextField
              label="Description"
              fullWidth
              margin="normal"
              multiline
              minRows={2}
              value={form.description}
              onChange={handleFormChange("description")}
            />
            <TextField
              label="Image URL"
              fullWidth
              margin="normal"
              value={form.imageUrl}
              onChange={handleFormChange("imageUrl")}
            />

            {/* Location dropdown with search, using locationOptions */}
            <Autocomplete
              options={locationOptions}
              loading={locationsLoading}
              getOptionLabel={(option) => option.name || option.id}
              value={
                locationOptions.find(
                  (opt) => opt.id === form.locationId
                ) ?? null
              }
              onChange={(_, newValue) => {
                setForm((prev) => ({
                  ...prev,
                  locationId: newValue ? newValue.id : "",
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Location"
                  margin="normal"
                  fullWidth
                  required
                  helperText="Select the location this promotion applies to"
                />
              )}
            />

            <TextField
              label="Priority weight"
              type="number"
              fullWidth
              margin="normal"
              helperText="Higher number = shown first"
              value={form.priorityWeight}
              onChange={handleFormChange("priorityWeight")}
            />

            <TextField
              label="Valid from"
              type="datetime-local"
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              value={form.validFrom}
              onChange={handleFormChange("validFrom")}
            />
            <TextField
              label="Valid to"
              type="datetime-local"
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              value={form.validTo}
              onChange={handleFormChange("validTo")}
            />

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={handleFormChange("isActive")}
                  />
                }
                label="Active"
              />
            </Box>

            <TextField
              label="Redemption type"
              fullWidth
              margin="normal"
              helperText='e.g. "QR", "CODE"'
              value={form.redemptionType}
              onChange={handleFormChange("redemptionType")}
            />
            <TextField
              label="QR payload"
              fullWidth
              margin="normal"
              value={form.qrPayload}
              onChange={handleFormChange("qrPayload")}
            />
            <TextField
              label="Redemption code"
              fullWidth
              margin="normal"
              value={form.redemptionCode}
              onChange={handleFormChange("redemptionCode")}
            />
            <TextField
              label="Terms and conditions"
              fullWidth
              margin="normal"
              multiline
              minRows={2}
              value={form.termsAndConditions}
              onChange={handleFormChange("termsAndConditions")}
            />

            {saveError && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {saveError}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving
                ? "Saving..."
                : dialogMode === "add"
                ? "Create promotion"
                : "Save changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </MainLayout>
  );
}