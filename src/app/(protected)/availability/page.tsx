import { Suspense } from 'react';
import { AvailabilityPanel } from '@/components/availability-panel';
import { Skeleton } from '@/components/ui/skeleton';

function AvailabilityPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Availability
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Assign available tasks to idle members
        </p>
      </div>

      <Suspense fallback={<AvailabilityPanelSkeleton />}>
        <AvailabilityPanel />
      </Suspense>
    </div>
  );
}
