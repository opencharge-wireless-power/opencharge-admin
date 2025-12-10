// src/pages/CampaignListPage.tsx
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
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
import { MainLayout } from "../components/layout/MainLayout";

import {
  Box,
  Typography,
  Button,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

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
function deriveQrCodeFromLocation(data: DocumentData, id: string): string | undefined {
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
  const [newBrandName, setNewBrandName] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaveError, setBrandSaveError] = useState<string | null>(null);

  // New campaign dialog
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDescription, setNewCampaignDescription] = useState("");
  const [newCampaignTargetUrl, setNewCampaignTargetUrl] = useState("");
  const [newCampaignActive, setNewCampaignActive] = useState(true);
  const [newCampaignLocationIds, setNewCampaignLocationIds] = useState<string[]>(
    []
  );
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignSaveError, setCampaignSaveError] = useState<string | null>(
    null
  );

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
  const handleBrandChange = (e: ChangeEvent<{ value: unknown }>) => {
    setSelectedBrandId(e.target.value as string);
  };

  // ---------- New brand dialog ----------
  const openNewBrandDialog = () => {
    setNewBrandName("");
    setBrandSaveError(null);
    setBrandDialogOpen(true);
  };

  const closeNewBrandDialog = () => {
    if (brandSaving) return;
    setBrandDialogOpen(false);
  };

  const handleCreateBrand = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawName = newBrandName.trim();
    if (!rawName) return;

    try {
      setBrandSaving(true);
      setBrandSaveError(null);

      // Use brand name as document ID (can be updated to slug later)
      const brandId = rawName;
      const brandRef = doc(db, "engage", brandId);
      await setDoc(brandRef, {
        name: rawName,
        createdAt: serverTimestamp(),
      });

      const newBrand: Brand = {
        id: brandId,
        name: rawName,
      };

      setBrands((prev) => {
        const next = [...prev, newBrand];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });

      setSelectedBrandId(brandId);
      setBrandDialogOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create brand";
      setBrandSaveError(msg);
    } finally {
      setBrandSaving(false);
    }
  };

  // ---------- New campaign dialog ----------
  const openNewCampaignDialog = () => {
    setNewCampaignName("");
    setNewCampaignDescription("");
    setNewCampaignTargetUrl("");
    setNewCampaignActive(true);
    setNewCampaignLocationIds([]);
    setCampaignSaveError(null);
    setCampaignDialogOpen(true);
  };

  const closeNewCampaignDialog = () => {
    if (campaignSaving) return;
    setCampaignDialogOpen(false);
  };

  const handleLocationsChange = (e: ChangeEvent<{ value: unknown }>) => {
    const value = e.target.value as string[];
    setNewCampaignLocationIds(value);
  };

  const handleCreateCampaign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !newCampaignName.trim() ||
      !selectedBrandId ||
      selectedBrandId === "all"
    ) {
      return;
    }

    try {
      setCampaignSaving(true);
      setCampaignSaveError(null);

      // 1) Create brand-level campaign (no QR URL here – QR comes from locations)
      const campaignsRef = collection(
        db,
        "engage",
        selectedBrandId,
        "campaigns"
      );
      const docRef = await addDoc(campaignsRef, {
        name: newCampaignName.trim(),
        description: newCampaignDescription.trim(),
        active: newCampaignActive,
        engagements: 0,
        locationIds: newCampaignLocationIds,
        // url intentionally omitted: QR is location-specific
        targetUrl: newCampaignTargetUrl.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const campaignId = docRef.id;

      // 2) For each selected location, create a store-level Engage campaign doc
      for (const locId of newCampaignLocationIds) {
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
          name: newCampaignName.trim(),
          active: newCampaignActive,
          engagements: 0,
          url: qrUrl ?? null,
          targetUrl: newCampaignTargetUrl.trim() || null,
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
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create campaign";
      setCampaignSaveError(msg);
    } finally {
      setCampaignSaving(false);
    }
  };

  const isLoading = loadingBrands || loadingCampaigns;

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
            Campaigns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage advertiser campaigns and QR tracking.
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="brand-select-label">Brand</InputLabel>
            <Select
              labelId="brand-select-label"
              label="Brand"
              value={selectedBrandId}
              onChange={handleBrandChange as any}
            >
              <MenuItem value="all">All brands</MenuItem>
              {brands.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name} ({b.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="outlined" onClick={openNewBrandDialog}>
            New brand
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openNewCampaignDialog}
            disabled={
              !selectedBrandId ||
              selectedBrandId === "all" ||
              brands.length === 0
            }
          >
            New campaign
          </Button>
        </Stack>
      </Box>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      {!isLoading && !error && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Brand</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Locations</TableCell>
                <TableCell>Engagements</TableCell>
                <TableCell>Target URL</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/campaigns/${c.brandId}/${c.id}`)
                  }
                >
                  <TableCell>{c.brandName}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {c.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.active ? "Active" : "Inactive"}
                      size="small"
                      color={c.active ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell>{c.locationCount}</TableCell>
                  <TableCell>{c.engagements}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 260 }}
                    >
                      {c.targetUrl ?? c.url ?? "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {c.createdAt
                      ? c.createdAt.toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}

              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography
                      align="center"
                      variant="body2"
                      sx={{ py: 2 }}
                      color="text.secondary"
                    >
                      {brands.length === 0
                        ? "No brands yet. Create a brand first."
                        : selectedBrandId === "all"
                        ? "No campaigns found for any brand."
                        : "No campaigns yet for this brand. Click “New campaign” to create one."}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* New brand dialog */}
      <Dialog
        open={brandDialogOpen}
        onClose={closeNewBrandDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>New brand</DialogTitle>
        <form onSubmit={handleCreateBrand}>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              label="Brand name"
              fullWidth
              margin="normal"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              required
            />
            {brandSaveError && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {brandSaveError}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeNewBrandDialog} disabled={brandSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={brandSaving}>
              {brandSaving ? "Saving..." : "Create brand"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* New campaign dialog */}
      <Dialog
        open={campaignDialogOpen}
        onClose={closeNewCampaignDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>New campaign</DialogTitle>
        <form onSubmit={handleCreateCampaign}>
          <DialogContent sx={{ pt: 1 }}>
            <TextField
              label="Campaign name"
              fullWidth
              margin="normal"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              required
            />

            <TextField
              label="Description"
              fullWidth
              margin="normal"
              value={newCampaignDescription}
              onChange={(e) => setNewCampaignDescription(e.target.value)}
              multiline
              minRows={2}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={newCampaignActive}
                  onChange={(e) => setNewCampaignActive(e.target.checked)}
                />
              }
              label="Active"
            />

            <FormControl fullWidth margin="normal" size="small">
              <InputLabel id="locations-label">Locations</InputLabel>
              <Select
                labelId="locations-label"
                label="Locations"
                multiple
                value={newCampaignLocationIds}
                onChange={handleLocationsChange as any}
                renderValue={(selected) => {
                  const ids = selected as string[];
                  const names = ids
                    .map(
                      (id) => locations.find((l) => l.id === id)?.name ?? id
                    )
                    .join(", ");
                  return names;
                }}
              >
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    <Checkbox
                      checked={newCampaignLocationIds.includes(loc.id)}
                    />
                    <Typography variant="body2">{loc.name}</Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1.5 }}
            >
              QR URL is taken from each location’s QR code and does not need to
              be configured here. You only set the final target URL for the
              campaign.
            </Typography>

            <TextField
              label="Target URL"
              fullWidth
              margin="normal"
              value={newCampaignTargetUrl}
              onChange={(e) => setNewCampaignTargetUrl(e.target.value)}
              helperText="Final destination after redirects (brand landing page)."
            />

            {campaignSaveError && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {campaignSaveError}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeNewCampaignDialog} disabled={campaignSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={campaignSaving}>
              {campaignSaving ? "Saving..." : "Create campaign"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </MainLayout>
  );
}