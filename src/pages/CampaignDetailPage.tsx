// src/pages/CampaignDetailPage.tsx
import { useEffect, useState, Fragment } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";

import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const BRAND_ID = "starbucks";

// Where the QR should point to (landing page that logs & redirects)
const DEFAULT_QR_BASE_URL = "https://links.opencharge.app/c";

interface LocationOption {
  id: string;
  name: string;
  address?: string;
}

interface CampaignData {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  url: string;
  targetUrl: string;
  locationIds: string[];
  engagements: number;
  createdAt?: Date;
  startAt?: Date;
  endAt?: Date;
}

interface CampaignFormState {
  name: string;
  description: string;
  active: boolean;
  url: string;
  targetUrl: string;
  locationIds: string[];
}

export function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  const isNew = !campaignId || campaignId === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [form, setForm] = useState<CampaignFormState | null>(null);

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const locationMap: Record<string, LocationOption> = locations.reduce(
    (acc, loc) => {
      acc[loc.id] = loc;
      return acc;
    },
    {} as Record<string, LocationOption>
  );

  // ---------- Fetch locations ----------
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locationsRef = collection(db, "locations");
        const q = query(locationsRef, orderBy("name", "asc"));
        const snap = await getDocs(q);

        const items: LocationOption[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? "Unnamed location",
            address: data.address as string | undefined,
          };
        });

        setLocations(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load locations";
        setLocationsError(message);
      } finally {
        setLocationsLoading(false);
      }
    };

    void fetchLocations();
  }, []);

  // ---------- Fetch / init campaign ----------
  useEffect(() => {
    const fetchCampaign = async () => {
      if (isNew) {
        const blank: CampaignFormState = {
          name: "",
          description: "",
          active: true,
          url: DEFAULT_QR_BASE_URL,
          targetUrl: "",
          locationIds: [],
        };
        setForm(blank);
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "engage", BRAND_ID, "campaigns", campaignId!);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Campaign not found");
          setLoading(false);
          return;
        }

        const data = snap.data() as DocumentData;

        const createdTs = data.createdAt as Timestamp | undefined;
        const startTs = data.startAt as Timestamp | undefined;
        const endTs = data.endAt as Timestamp | undefined;

        const locIds = Array.isArray(data.locationIds)
          ? (data.locationIds as string[])
          : [];

        const loadedCampaign: CampaignData = {
          id: snap.id,
          name: (data.name as string | undefined) ?? "Untitled campaign",
          description: (data.description as string | undefined) ?? "",
          active: (data.active as boolean | undefined) ?? false,
          url:
            (data.url as string | undefined) ??
            (data.landingUrl as string | undefined) ??
            DEFAULT_QR_BASE_URL,
          targetUrl: (data.targetUrl as string | undefined) ?? "",
          locationIds: locIds,
          engagements: (data.engagements as number | undefined) ?? 0,
          createdAt: createdTs ? createdTs.toDate() : undefined,
          startAt: startTs ? startTs.toDate() : undefined,
          endAt: endTs ? endTs.toDate() : undefined,
        };

        setCampaign(loadedCampaign);

        const formState: CampaignFormState = {
          name: loadedCampaign.name,
          description: loadedCampaign.description ?? "",
          active: loadedCampaign.active,
          url: loadedCampaign.url,
          targetUrl: loadedCampaign.targetUrl,
          locationIds: loadedCampaign.locationIds,
        };

        setForm(formState);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load campaign";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchCampaign();
  }, [campaignId, isNew]);

  // ---------- Handlers ----------

  const handleTextChange =
    (field: keyof CampaignFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!form) return;
      setForm({
        ...form,
        [field]: event.target.value,
      });
    };

  const handleActiveChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!form) return;
    setForm({
      ...form,
      active: event.target.checked,
    });
  };

  const handleLocationSelectChange = (
    event: SelectChangeEvent<string[]>
  ) => {
    if (!form) return;

    const value = event.target.value;
    const selectedIds =
      typeof value === "string" ? value.split(",") : (value as string[]);

    setForm({
      ...form,
      locationIds: selectedIds,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setSaveError(null);

    try {
      const baseData: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        active: form.active,
        url: form.url.trim() || DEFAULT_QR_BASE_URL,
        targetUrl: form.targetUrl.trim(),
        locationIds: form.locationIds,
        updatedAt: serverTimestamp(),
      };

      if (isNew) {
        baseData.createdAt = serverTimestamp();
        baseData.engagements = 0;

        const campaignsRef = collection(db, "engage", BRAND_ID, "campaigns");
        const newRef = await addDoc(campaignsRef, baseData);

        // After first save, go into edit mode for this campaign
        navigate(`/campaigns/${newRef.id}`, { replace: true });
      } else {
        const ref = doc(db, "engage", BRAND_ID, "campaigns", campaignId!);
        await updateDoc(ref, baseData);
        navigate("/campaigns");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save campaign";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  // Build per-location QR URL (what gets encoded in the sticker)
  const buildQrUrl = (
    baseUrl: string,
    campId: string | undefined,
    locationId: string
  ) => {
    const cid = campId ?? "CAMPAIGN_ID";
    const url = baseUrl || DEFAULT_QR_BASE_URL;

    const hasQuery = url.includes("?");
    const joiner = hasQuery ? "&" : "?";

    return `${url}${joiner}cid=${encodeURIComponent(
      cid
    )}&loc=${encodeURIComponent(locationId)}`;
  };

  // ---------- Render ----------

  if (loading || !form) {
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
            Campaign
          </Typography>
          <Typography color="error">{error}</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          size="small"
          variant="text"
          onClick={() => navigate("/campaigns")}
        >
          Back to campaigns
        </Button>

        <Typography variant="h4">
          {isNew ? "New campaign" : form.name || "Edit campaign"}
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {/* Basic info */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic information
              </Typography>

              <TextField
                label="Name"
                fullWidth
                margin="normal"
                required
                value={form.name}
                onChange={handleTextChange("name")}
              />

              <TextField
                label="Description"
                fullWidth
                margin="normal"
                multiline
                minRows={2}
                value={form.description}
                onChange={handleTextChange("description")}
              />

              <TextField
                label="Advertiser target URL"
                helperText="Where the user finally lands after tracking (brand landing page)."
                fullWidth
                margin="normal"
                value={form.targetUrl}
                onChange={handleTextChange("targetUrl")}
              />

              <TextField
                label="QR landing base URL"
                helperText="The URL encoded in the QR. Tracking parameters for campaign & location will be appended automatically."
                fullWidth
                margin="normal"
                value={form.url}
                onChange={handleTextChange("url")}
              />

              <Box sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch checked={form.active} onChange={handleActiveChange} />
                  }
                  label="Active"
                />
              </Box>

              {saveError && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {saveError}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Locations selection */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Locations
              </Typography>

              {locationsLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                  <CircularProgress size={22} />
                </Box>
              )}

              {locationsError && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {locationsError}
                </Typography>
              )}

              {!locationsLoading && !locationsError && (
                <Fragment>
                  <FormControl fullWidth margin="normal" size="small">
                    <InputLabel id="campaign-locations-label">
                      Locations
                    </InputLabel>
                    <Select
                      labelId="campaign-locations-label"
                      multiple
                      value={form.locationIds}
                      label="Locations"
                      onChange={handleLocationSelectChange}
                      renderValue={(selected) =>
                        selected
                          .map(
                            (id) =>
                              locationMap[id]?.name ??
                              locationMap[id]?.id ??
                              id
                          )
                          .join(", ")
                      }
                    >
                      {locations.map((loc) => (
                        <MenuItem key={loc.id} value={loc.id}>
                          <Checkbox
                            checked={form.locationIds.includes(loc.id)}
                          />
                          <ListItemText
                            primary={loc.name}
                            secondary={loc.address}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {form.locationIds.length === 0 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Select one or more locations where this QR will be used.
                      All units at a location can share the same QR code.
                    </Typography>
                  )}

                  {form.locationIds.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        QR URL per location
                      </Typography>

                      <TableContainer component={Paper}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Location</TableCell>
                              <TableCell>Address</TableCell>
                              <TableCell>QR URL (encode in sticker)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {form.locationIds.map((locId) => {
                              const loc = locationMap[locId];
                              const qrUrl = buildQrUrl(
                                form.url || DEFAULT_QR_BASE_URL,
                                isNew ? undefined : campaign?.id,
                                locId
                              );

                              return (
                                <TableRow key={locId}>
                                  <TableCell>
                                    {loc?.name ?? locId}
                                  </TableCell>
                                  <TableCell>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      noWrap
                                      sx={{ maxWidth: 260 }}
                                    >
                                      {loc?.address ?? "—"}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography
                                      variant="body2"
                                      sx={{ fontFamily: "monospace" }}
                                    >
                                      {qrUrl}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {isNew && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 1, display: "block" }}
                        >
                          Once you save, <code>CAMPAIGN_ID</code> in the URLs
                          will be replaced with the real campaign ID.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Fragment>
              )}
            </CardContent>
          </Card>

          {/* Engagement summary for existing campaigns */}
          {!isNew && campaign && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Engagement summary
                </Typography>

                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Total engagements"
                      secondary={campaign.engagements}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem>
                    <ListItemText
                      primary="Created at"
                      secondary={
                        campaign.createdAt
                          ? campaign.createdAt.toLocaleString()
                          : "—"
                      }
                    />
                  </ListItem>
                </List>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Detailed per-event analytics are stored in the{" "}
                  <code>engagements</code> sub-collection under this campaign
                  in Firestore. You can extend this screen later to aggregate
                  by location or device type.
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Save buttons */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              mt: 1,
              mb: 4,
            }}
          >
            <Button
              variant="outlined"
              onClick={() => navigate("/campaigns")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving
                ? "Saving..."
                : isNew
                ? "Create campaign"
                : "Save campaign"}
            </Button>
          </Box>
        </Stack>
      </form>
    </MainLayout>
  );
}