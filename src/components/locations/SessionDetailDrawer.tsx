// src/components/locations/SessionDetailDrawer.tsx

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatDurationMinutes } from "@/utils/Format";
import type { Session, Location } from "@/types/Opencharge";

interface SessionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  location: Location;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function SessionDetailDrawer({
  open,
  onOpenChange,
  session,
  location,
}: SessionDetailDrawerProps) {
  if (!session) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Session details</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Overview Section */}
          <div>
            <h3 className="text-sm font-medium mb-3">Overview</h3>
            <div className="space-y-4">
              <InfoItem label="Session ID" value={session.id} />
              <InfoItem
                label="Location ID"
                value={session.locationId ?? location.id}
              />
              <InfoItem
                label="Unit"
                value={session.unitName ?? session.unitId ?? "-"}
              />
              <InfoItem
                label="Status"
                value={session.inProgress ? "In progress" : "Completed"}
              />
              <InfoItem
                label="Started"
                value={formatDateTime(session.startedAt)}
              />
              <InfoItem
                label="Ended"
                value={
                  session.inProgress
                    ? "—"
                    : formatDateTime(session.endedAt)
                }
              />
              <InfoItem
                label="Duration"
                value={
                  session.inProgress
                    ? "—"
                    : formatDurationMinutes(session.durationMinutes)
                }
              />
            </div>
          </div>

          {/* Raw Metadata Section */}
          {session.raw && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Raw metadata</h3>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[260px] font-mono">
                  {JSON.stringify(session.raw, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
