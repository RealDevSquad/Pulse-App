import { getCachedTasks, type TaskSortField, type SortOrder, type TaskStatusFilter } from '@/lib/tasks-cache';
import { getSession } from '@/lib/auth';
import { isRootUser, isAdminUser } from '@/lib/users';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TasksContent } from '@/components/tasks-content';
import Link from 'next/link';

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

function buildUrl(filters: FilterState, overrides: Partial<FilterState & { page: number; tab: string }> = {}) {
  const params = new URLSearchParams();
  params.set('tab', overrides.tab ?? 'current');
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('status', overrides.statusFilter ?? filters.statusFilter);
  params.set('page', String(overrides.page ?? 1));
  return `/tasks?${params.toString()}`;
}

export default async function TasksPage({ searchParams }: PageProps) {
  // Fetch session and params in parallel
  const [session, params] = await Promise.all([
    getSession(),
    searchParams,
  ]);

  const tab: TaskTab = params.tab === 'overdue' ? 'overdue' : 'current';
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as SortOrder;
  const sortBy = (sortableColumns.find(c => c.key === params.sortBy)?.key || 'updatedAt') as TaskSortField;

  // Overdue tab - shows assigned non-done tasks past due date
  if (tab === 'overdue') {
    const filters: FilterState = { sortBy, sortOrder, statusFilter: 'overdue' as TaskStatusFilter };

    // Fetch isRoot, isAdmin, and tasks in parallel
    const [isRoot, isAdmin, { tasks, total, hasMore }] = await Promise.all([
      session?.userId ? isRootUser(session.userId) : Promise.resolve(false),
      session?.userId ? isAdminUser(session.userId) : Promise.resolve(false),
      getCachedTasks({
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
        sortBy,
        sortOrder,
        statusFilter: 'overdue',
      }),
    ]);

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {total} overdue tasks
          </p>
        </div>

        {/* Content with integrated tabs */}
        <TasksContent
          tasks={tasks}
          filters={filters}
          isRoot={isRoot}
          isAdmin={isAdmin}
          activeTab="overdue"
          isOverdueTab
          showFilters={false}
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
  const statusFilter = (['all', 'active', 'review', 'completed', 'blocked', 'backlog'].includes(params.status || '')
    ? params.status
    : 'active') as TaskStatusFilter;

  const filters: FilterState = { sortBy, sortOrder, statusFilter };

  // Fetch isRoot, isAdmin, and tasks in parallel
  const [isRoot, isAdmin, { tasks, total, hasMore }] = await Promise.all([
    session?.userId ? isRootUser(session.userId) : Promise.resolve(false),
    session?.userId ? isAdminUser(session.userId) : Promise.resolve(false),
    getCachedTasks({
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      sortBy,
      sortOrder,
      statusFilter,
    }),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {total} tasks found
        </p>
      </div>

      {/* Content with integrated tabs and filters */}
      <TasksContent
        tasks={tasks}
        filters={filters}
        isRoot={isRoot}
        isAdmin={isAdmin}
        activeTab="current"
        showFilters={true}
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
