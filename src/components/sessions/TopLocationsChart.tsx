// src/components/sessions/TopLocationsChart.tsx
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface TopLocation {
  locationId?: string;
  locationName: string;
  sessions: number;
  totalDurationMinutes: number;
}

interface TopLocationsChartProps {
  locations: TopLocation[];
}

const chartConfig = {
  sessions: {
    label: "Sessions",
    color: "var(--chart-2)",
  },
  label: {
    color: "var(--background)",
  },
} satisfies ChartConfig;

export function TopLocationsChart({ locations }: TopLocationsChartProps) {
  // Transform data for the chart
  const chartData = locations.map((loc) => ({
    location: loc.locationName,
    sessions: loc.sessions,
    fullName: loc.locationName,
  }));

  if (locations.length === 0) {
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Top 5 locations by sessions (last 7 days)</CardTitle>
          <CardDescription>
            Locations with the most charging sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">
            No sessions recorded in the last 7 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Top 5 locations by sessions (last 7 days)</CardTitle>
        <CardDescription>
          Locations with the most charging sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              left: 0,
              right: 16,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="location"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                // Truncate long location names
                return value.length > 20 ? `${value.slice(0, 20)}...` : value;
              }}
              hide
            />
            <XAxis dataKey="sessions" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="sessions"
              layout="vertical"
              fill="var(--color-sessions)"
              radius={4}
            >
              <LabelList
                dataKey="location"
                position="insideLeft"
                offset={8}
                className="fill-[--color-label]"
                fontSize={14}
                fontWeight={500}
                formatter={(value: string) => {
                  // Truncate for label
                  return value.length > 15 ? `${value.slice(0, 15)}...` : value;
                }}
              />
              <LabelList
                dataKey="sessions"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}