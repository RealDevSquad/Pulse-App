import type { TodoAPI } from '@/types';

// =============================================================================
// TODO Service - Helper Functions
// Note: API calls are made client-side in the Todos page component
// because the todo API requires browser cookies for authentication.
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export type TodoStatusFilter = 'all' | 'watchlist' | 'deferred';
export type TodoSortField = 'title' | 'status' | 'priority' | 'dueAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface GetTodosOptions {
  statusFilter?: TodoStatusFilter;
  includeDone?: boolean;
  search?: string;
  sortBy?: TodoSortField;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface GetTodosResult {
  todos: TodoAPI.Todo[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get priority label and color
 */
export function getPriorityInfo(priority?: number | null): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (priority) {
    case 1:
      return { label: 'High', color: 'text-red-700', bgColor: 'bg-red-100' };
    case 2:
      return { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    case 3:
      return { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' };
    default:
      return { label: '-', color: 'text-muted-foreground', bgColor: '' };
  }
}

/**
 * Get status badge style
 */
export function getTodoStatusStyle(status?: string | null): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'TODO':
      return {
        label: 'Todo',
        className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      };
    case 'BLOCKED':
      return {
        label: 'Blocked',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      };
    case 'DEFERRED':
      return {
        label: 'Deferred',
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      };
    case 'DONE':
      return {
        label: 'Done',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      };
    default:
      return {
        label: '-',
        className: 'bg-muted text-muted-foreground',
      };
  }
}

/**
 * Format due date relative to now
 */
export function formatTodoDueDate(dueAt?: string | null): {
  text: string;
  isOverdue: boolean;
} {
  if (!dueAt) return { text: '-', isOverdue: false };

  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return { text: '1d overdue', isOverdue: true };
    if (absDays < 7) return { text: `${absDays}d overdue`, isOverdue: true };
    if (absDays < 30) return { text: `${Math.floor(absDays / 7)}w overdue`, isOverdue: true };
    return { text: `${Math.floor(absDays / 30)}mo overdue`, isOverdue: true };
  }

  if (diffDays === 0) return { text: 'Today', isOverdue: false };
  if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false };
  if (diffDays < 7) return { text: `${diffDays}d`, isOverdue: false };
  if (diffDays < 30) return { text: `${Math.floor(diffDays / 7)}w`, isOverdue: false };

  // Format as date
  return {
    text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isOverdue: false,
  };
}
