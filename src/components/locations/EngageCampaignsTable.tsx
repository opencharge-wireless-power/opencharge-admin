// src/components/locations/EngageCampaignsTable.tsx

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StoreEngageCampaign } from "@/types/Opencharge";

interface EngageCampaignsTableProps {
  campaigns: StoreEngageCampaign[];
  brandSlug: string;
  storeSlug: string;
  loading?: boolean;
  error?: string | null;
}

export function EngageCampaignsTable({
  campaigns,
  brandSlug,
  storeSlug,
  loading = false,
  error = null,
}: EngageCampaignsTableProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Engage campaigns at this store
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(
                `/engage/campaigns?brand=${encodeURIComponent(
                  brandSlug
                )}&store=${encodeURIComponent(storeSlug)}`
              )
            }
          >
            View all campaigns
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
            No Engage campaigns at this store yet.
          </p>
        )}

        {!loading && !error && campaigns.length > 0 && (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Engagements</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="text-sm font-medium">{c.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.active ? "default" : "secondary"}>
                        {c.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.engagements}
                    </TableCell>
                    <TableCell>
                      {c.targetUrl ? (
                        <span className="text-xs text-muted-foreground break-all">
                          {c.targetUrl}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
