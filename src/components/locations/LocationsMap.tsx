// src/components/locations/LocationsMap.tsx
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { Box, Button, Typography, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons without using "any"
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: () => string;
};

delete DefaultIcon._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Keep the interface structurally identical to your LocationsPage Location type
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
  openHours?: { [day: string]: string };
}

interface LocationsMapProps {
  locations: Location[];
}

// Helper component to fit map bounds to markers
function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds.length) return;
    // Fit all markers into view, with a bit of padding around edges
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, bounds]);

  return null;
}

export function LocationsMap({ locations }: LocationsMapProps) {
  const navigate = useNavigate();

  const locationsWithCoords = useMemo(
    () =>
      locations.filter(
        (loc) =>
          typeof loc.lat === "number" &&
          typeof loc.lng === "number" &&
          !Number.isNaN(loc.lat) &&
          !Number.isNaN(loc.lng)
      ),
    [locations]
  );

  // Default center: South Africa-ish, in case there are no locations yet
  const defaultCenter: [number, number] = [-29.0, 24.0];

  // Bounds for all markers
  const bounds: [number, number][] = useMemo(
    () =>
      locationsWithCoords.map((loc) => [loc.lat as number, loc.lng as number]),
    [locationsWithCoords]
  );

  return (
    <Box sx={{ height: 500, borderRadius: 2, overflow: "hidden" }}>
      <MapContainer
        center={defaultCenter}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit to markers once we know them */}
        {bounds.length > 0 && <FitBounds bounds={bounds} />}

        {locationsWithCoords.map((loc) => (
          <Marker key={loc.id} position={[loc.lat as number, loc.lng as number]}>
            <Popup>
              <Box sx={{ maxWidth: 260 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {loc.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {loc.city ?? "-"} · {loc.category ?? "-"}
                </Typography>

                <Box sx={{ mt: 1, mb: 1 }}>
                  <Typography variant="body2">
                    Sessions: {loc.totalSessions}
                  </Typography>
                  <Typography variant="body2">
                    Units in use: {loc.unitInUse}/{loc.unitTotal}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Chip
                    size="small"
                    label={loc.active ? "Active" : "Inactive"}
                    color={loc.active ? "success" : "default"}
                  />
                  {(loc.hasActivePromotion || loc.hasActivePromotions) && (
                    <Chip
                      size="small"
                      label="Promo"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>

                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  onClick={() => navigate(`/locations/${loc.id}`)}
                >
                  Open details
                </Button>
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}