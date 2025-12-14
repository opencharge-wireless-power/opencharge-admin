// src/components/locations/LocationInfoCards.tsx

import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, ORDERED_DAYS } from "@/utils/Format";
import type { Location } from "@/types/Opencharge";
import { cn } from "@/lib/utils";

interface LocationInfoCardsProps {
  location: Location;
}



export function InfoItem({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}


export function LocationInfoCards({ location }: LocationInfoCardsProps) {
  const qrUrl = location.qrCode || "";

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(qrUrl);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Details Card */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Details</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <InfoItem label="Name" value={location.name} />

          <InfoItem
            label="Address"
            value={location.address || "No address"}
            className="sm:col-span-2"
          />

          <InfoItem
            label="City"
            value={`${location.city || "-"}, ${location.country || "-"}`}
          />

          <InfoItem label="Category" value={location.category || "-"} />

          <InfoItem label="Brand" value={location.brand || "-"} />

          <InfoItem
            label="Store location"
            value={location.storeLocation || "-"}
          />

          <InfoItem
            label="Priority"
            value={location.priority ?? "Not set"}
          />

          <InfoItem
            label="Coordinates"
            value={
              location.lat && location.lng
                ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                : "Not set"
            }
          />
        </CardContent>
      </Card>


      {/* QR Code Card */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">QR code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="border rounded-md p-2 bg-background shrink-0">
              <QRCodeSVG value={qrUrl} size={132} />
            </div>

            <div className="flex-1 space-y-2">
              <p className="text-sm break-all">{qrUrl}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy URL
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Usage & units</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoItem
            label="Units in use / total"
            value={`${location.unitInUse} / ${location.unitTotal}`}
          />
          <Separator />
          <InfoItem label="Total sessions" value={location.totalSessions} />
          <Separator />
          <InfoItem
            label="Last availability update"
            value={formatDateTime(location.lastAvailabilityUpdate)}
          />
        </CardContent>
      </Card>

      {/* Opening Hours Card */}
      <Card className="lg:col-span-3 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Opening hours</CardTitle>
        </CardHeader>
        <CardContent>
          {location.openHours ? (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
              {ORDERED_DAYS.map((day) => (
                <div key={day} className="space-y-1">
                  <p className="text-sm font-medium uppercase">{day}</p>
                  <p className="text-sm text-muted-foreground">
                    {location.openHours?.[day] ?? "Closed"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No opening hours configured.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
