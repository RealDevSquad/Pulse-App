import { SkeletonPulse } from '@/components/ui/skeleton';
import { TaskRequestsTableSkeleton } from '@/components/task-requests-table';
import { TaskRequestsMobileCardsSkeleton } from '@/components/task-requests-mobile-cards';

export default function TaskRequestsLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <SkeletonPulse className="h-8 w-48" />
        <SkeletonPulse className="h-5 w-32" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <SkeletonPulse className="h-10 w-[160px]" />
        <SkeletonPulse className="h-10 w-[160px]" />
        <SkeletonPulse className="h-10 w-[180px]" />
      </div>

      {/* Desktop Table Skeleton */}
      <div className="hidden md:block">
        <TaskRequestsTableSkeleton />
      </div>

      {/* Mobile Card Skeleton */}
      <div className="md:hidden">
        <TaskRequestsMobileCardsSkeleton />
      </div>
    </div>
  );
}
