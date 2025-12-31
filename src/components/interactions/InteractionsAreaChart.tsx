import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InteractionPoint = {
  date: string; // YYYY-MM-DD
  interactions: number;
};

function formatTick(dateKey: string) {
  // minimal label like "Apr 3"
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InteractionsAreaChart({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle?: string;
  data: InteractionPoint[];
  className?: string;
}) {
  return (
    <Card className={cn("bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>

      <CardContent className="pt-4">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillInteractions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="currentColor" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
                tickFormatter={formatTick}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />

              <Tooltip
                cursor={{ strokeOpacity: 0.15 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const value = payload[0]?.value ?? 0;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow">
                      <div className="text-muted-foreground">{formatTick(String(label))}</div>
                      <div className="font-medium">{value} interactions</div>
                    </div>
                  );
                }}
              />

              <Area
                type="monotone"
                dataKey="interactions"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#fillInteractions)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}