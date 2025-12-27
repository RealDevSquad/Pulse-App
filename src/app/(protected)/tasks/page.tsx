import { getCachedTasks, type TaskSortField, type SortOrder, type TaskStatusFilter } from '@/lib/tasks-cache';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TasksFilterBar } from '@/components/tasks-filter-bar';
import { TasksTable } from '@/components/tasks-table';
import { FutureTasksTable, type FutureSortField } from '@/components/future-tasks-table';
import { TaskActionsMenu } from '@/components/task-actions-menu';
import Link from 'next/link';
import { cn, getStatusStyle, getPriorityStyle, getTypeStyle, formatRelativeTime } from '@/lib/utils';

type TaskTab = 'current' | 'overdue' | 'future';

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

const futureSortableColumns: { key: FutureSortField; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'priority', label: 'Priority' },
  { key: 'type', label: 'Type' },
  { key: 'updatedAt', label: 'Updated' },
  { key: 'createdAt', label: 'Created' },
];

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

interface FutureFilterState {
  sortBy: FutureSortField;
  sortOrder: SortOrder;
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

function buildFutureUrl(filters: FutureFilterState, overrides: Partial<FutureFilterState & { page: number }> = {}) {
  const params = new URLSearchParams();
  params.set('tab', 'future');
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('page', String(overrides.page ?? 1));
  return `/tasks?${params.toString()}`;
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}



export default async function TasksPage({ searchParams }: PageProps) {
  // Access is already checked in layout
  const params = await searchParams;

  const tab: TaskTab = params.tab === 'future' ? 'future' : params.tab === 'overdue' ? 'overdue' : 'current';
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            {total} overdue tasks
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <Link
              href="/tasks?tab=current"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
                'hover:bg-background/50'
              )}
            >
              Current
            </Link>
            <Link
              href="/tasks?tab=overdue"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
                'bg-background text-foreground shadow'
              )}
            >
              Overdue
            </Link>
            <Link
              href="/tasks?tab=future"
              className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
                'hover:bg-background/50'
              )}
            >
              Future
            </Link>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <TasksTable tasks={tasks} filters={filters} />
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {tasks.map((task) => {
            const statusInfo = getStatusStyle(task.status);
            const updatedTime = formatRelativeTime(task.updatedAt || task.updated_at);
            return (
              <div key={task.id} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://status.realdevsquad.com/tasks/${task.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium line-clamp-2 hover:underline"
                    >
                      {task.title}
                    </a>
                    {task.type && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Type: {task.type}
                      </div>
                    )}
                  </div>
                  <span className={statusInfo.className}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {task.assigneeUser ? (
                    <Link href={`/member/${task.assignee}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assigneeUser.picture?.url} alt={task.assigneeUser.username} />
                        <AvatarFallback className="text-xs">
                          {getInitials(task.assigneeUser.first_name, task.assigneeUser.last_name, task.assigneeUser.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm hover:underline">
                        {task.assigneeUser.first_name} {task.assigneeUser.last_name}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{updatedTime}</span>
                    <TaskActionsMenu
                      taskId={task.id}
                      taskTitle={task.title}
                      taskStatus={task.status}
                      taskType={task.type}
                      taskPriority={task.priority}
                      taskEndsOn={task.endsOn}
                      hasAssignee={!!task.assignee}
                      assigneeName={task.assigneeUser ? `${task.assigneeUser.first_name} ${task.assigneeUser.last_name}` : undefined}
                      assigneePicture={task.assigneeUser?.picture?.url}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No overdue tasks found.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={page <= 1}
              >
                <Link
                  href={`/tasks?tab=overdue&page=${page - 1}`}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={!hasMore}
              >
                <Link
                  href={`/tasks?tab=overdue&page=${page + 1}`}
                  className={!hasMore ? 'pointer-events-none opacity-50' : ''}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'future') {
    // Future tasks tab - backlog/todo tasks
    const sortBy = (futureSortableColumns.find(c => c.key === params.sortBy)?.key || 'updatedAt') as FutureSortField;
    const futureFilters: FutureFilterState = { sortBy, sortOrder };

    // Fetch tasks - use updatedAt for DB query, then sort in memory for priority/type
    const { tasks, total, hasMore } = await getCachedTasks({
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      sortBy: sortBy === 'priority' || sortBy === 'type' ? 'updatedAt' : sortBy,
      sortOrder: sortBy === 'priority' || sortBy === 'type' ? 'desc' : sortOrder,
      statusFilter: 'backlog',
    });

    // Sort by priority or type in memory if needed
    let sortedTasks = tasks;
    if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, TBD: 3 };
      sortedTasks = [...tasks].sort((a, b) => {
        const aVal = priorityOrder[a.priority?.toUpperCase() || ''] ?? 4;
        const bVal = priorityOrder[b.priority?.toUpperCase() || ''] ?? 4;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    } else if (sortBy === 'type') {
      sortedTasks = [...tasks].sort((a, b) => {
        const aVal = a.type?.toLowerCase() || 'zzz';
        const bVal = b.type?.toLowerCase() || 'zzz';
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            {total} future tasks in backlog
          </p>
        </div>

        {/* Tabs */}
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <Link
            href="/tasks?tab=current"
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
              'hover:bg-background/50'
            )}
          >
            Current
          </Link>
          <Link
            href="/tasks?tab=overdue"
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
              'hover:bg-background/50'
            )}
          >
            Overdue
          </Link>
          <Link
            href="/tasks?tab=future"
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
              'bg-background text-foreground shadow'
            )}
          >
            Future
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <FutureTasksTable tasks={sortedTasks} filters={futureFilters} />
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {sortedTasks.map((task) => {
            const priorityInfo = getPriorityStyle(task.priority);
            const typeInfo = getTypeStyle(task.type);
            const createdTime = formatRelativeTime(task.createdAt);
            return (
              <div key={task.id} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={`https://status.realdevsquad.com/tasks/${task.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 font-medium line-clamp-2 hover:underline"
                  >
                    {task.title}
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {task.priority && (
                    <span className={priorityInfo.className}>
                      {priorityInfo.label}
                    </span>
                  )}
                  {task.priority && task.type && (
                    <span className="text-muted-foreground">•</span>
                  )}
                  {task.type && (
                    <span className={typeInfo.className}>
                      {typeInfo.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Created: {createdTime}</span>
                  {task.github?.issue?.html_url && (
                    <a
                      href={task.github.issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      GitHub
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {sortedTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No future tasks found.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={page <= 1}
              >
                <Link
                  href={buildFutureUrl(futureFilters, { page: page - 1 })}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={!hasMore}
              >
                <Link
                  href={buildFutureUrl(futureFilters, { page: page + 1 })}
                  className={!hasMore ? 'pointer-events-none opacity-50' : ''}
                >
                  Next
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">
          {total} tasks found
        </p>
      </div>

      {/* Tabs and Filter */}
      <div className="flex items-center gap-4">
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <Link
            href="/tasks?tab=current"
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
              'bg-background text-foreground shadow'
            )}
          >
            Current
          </Link>
          <Link
            href="/tasks?tab=overdue"
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
              'hover:bg-background/50'
            )}
          >
            Overdue
          </Link>
          <Link
            href="/tasks?tab=future"
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all',
              'hover:bg-background/50'
            )}
          >
            Future
          </Link>
        </div>
        <TasksFilterBar filters={filters} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <TasksTable tasks={tasks} filters={filters} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {tasks.map((task) => {
          const statusInfo = getStatusStyle(task.status);
          const updatedTime = formatRelativeTime(task.updatedAt || task.updated_at);
          return (
            <div key={task.id} className="p-4 rounded-lg border space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://status.realdevsquad.com/tasks/${task.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium line-clamp-2 hover:underline"
                  >
                    {task.title}
                  </a>
                  {task.type && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Type: {task.type}
                    </div>
                  )}
                </div>
                <span className={statusInfo.className}>
                  {statusInfo.label}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                {task.assigneeUser ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assigneeUser.picture?.url} alt={task.assigneeUser.username} />
                      <AvatarFallback className="text-xs">
                        {getInitials(task.assigneeUser.first_name, task.assigneeUser.last_name, task.assigneeUser.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {task.assigneeUser.first_name} {task.assigneeUser.last_name}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{updatedTime}</span>
                  <TaskActionsMenu
                    taskId={task.id}
                    taskTitle={task.title}
                    taskStatus={task.status}
                    taskType={task.type}
                    taskPriority={task.priority}
                    taskEndsOn={task.endsOn}
                    hasAssignee={!!task.assignee}
                    assigneeName={task.assigneeUser ? `${task.assigneeUser.first_name} ${task.assigneeUser.last_name}` : undefined}
                    assigneePicture={task.assigneeUser?.picture?.url}
                  />
                </div>
              </div>

              {task.github?.issue?.html_url && (
                <a
                  href={task.github.issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on GitHub
                </a>
              )}

              {task.status?.toUpperCase() === 'IN_PROGRESS' && task.percentCompleted !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{task.percentCompleted}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${task.percentCompleted}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No tasks found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page <= 1}
            >
              <Link
                href={buildUrl(filters, { page: page - 1 })}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={!hasMore}
            >
              <Link
                href={buildUrl(filters, { page: page + 1 })}
                className={!hasMore ? 'pointer-events-none opacity-50' : ''}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
