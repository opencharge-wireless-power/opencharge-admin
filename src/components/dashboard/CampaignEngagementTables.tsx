// src/components/dashboard/CampaignEngagementTables.tsx
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  
  interface TopCampaign {
    brandName: string;
    campaignName: string;
    engagements: number;
  }
  
  interface BrandEngagement {
    brandId: string;
    brandName: string;
    engagements: number;
    campaignCount: number;
  }
  
  interface CampaignEngagementTablesProps {
    topCampaigns: TopCampaign[];
    brandEngagements: BrandEngagement[];
  }
  
  export function CampaignEngagementTables({
    topCampaigns,
    brandEngagements,
  }: CampaignEngagementTablesProps) {
    return (
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Top 5 campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Campaigns</CardTitle>
            <CardDescription>Ranked by engagement count</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Engagements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCampaigns.length > 0 ? (
                  topCampaigns.map((campaign, idx) => (
                    <TableRow key={`${campaign.brandName}-${campaign.campaignName}-${idx}`}>
                      <TableCell className="font-medium">
                        {campaign.brandName}
                      </TableCell>
                      <TableCell>{campaign.campaignName}</TableCell>
                      <TableCell className="text-right">
                        {campaign.engagements.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No campaign engagement data yet.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
  
        {/* Engagement by brand */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement by Brand</CardTitle>
            <CardDescription>Total engagements and campaign count</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Engagements</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandEngagements.length > 0 ? (
                  brandEngagements.map((brand) => (
                    <TableRow key={brand.brandId}>
                      <TableCell className="font-medium">
                        {brand.brandName}
                      </TableCell>
                      <TableCell className="text-right">
                        {brand.engagements.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {brand.campaignCount}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No brands or campaigns yet.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }