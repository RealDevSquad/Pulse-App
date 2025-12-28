import { getCachedTasks, type TaskSortField, type SortOrder, type TaskStatusFilter } from '@/lib/tasks-cache';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TasksFilterBar } from '@/components/tasks-filter-bar';
import { TasksTable } from '@/components/tasks-table';
import { TaskActionsMenu } from '@/components/task-actions-menu';
import Link from 'next/link';
import { cn, getStatusBadgeStyle, formatRelativeTime } from '@/lib/utils';

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
        <div className="md:hidden space-y-3">
          {tasks.map((task) => {
            const statusInfo = getStatusBadgeStyle(task.status);
            const updatedTime = formatRelativeTime(task.updatedAt || task.updated_at);
            const { text: dueText, isOverdue } = (() => {
              if (!task.endsOn) return { text: '-', isOverdue: false };
              const ms = task.endsOn > 1e12 ? task.endsOn : task.endsOn * 1000;
              const now = Date.now();
              const diff = ms - now;
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const isOver = days < 0;
              let text: string;
              if (days < -365) text = `${Math.floor(-days / 365)}y overdue`;
              else if (days < -30) text = `${Math.floor(-days / 30)}mo overdue`;
              else if (days < -7) text = `${Math.floor(-days / 7)}w overdue`;
              else if (days < -1) text = `${-days}d overdue`;
              else if (days === -1) text = '1d overdue';
              else text = 'Due today';
              return { text, isOverdue: isOver };
            })();
            return (
              <div key={task.id} className="p-4 rounded-lg bg-card border shadow-sm space-y-3 overflow-hidden">
                {/* Header: Title + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://status.realdevsquad.com/tasks/${task.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary hover:underline transition-colors"
                    >
                      {task.title}
                    </a>
                  </div>
                  <span className={cn(statusInfo.className, 'shrink-0 text-xs')}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Assignee + Due Date */}
                <div className="flex items-center justify-between gap-2">
                  {task.assigneeUser ? (
                    <Link 
                      href={`/member/${task.assignee}`} 
                      className="flex items-center gap-2 min-w-0 py-1 hover:text-primary transition-colors group"
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={task.assigneeUser.picture?.url} alt={task.assigneeUser.username} />
                        <AvatarFallback className="text-xs">
                          {getInitials(task.assigneeUser.first_name, task.assigneeUser.last_name, task.assigneeUser.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground group-hover:underline truncate">
                        {task.assigneeUser.first_name} {task.assigneeUser.last_name}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    isOverdue 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {dueText}
                  </span>
                </div>

                {/* Footer: Updated time + Actions */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground/70">{updatedTime}</span>
                  {isRoot && (
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
                  )}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
              <span>No overdue tasks found</span>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 pt-2">
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

      {/* Tabs and Filter */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
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
        <TasksFilterBar filters={filters} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <TasksTable tasks={tasks} filters={filters} isRoot={isRoot} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {tasks.map((task) => {
          const statusInfo = getStatusBadgeStyle(task.status);
          const updatedTime = formatRelativeTime(task.updatedAt || task.updated_at);
          const isDone = task.status?.toUpperCase() === 'COMPLETED' || task.status?.toUpperCase() === 'DONE';
          const dueInfo = (() => {
            if (!task.endsOn || task.status?.toUpperCase() === 'BACKLOG') return null;
            const ms = task.endsOn > 1e12 ? task.endsOn : task.endsOn * 1000;
            const now = Date.now();
            const diff = ms - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const isOverdue = days < 0 && !isDone;
            let text: string;
            if (days < -365) text = isDone ? `${Math.floor(-days / 365)}y ago` : `${Math.floor(-days / 365)}y overdue`;
            else if (days < -30) text = isDone ? `${Math.floor(-days / 30)}mo ago` : `${Math.floor(-days / 30)}mo overdue`;
            else if (days < -7) text = isDone ? `${Math.floor(-days / 7)}w ago` : `${Math.floor(-days / 7)}w overdue`;
            else if (days < -1) text = isDone ? `${-days}d ago` : `${-days}d overdue`;
            else if (days === -1) text = isDone ? '1d ago' : '1d overdue';
            else if (days === 0) text = 'Today';
            else if (days === 1) text = 'Tomorrow';
            else if (days < 7) text = `In ${days}d`;
            else if (days < 30) text = `In ${Math.floor(days / 7)}w`;
            else text = `In ${Math.floor(days / 30)}mo`;
            return { text, isOverdue };
          })();
          return (
            <div key={task.id} className="p-4 rounded-lg bg-card border shadow-sm space-y-3 overflow-hidden">
              {/* Header: Title + Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://status.realdevsquad.com/tasks/${task.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary hover:underline transition-colors"
                  >
                    {task.title}
                  </a>
                </div>
                <div className="shrink-0 flex flex-col gap-1">
                  <span className={cn(statusInfo.className, 'text-xs')}>
                    {statusInfo.label}
                  </span>
                  {/* Progress bar for in-progress tasks */}
                  {task.status?.toUpperCase() === 'IN_PROGRESS' && task.percentCompleted !== undefined && (
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${task.percentCompleted}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{task.percentCompleted}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee + Due Date */}
              <div className="flex items-center justify-between gap-2">
                {task.assigneeUser ? (
                  <Link 
                    href={`/member/${task.assignee}`} 
                    className="flex items-center gap-2 min-w-0 py-1 hover:text-primary transition-colors group"
                  >
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={task.assigneeUser.picture?.url} alt={task.assigneeUser.username} />
                      <AvatarFallback className="text-xs">
                        {getInitials(task.assigneeUser.first_name, task.assigneeUser.last_name, task.assigneeUser.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground group-hover:underline truncate">
                      {task.assigneeUser.first_name} {task.assigneeUser.last_name}
                    </span>
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
                {dueInfo && (
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    dueInfo.isOverdue 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {dueInfo.text}
                  </span>
                )}
              </div>

              {/* Footer: Updated time + GitHub + Actions */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground/70">{updatedTime}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {task.github?.issue?.html_url && (
                    <a
                      href={task.github.issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View on GitHub"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {isRoot && (
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
                  )}
                </div>
              </div>


            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
            <span>No tasks found</span>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
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
