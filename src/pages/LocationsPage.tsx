// src/pages/LocationsPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  TableContainer,
  CircularProgress,
  Box,
  Chip,
  Tabs,
  Tab,
} from "@mui/material";
import { LocationsMap } from "../components/locations/LocationsMap";

interface OpenHours {
  [day: string]: string; // e.g. "mon": "08:00-20:00"
}

interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  active: boolean;

  hasActivePromotion: boolean;
  hasActivePromotions: boolean;

  images: string[];

  lastAvailabilityUpdate?: Date;

  lat?: number;
  lng?: number;

  priority?: number;

  supportsOrdering: boolean;
  supportsPayments: boolean;
  supportsPromotions: boolean;

  totalSessions: number;
  unitInUse: number;
  unitTotal: number;

  openHours?: OpenHours;
}

function formatDateTime(date?: Date): string {
  if (!date) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("list");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const snapshot = await getDocs(collection(db, "locations"));
        const items: Location[] = snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;

          const lastAvailabilityTs = data.lastAvailabilityUpdate as
            | Timestamp
            | undefined;

          const images =
            Array.isArray(data.images) && data.images.length > 0
              ? (data.images as string[])
              : [];

          const openHours =
            data.openHours && typeof data.openHours === "object"
              ? (data.openHours as OpenHours)
              : undefined;

          const hasActivePromotion =
            typeof data.hasActivePromotion === "boolean"
              ? (data.hasActivePromotion as boolean)
              : false;

          const hasActivePromotions =
            typeof data.hasActivePromotions === "boolean"
              ? (data.hasActivePromotions as boolean)
              : hasActivePromotion; // fallback to single flag if needed

          return {
            id: doc.id,
            name: (data.name as string) ?? "Unnamed location",
            address: data.address as string | undefined,
            city: data.city as string | undefined,
            country: data.country as string | undefined,
            category: data.category as string | undefined,
            active:
              typeof data.active === "boolean"
                ? (data.active as boolean)
                : false,

            hasActivePromotion,
            hasActivePromotions,

            images,
            lastAvailabilityUpdate: lastAvailabilityTs
              ? lastAvailabilityTs.toDate()
              : undefined,

            lat:
              typeof data.lat === "number"
                ? (data.lat as number)
                : undefined,
            lng:
              typeof data.lng === "number"
                ? (data.lng as number)
                : undefined,

            priority:
              typeof data.priority === "number"
                ? (data.priority as number)
                : undefined,

            supportsOrdering:
              typeof data.supportsOrdering === "boolean"
                ? (data.supportsOrdering as boolean)
                : false,
            supportsPayments:
              typeof data.supportsPayments === "boolean"
                ? (data.supportsPayments as boolean)
                : false,
            supportsPromotions:
              typeof data.supportsPromotions === "boolean"
                ? (data.supportsPromotions as boolean)
                : false,

            totalSessions:
              typeof data.totalSessions === "number"
                ? (data.totalSessions as number)
                : 0,
            unitInUse:
              typeof data.unitInUse === "number"
                ? (data.unitInUse as number)
                : 0,
            unitTotal:
              typeof data.unitTotal === "number"
                ? (data.unitTotal as number)
                : 0,

            openHours,
          };
        });

        setLocations(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load locations";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchLocations();
  }, []);

  const handleViewChange = (
    _event: React.SyntheticEvent,
    newValue: "map" | "list"
  ) => {
    setView(newValue);
  };

  return (
    <MainLayout>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Locations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View all Opencharge locations on a map or as a detailed list.
          </Typography>
        </Box>

        <Tabs
          value={view}
          onChange={handleViewChange}
          aria-label="Locations view toggle"
        >
          <Tab label="Map view" value="map" />
          <Tab label="List view" value="list" />
        </Tabs>
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

      {!loading && !error && view === "map" && (
        <LocationsMap locations={locations} />
      )}

      {!loading && !error && view === "list" && (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Promotion</TableCell>
                <TableCell align="right">Units (in use / total)</TableCell>
                <TableCell align="right">Total sessions</TableCell>
                <TableCell>Last availability</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((loc) => {
                const hasPromo =
                  loc.hasActivePromotion || loc.hasActivePromotions;

                return (
                  <TableRow
                    key={loc.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/locations/${loc.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <Typography variant="subtitle2">{loc.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {loc.address ?? "-"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{loc.city ?? "-"}</TableCell>
                    <TableCell>{loc.category ?? "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={loc.active ? "Active" : "Inactive"}
                        size="small"
                        color={loc.active ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      {hasPromo ? (
                        <Chip
                          label="Promo active"
                          size="small"
                          color="primary"
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {loc.unitInUse}/{loc.unitTotal}
                    </TableCell>
                    <TableCell align="right">
                      {loc.totalSessions}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(loc.lastAvailabilityUpdate)}
                    </TableCell>
                  </TableRow>
                );
              })}

              {locations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography align="center" sx={{ py: 2 }}>
                      No locations found.
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