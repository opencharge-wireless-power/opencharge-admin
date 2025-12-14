// src/components/locations/PromotionsSection.tsx

import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateRange } from "@/utils/Format";
import type { Promotion } from "@/types/Opencharge";

interface PromotionsSectionProps {
  locationId: string;
  promotions: Promotion[];
  loading?: boolean;
  error?: string | null;
}

export function PromotionsSection({
  locationId,
  promotions,
  loading = false,
  error = null,
}: PromotionsSectionProps) {
  const navigate = useNavigate();

  const activePromotions = promotions.filter((p) => p.isActive);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Active promotions</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(`/promotions?locationId=${encodeURIComponent(locationId)}`)
            }
          >
            Manage in Promotions
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && activePromotions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active promotions for this location.
          </p>
        )}

        {!loading && !error && activePromotions.length > 0 && (
          <div className="space-y-3">
            {activePromotions.map((promo) => (
              <div
                key={promo.id}
                className="border rounded-md p-3 flex gap-3"
              >
                {promo.imageUrl && (
                  <img
                    src={promo.imageUrl}
                    alt={promo.title}
                    className="w-20 h-20 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{promo.title}</h4>
                    <Badge variant="default">Active</Badge>
                  </div>
                  {promo.description && (
                    <p className="text-sm text-muted-foreground">
                      {promo.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateRange(promo.validFrom, promo.validTo)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
