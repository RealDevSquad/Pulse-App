import { getCachedTasks, type TaskSortField, type SortOrder, type TaskStatusFilter } from '@/lib/tasks-cache';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TasksContent } from '@/components/tasks-content';
import { TasksTable } from '@/components/tasks-table';
import { TasksMobileCards } from '@/components/tasks-mobile-cards';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TaskTab = 'current' | 'overdue';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    sortBy?: string;
    sortOrder?: string;
    status?: string;
    tab?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

const sortableColumns: { key: TaskSortField; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Updated' },
  { key: 'createdAt', label: 'Created' },
  { key: 'percentCompleted', label: 'Progress' },
  { key: 'endsOn', label: 'Due Date' },
];

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState & { page: number }> = {}) {
  const params = new URLSearchParams();
  params.set('tab', 'current');
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('status', overrides.statusFilter ?? filters.statusFilter);
  params.set('page', String(overrides.page ?? 1));
  return `/tasks?${params.toString()}`;
}



export default async function TasksPage({ searchParams }: PageProps) {
  // Access is already checked in layout
  const session = await getSession();
  const isRoot = session?.userId ? isRootUser(session.userId) : false;
  const params = await searchParams;

  const tab: TaskTab = params.tab === 'overdue' ? 'overdue' : 'current';
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as SortOrder;

  // Overdue tab - shows assigned non-done tasks past due date
  if (tab === 'overdue') {
    const sortBy = (sortableColumns.find(c => c.key === params.sortBy)?.key || 'updatedAt') as TaskSortField;
    const filters: FilterState = { sortBy, sortOrder, statusFilter: 'overdue' as TaskStatusFilter };

    const { tasks, total, hasMore } = await getCachedTasks({
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      sortBy,
      sortOrder,
      statusFilter: 'overdue',
    });

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {total} overdue tasks
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <Link
              href="/tasks?tab=current"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
                'hover:bg-background/50'
              )}
            >
              Current
            </Link>
            <Link
              href="/tasks?tab=overdue"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
                'bg-background text-foreground shadow-sm'
              )}
            >
              Overdue
            </Link>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <TasksTable tasks={tasks} filters={filters} isRoot={isRoot} />
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          <TasksMobileCards tasks={tasks} isRoot={isRoot} isOverdueTab />
        </div>

        {/* Pagination - sticky at bottom */}
        {totalPages > 1 && (
          <div className="sticky bottom-0 flex items-center justify-between gap-4 py-4 border-t bg-background">
            <p className="text-sm text-muted-foreground shrink-0">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={page <= 1}
                className="h-10"
              >
                <Link
                  href={`/tasks?tab=overdue&page=${page - 1}`}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={!hasMore}
                className="h-10"
              >
                <Link
                  href={`/tasks?tab=overdue&page=${page + 1}`}
                  className={!hasMore ? 'pointer-events-none opacity-50' : ''}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Current tasks tab (default)
  const sortBy = (sortableColumns.find(c => c.key === params.sortBy)?.key || 'updatedAt') as TaskSortField;
  const statusFilter = (['all', 'active', 'review', 'completed', 'blocked', 'backlog'].includes(params.status || '')
    ? params.status
    : 'active') as TaskStatusFilter;

  const filters: FilterState = { sortBy, sortOrder, statusFilter };

  const { tasks, total, hasMore } = await getCachedTasks({
    limit: ITEMS_PER_PAGE,
    offset: (page - 1) * ITEMS_PER_PAGE,
    sortBy,
    sortOrder,
    statusFilter,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {total} tasks found
        </p>
      </div>

      {/* Filter Bar + Table/Cards with loading state */}
      <TasksContent
        tasks={tasks}
        filters={filters}
        isRoot={isRoot}
        tabsSlot={
          <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <Link
              href="/tasks?tab=current"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
                'bg-background text-foreground shadow-sm'
              )}
            >
              Current
            </Link>
            <Link
              href="/tasks?tab=overdue"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
                'hover:bg-background/50'
              )}
            >
              Overdue
            </Link>
          </div>
        }
      />

      {/* Pagination - sticky at bottom */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-4 py-4 border-t bg-background">
          <p className="text-sm text-muted-foreground shrink-0">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page <= 1}
              className="h-10"
            >
              <Link
                href={buildUrl(filters, { page: page - 1 })}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={!hasMore}
              className="h-10"
            >
              <Link
                href={buildUrl(filters, { page: page + 1 })}
                className={!hasMore ? 'pointer-events-none opacity-50' : ''}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
