// src/components/cards/overview-card.tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { type LucideIcon } from "lucide-react"


interface OverviewCard {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  valueClass?: string
  badgeVariant?: "default" | "destructive"
}

interface StatticsCardsProps {
  stats: OverviewCard[]
  /** 
   * Number of cards per row at large screen size 
   * (default = 4; auto adjusts on smaller screens)
   */
  columns?: number
}

export function OverviewCards({ stats, columns = 4 }: StatticsCardsProps) {
  // Dynamically create grid column classes based on `columns`
  const gridCols = {
    1: "grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
    5: "md:grid-cols-3 lg:grid-cols-5",
  }[columns] || "md:grid-cols-2 lg:grid-cols-4"

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="overflow-hidden shadow-none border bg-neutral-900 text-white  mb-4"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="text-sm font-medium opacity-80">{stat.title}</div>
            <div className="rounded-lg p-2 bg-white/10">
              <stat.icon className="h-4 w-4 text-white" />
            </div>
          </CardHeader>

          <CardContent>
          <div className={`text-2xl font-bold `}>{stat.value}</div>
            <p className={`text-xs opacity-75 mt-1 ${stat.valueClass ?? ""}`}>{stat.subtitle}</p>
            <div className="mt-2 flex items-center text-xs">
              <span
                className={`font-medium ${
                  stat.trendUp ? "text-green-900" : "text-red-500"
                }`}
              >
                {stat.trend}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
