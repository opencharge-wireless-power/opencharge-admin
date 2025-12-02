// src/pages/CampaignListPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
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
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

// If you support multiple brands later, this can become dynamic
const BRAND_ID = "starbucks";

interface CampaignListItem {
  id: string;
  name: string;
  active: boolean;
  engagements: number;
  locationCount: number;
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
}

export function CampaignListPage() {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const campaignsRef = collection(db, "engage", BRAND_ID, "campaigns");
        const q = query(campaignsRef, orderBy("createdAt", "desc"));

        const snap = await getDocs(q);

        const items: CampaignListItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const createdTs = data.createdAt as Timestamp | undefined;

          return {
            id: docSnap.id,
            name: (data.name as string | undefined) ?? "Untitled campaign",
            active: (data.active as boolean | undefined) ?? false,
            engagements: (data.engagements as number | undefined) ?? 0,
            locationCount: Array.isArray(data.locationIds)
              ? data.locationIds.length
              : 0,
            url: data.url as string | undefined,
            targetUrl: data.targetUrl as string | undefined,
            createdAt: createdTs ? createdTs.toDate() : undefined,
          };
        });

        setCampaigns(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load campaigns";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchCampaigns();
  }, []);

  return (
    <MainLayout>
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

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/campaigns/new")}
        >
          New campaign
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Locations</TableCell>
                <TableCell>Engagements</TableCell>
                <TableCell>Target URL</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} hover>
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
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/campaigns/${c.id}`)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Stack>
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
                      No campaigns yet. Click “New campaign” to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </MainLayout>
  );
}