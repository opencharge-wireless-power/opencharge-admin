// src/components/sessions/DeviceMixChart.tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
  type LabelProps,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface DeviceMixItem {
  deviceType: string;
  sessions: number;
  share: number; // %
}

interface DeviceMixChartProps {
  devices: DeviceMixItem[];
}

const chartConfig = {
  sessions: {
    label: "Sessions",
    color: "var(--chart-1)",
  },
  label: {
    color: "var(--background)",
  },
} satisfies ChartConfig;

export function DeviceMixChart({ devices }: DeviceMixChartProps) {
  // Transform data for the chart
  const chartData = devices.map((device) => ({
    deviceType: device.deviceType,
    sessions: device.sessions,
    share: device.share,
  }));

  if (devices.length === 0) {
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Device mix (last 7 days)</CardTitle>
          <CardDescription>
            Top device types seen in sessions over the last week
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">
            No device data available for the last 7 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Device mix (last 7 days)</CardTitle>
        <CardDescription>
          Top device types seen in sessions over the last week
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
              dataKey="deviceType"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                // Truncate long device names
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
                dataKey="deviceType"
                position="insideLeft"
                offset={8}
                className="fill-[--color-label]"
                fontSize={14}
                fontWeight={500}
                formatter={(value: string) => {
                  // Truncate for label and capitalize
                  const formatted = value.charAt(0).toUpperCase() + value.slice(1);
                  return formatted.length > 15
                    ? `${formatted.slice(0, 15)}...`
                    : formatted;
                }}
              />
              <LabelList
                dataKey="sessions"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
                content={(props: LabelProps) => {
                  const { x, y, width, height, value, index } = props;
                  if (typeof index === 'number' && chartData[index]) {
                    const share = chartData[index].share;
                    return (
                      <text
                        x={Number(x) + Number(width) + 20}
                        y={Number(y) + Number(height) / 2}
                        fill="currentColor"
                        textAnchor="start"
                        dominantBaseline="middle"
                        className="fill-foreground"
                        fontSize={14}
                      >
                        {`${value} (${share.toFixed(1)}%)`}
                      </text>
                    );
                  }
                  return (
                    <text
                      x={Number(x) + Number(width) + 8}
                      y={Number(y) + Number(height) / 2}
                      fill="currentColor"
                      textAnchor="start"
                      dominantBaseline="middle"
                      className="fill-foreground"
                      fontSize={12}
                    >
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}