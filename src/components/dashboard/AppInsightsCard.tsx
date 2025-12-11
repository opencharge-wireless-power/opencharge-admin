import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AppInsightsCardProps {
  appAdoptionLoading: boolean
  appAdoption?: {
    total: number
    withApp: number
    uniqueUnitsWithApp: number
  }
  appAvgBatteryDelta30: number | null
  appTopLocations30: {
    locationLabel: string
    sessions: number
  }[]
}

export function AppInsightsCard({
  appAdoptionLoading,
  appAdoption,
  appAvgBatteryDelta30,
  appTopLocations30,
}: AppInsightsCardProps) {
  return (
    <Card className="mb-6 shadow-none border-0 bg-gray-100 text-gray-800">
      <CardHeader>
        <CardTitle>App insights (last 30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {appAdoptionLoading || !appAdoption ? (
          <p className="text-sm text-muted-foreground">
            Loading app usage insights…
          </p>
        ) : appAdoption.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions recorded in the last 30 days.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  App adoption
                </p>
                <p className="text-2xl font-bold">
                  {Math.round((appAdoption.withApp / appAdoption.total) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {appAdoption.withApp} of {appAdoption.total} sessions
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Units with app sessions
                </p>
                <p className="text-2xl font-bold">
                  {appAdoption.uniqueUnitsWithApp}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Devices that saw at least one app-linked session
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Avg battery delta (app)
                </p>
                <p className="text-2xl font-bold">
                  {appAvgBatteryDelta30 != null
                    ? `${appAvgBatteryDelta30.toFixed(0)}%`
                    : "–"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Where <code className="text-xs">appBatteryDelta</code> was reported
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">
                Top locations by app-linked sessions
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location (from app)</TableHead>
                    <TableHead className="text-right">App sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appTopLocations30.length > 0 ? (
                    appTopLocations30.map((row) => (
                      <TableRow key={row.locationLabel}>
                        <TableCell>{row.locationLabel}</TableCell>
                        <TableCell className="text-right">{row.sessions}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          No app location data yet.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
