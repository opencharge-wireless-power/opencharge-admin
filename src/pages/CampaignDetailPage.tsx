// src/pages/CampaignDetailPage.tsx
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  limit,
  type DocumentData,
  type Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Grid,
  Stack,
  Button,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";

import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";

const DEFAULT_BRAND_ID = "starbucks"; // fallback for legacy /campaigns/:id route

interface Campaign {
  id: string;
  brandId: string;
  name: string;
  description?: string;
  active: boolean;
  engagements: number;
  locationIds: string[];
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EngagementEvent {
  id: string;
  createdAt?: Date;
  deviceBrand?: string;
  deviceName?: string;
  deviceOS?: string;
  deviceType?: string;
  raw?: DocumentData;
}

interface EditFormState {
  name: string;
  description: string;
  targetUrl: string;
  url: string;
  active: boolean;
  locationsText: string; // one per line
}

// Simple date helpers
function formatDate(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(date?: Date): string {
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignDetailPage() {
  // Support both new style /campaigns/:brandId/:campaignId
  // and legacy /campaigns/:id
  const params = useParams<{
    brandId?: string;
    campaignId?: string;
    id?: string;
  }>();

  const navigate = useNavigate();

  const brandIdParam = params.brandId;
  const campaignIdParam = params.campaignId;
  const legacyId = params.id;

  // Effective IDs we actually use
  const effectiveCampaignId = campaignIdParam ?? legacyId ?? null;
  const effectiveBrandId =
    brandIdParam ?? (legacyId ? DEFAULT_BRAND_ID : null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Engagements list
  const [events, setEvents] = useState<EngagementEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isCreateMode = effectiveCampaignId === "new";

  // --------- Load campaign (view / edit existing) ----------
  useEffect(() => {
    const load = async () => {
      if (!effectiveBrandId || !effectiveCampaignId || isCreateMode) {
        // In create mode we don't load an existing doc
        if (!isCreateMode && (!effectiveBrandId || !effectiveCampaignId)) {
          setError("No campaign ID");
          setLoading(false);
        } else {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const ref = doc(
          db,
          "engage",
          effectiveBrandId,
          "campaigns",
          effectiveCampaignId
        );
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Campaign not found");
          setLoading(false);
          return;
        }

        const data = snap.data() as DocumentData;

        const createdRaw =
          (data.createdAt as Timestamp | undefined) ??
          (data.createAt as Timestamp | undefined); // handle older typo
        const updatedRaw = data.updatedAt as Timestamp | undefined;

        const createdAt = createdRaw ? createdRaw.toDate() : undefined;
        const updatedAt = updatedRaw ? updatedRaw.toDate() : undefined;

        const locationIds: string[] = Array.isArray(data.locationIds)
          ? (data.locationIds as string[])
          : Array.isArray(data.locations)
          ? (data.locations as string[])
          : [];

        const c: Campaign = {
          id: snap.id,
          brandId: effectiveBrandId,
          name: (data.name as string | undefined) ?? "Untitled campaign",
          description: data.description as string | undefined,
          active: (data.active as boolean | undefined) ?? false,
          engagements: (data.engagements as number | undefined) ?? 0,
          locationIds,
          url: data.url as string | undefined,
          targetUrl: data.targetUrl as string | undefined,
          createdAt,
          updatedAt,
        };

        setCampaign(c);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load campaign";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [effectiveBrandId, effectiveCampaignId, isCreateMode]);

  // --------- Load engagement events ----------
  useEffect(() => {
    const loadEvents = async () => {
      if (!effectiveBrandId || !effectiveCampaignId || isCreateMode) {
        setEventsLoading(false);
        return;
      }

      try {
        setEventsLoading(true);
        setEventsError(null);

        const eventsRef = collection(
          db,
          "engage",
          effectiveBrandId,
          "campaigns",
          effectiveCampaignId,
          "engagements"
        );

        const snap = await getDocs(query(eventsRef, limit(100)));

        const items: EngagementEvent[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const tsRaw =
            data.timeStamp as number | Timestamp | undefined | null;
          const createdRaw = data.createdAt as Timestamp | undefined;

          let createdAt: Date | undefined;

          if (typeof tsRaw === "number") {
            createdAt = new Date(tsRaw);
          } else if (tsRaw && typeof (tsRaw as Timestamp).toDate === "function") {
            createdAt = (tsRaw as Timestamp).toDate();
          } else if (
            createdRaw &&
            typeof (createdRaw as Timestamp).toDate === "function"
          ) {
            createdAt = (createdRaw as Timestamp).toDate();
          }

          return {
            id: docSnap.id,
            createdAt,
            deviceBrand: data.deviceBrand as string | undefined,
            deviceName: data.deviceName as string | undefined,
            deviceOS: data.deviceOS as string | undefined,
            deviceType: data.deviceType as string | undefined,
            raw: data,
          };
        });

        // Sort newest first
        items.sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? 0;
          const tb = b.createdAt?.getTime() ?? 0;
          return tb - ta;
        });

        setEvents(items);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to load engagement events";
        setEventsError(msg);
      } finally {
        setEventsLoading(false);
      }
    };

    void loadEvents();
  }, [effectiveBrandId, effectiveCampaignId, isCreateMode]);

  // --------- Edit / create dialog helpers ----------
  const openEditDialog = () => {
    // For create mode, open with empty defaults
    if (isCreateMode) {
      const form: EditFormState = {
        name: "",
        description: "",
        targetUrl: "",
        url: "",
        active: true,
        locationsText: "",
      };
      setEditForm(form);
      setEditError(null);
      setEditOpen(true);
      return;
    }

    if (!campaign) return;
    const form: EditFormState = {
      name: campaign.name,
      description: campaign.description ?? "",
      targetUrl: campaign.targetUrl ?? "",
      url: campaign.url ?? "",
      active: campaign.active,
      locationsText:
        campaign.locationIds && campaign.locationIds.length > 0
          ? campaign.locationIds.join("\n")
          : "",
    };
    setEditForm(form);
    setEditError(null);
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    if (editSaving) return;
    setEditOpen(false);
  };

  const handleEditChange =
    (field: keyof EditFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!editForm) return;

      if (field === "active") {
        setEditForm({ ...editForm, active: (e.target as any).checked });
      } else {
        setEditForm({ ...editForm, [field]: e.target.value });
      }
    };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!effectiveBrandId || !editForm) return;

    try {
      setEditSaving(true);
      setEditError(null);

      const locations = editForm.locationsText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const baseData: Record<string, unknown> = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        targetUrl: editForm.targetUrl.trim() || null,
        url: editForm.url.trim() || null,
        active: editForm.active,
        locationIds: locations,
      };

      if (isCreateMode) {
        // Create new campaign
        const campaignsRef = collection(
          db,
          "engage",
          effectiveBrandId,
          "campaigns"
        );
        const newDocRef = await addDoc(campaignsRef, {
          ...baseData,
          engagements: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // After creating, navigate to real detail page
        navigate(`/campaigns/${effectiveBrandId}/${newDocRef.id}`, {
          replace: true,
        });
      } else if (effectiveCampaignId && campaign) {
        // Update existing campaign
        const updates: Record<string, unknown> = {
          ...baseData,
          updatedAt: serverTimestamp(),
        };

        const ref = doc(
          db,
          "engage",
          effectiveBrandId,
          "campaigns",
          effectiveCampaignId
        );
        await updateDoc(ref, updates);

        const updatedCampaign: Campaign = {
          ...campaign,
          name: updates.name as string,
          description:
            (updates.description as string | null) ?? undefined,
          targetUrl:
            (updates.targetUrl as string | null) ?? undefined,
          url: (updates.url as string | null) ?? undefined,
          active: updates.active as boolean,
          locationIds: locations,
          updatedAt: new Date(),
        };

        setCampaign(updatedCampaign);
      }

      setEditOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save campaign";
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  // --------- Render guards ----------
  if (!effectiveBrandId || !effectiveCampaignId) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Campaign
          </Typography>
          <Typography color="error">No campaign ID</Typography>
        </Box>
      </MainLayout>
    );
  }

  if (loading && !isCreateMode) {
    return (
      <MainLayout>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!isCreateMode && (error || !campaign)) {
    return (
      <MainLayout>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" gutterBottom>
            Campaign
          </Typography>
          <Typography color="error">
            {error ?? "Campaign not found"}
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  // --------- Main UI ----------
  const displayCampaign = campaign ?? {
    // minimal dummy when in create mode so layout still works
    id: "new",
    brandId: effectiveBrandId,
    name: "New campaign",
    active: true,
    engagements: 0,
    locationIds: [],
  } as Campaign;

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
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            startIcon={<ArrowBackIcon />}
            size="small"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Typography variant="h4">
            {isCreateMode ? "New campaign" : displayCampaign.name}
          </Typography>
          {!isCreateMode && (
            <Chip
              label={displayCampaign.active ? "Active" : "Inactive"}
              size="small"
              color={displayCampaign.active ? "success" : "default"}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`Brand: ${displayCampaign.brandId}`}
            size="small"
            variant="outlined"
          />
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={openEditDialog}
          >
            {isCreateMode ? "Create campaign" : "Edit campaign"}
          </Button>
        </Stack>
      </Box>

      {/* Info + summary */}
      {!isCreateMode && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Campaign info card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Campaign info
                </Typography>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Brand
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.brandId}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.description || "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Locations
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.locationIds.length > 0
                      ? displayCampaign.locationIds.join(", ")
                      : "—"}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Short URL (QR)
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.url || "—"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Target URL
                  </Typography>
                  <Typography variant="body1">
                    {displayCampaign.targetUrl || "—"}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(displayCampaign.createdAt)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Last updated
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(displayCampaign.updatedAt)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Engagement summary card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Engagement summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Stored counter
                    </Typography>
                    <Typography variant="h4">
                      {displayCampaign.engagements}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Value from <code>engagements</code> field on campaign
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Loaded events
                    </Typography>
                    <Typography variant="h4">{events.length}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last {events.length} events from{" "}
                      <code>engagements</code> sub-collection
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Recent engagement events */}
      {!isCreateMode && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent engagement events
          </Typography>

          {eventsLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {eventsError && (
            <Typography color="error" sx={{ mt: 1 }}>
              {eventsError}
            </Typography>
          )}

          {!eventsLoading && !eventsError && (
            <TableContainer
              component={Paper}
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Device brand</TableCell>
                    <TableCell>Device name</TableCell>
                    <TableCell>OS</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>{formatDateTime(ev.createdAt)}</TableCell>
                      <TableCell>{ev.deviceBrand ?? "—"}</TableCell>
                      <TableCell>{ev.deviceName ?? "—"}</TableCell>
                      <TableCell>{ev.deviceOS ?? "—"}</TableCell>
                      <TableCell>{ev.deviceType ?? "—"}</TableCell>
                    </TableRow>
                  ))}

                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          align="center"
                          variant="body2"
                          sx={{ py: 2 }}
                          color="text.secondary"
                        >
                          No engagement events recorded yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Edit / Create dialog */}
      <Dialog
        open={editOpen}
        onClose={closeEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isCreateMode ? "Create campaign" : "Edit campaign"}
        </DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            {editForm && (
              <>
                <TextField
                  label="Name"
                  fullWidth
                  margin="normal"
                  value={editForm.name}
                  onChange={handleEditChange("name")}
                  required
                />
                <TextField
                  label="Description"
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={2}
                  value={editForm.description}
                  onChange={handleEditChange("description")}
                />
                <TextField
                  label="Target URL"
                  fullWidth
                  margin="normal"
                  value={editForm.targetUrl}
                  onChange={handleEditChange("targetUrl")}
                />
                <TextField
                  label="Short URL (QR)"
                  fullWidth
                  margin="normal"
                  value={editForm.url}
                  onChange={handleEditChange("url")}
                  helperText="The URL encoded in the QR on the unit"
                />

                <TextField
                  label="Locations (one per line)"
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={3}
                  value={editForm.locationsText}
                  onChange={handleEditChange("locationsText")}
                />

                <Box sx={{ mt: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.active}
                        onChange={handleEditChange("active")}
                      />
                    }
                    label="Active"
                  />
                </Box>

                {editError && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {editError}
                  </Typography>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditDialog} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={editSaving}>
              {editSaving
                ? "Saving..."
                : isCreateMode
                ? "Create campaign"
                : "Save changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </MainLayout>
  );
}