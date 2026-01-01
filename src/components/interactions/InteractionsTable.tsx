import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type InteractionRow = {
  id: string
  timestamp?: Date
  canonType: string
  rawType?: string
  locationName?: string
  unitName?: string
}

function formatTypeLabel(s: string) {
  return s.replaceAll("_", " ")
}

export function InteractionsTable({
  rows,
  onRowClick,
}: {
  rows: InteractionRow[]
  onRowClick?: (row: InteractionRow) => void
}) {
  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date/Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Raw type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className={onRowClick ? "cursor-pointer" : undefined}
              onClick={() => onRowClick?.(r)}
            >
              <TableCell>{r.timestamp ? r.timestamp.toLocaleString() : "—"}</TableCell>
              <TableCell className="capitalize">{formatTypeLabel(r.canonType)}</TableCell>
              <TableCell>{r.locationName ?? "—"}</TableCell>
              <TableCell>{r.unitName ?? "—"}</TableCell>
              <TableCell className="text-right text-muted-foreground">{r.rawType ?? "—"}</TableCell>
            </TableRow>
          ))}

          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No interactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}