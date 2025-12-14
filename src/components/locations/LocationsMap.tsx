// src/components/locations/LocationsMap.tsx
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Fix Leaflet marker icons
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

// Keep interface identical to LocationsPage
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

// Fit map bounds helper
function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds.length) return;
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

  const defaultCenter: [number, number] = [-29.0, 24.0];

  const bounds: [number, number][] = useMemo(
    () =>
      locationsWithCoords.map((loc) => [loc.lat!, loc.lng!]),
    [locationsWithCoords]
  );

  return (
    <div className="h-[500px] rounded-lg overflow-hidden border">
      <MapContainer
        center={defaultCenter}
        zoom={5}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {bounds.length > 0 && <FitBounds bounds={bounds} />}

        {locationsWithCoords.map((loc) => (
          <Marker key={loc.id} position={[loc.lat!, loc.lng!]}>
            <Popup>
              <div className="max-w-[260px] space-y-2">
                <div>
                  <p className="text-sm font-semibold">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {loc.city ?? "-"} · {loc.category ?? "-"}
                  </p>
                </div>

                <div className="text-sm">
                  <p>Sessions: {loc.totalSessions}</p>
                  <p>
                    Units in use: {loc.unitInUse}/{loc.unitTotal}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={loc.active ? "default" : "secondary"}>
                    {loc.active ? "Active" : "Inactive"}
                  </Badge>

                  {(loc.hasActivePromotion || loc.hasActivePromotions) && (
                    <Badge variant="outline">Promo</Badge>
                  )}
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/locations/${loc.id}`)}
                >
                  Open details
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
