// src/components/locations/CampaignsSection.tsx

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
import { formatShortDateTime } from "@/utils/Format";

interface LocationCampaign {
  id: string;
  brandId?: string;
  name: string;
  active: boolean;
  engagements: number;
  url?: string;
  targetUrl?: string;
  createdAt?: Date;
}

interface CampaignsSectionProps {
  campaigns: LocationCampaign[];
  loading?: boolean;
  error?: string | null;
}

export function CampaignsSection({
  campaigns,
  loading = false,
  error = null,
}: CampaignsSectionProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Campaigns at this location
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/campaigns")}
          >
            Manage in Campaigns
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

        {!loading && !error && campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No campaigns currently targeting this location.
          </p>
        )}

        {!loading && !error && campaigns.length > 0 && (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="border rounded-md p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">{c.name}</h4>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  {c.targetUrl ?? c.url ?? "No URL configured"}
                </p>

                <p className="text-xs text-muted-foreground">
                  Engagements: {c.engagements}
                  {c.createdAt &&
                    ` • Created ${formatShortDateTime(c.createdAt)}`}
                </p>

                {c.brandId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/campaigns/${c.brandId}/${c.id}`)}
                  >
                    View campaign detail
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
