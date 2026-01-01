import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Point = {
  date: string // YYYY-MM-DD
  total: number
  [k: string]: number | string
}

export function InteractionsStackedAreaChart({
  title,
  subtitle,
  data,
  typeKeys,
  onDayClick,
}: {
  title: string
  subtitle?: string
  data: Point[]
  typeKeys: string[]
  onDayClick?: (dateKey: string) => void
}) {
  const formatDate = (key: string) => {
    // show "Dec 30" etc
    const [y, m, d] = key.split("-").map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>

      <CardContent className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            onClick={(e: any) => {
              const payload = e?.activePayload?.[0]?.payload
              const dateKey = payload?.date
              if (dateKey && onDayClick) onDayClick(dateKey)
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip
              labelFormatter={(v) => formatDate(String(v))}
              formatter={(value: any, name: any) => [value, String(name).replaceAll("_", " ")]}
            />

            {/* Stacked areas by type */}
            {typeKeys.map((k) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stackId="1"
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}