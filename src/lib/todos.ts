import type { TodoAPI } from '@/types';
import { MOCK_TODOS, MOCK_TEAMS } from '@/lib/mock/todos';

// =============================================================================
// TODO Service
// Base URL: https://services.realdevsquad.com/todo
// Note: No caching - always fetch fresh data
// =============================================================================

// Use mock data only in development
const USE_MOCK_DATA = process.env.NODE_ENV === 'development';
const TODO_API_BASE = 'https://services.realdevsquad.com/todo';

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
// Data Fetching
// =============================================================================

/**
 * Fetch todos from the real API
 */
async function fetchTodosFromAPI(options: GetTodosOptions): Promise<GetTodosResult> {
  const {
    statusFilter = 'all',
    includeDone = false,
    limit = 20,
    offset = 0,
  } = options;

  // Calculate page from offset
  const page = Math.floor(offset / limit) + 1;

  // Build the appropriate endpoint based on filter
  let endpoint = '/v1/tasks';
  if (statusFilter === 'watchlist') {
    endpoint = '/v1/watchlist/tasks';
  }

  const url = new URL(`${TODO_API_BASE}${endpoint}`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));

  console.log(`[Todos] Fetching from ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Todos] API error: ${response.status} ${response.statusText}`);
      // Return empty result on error
      return { todos: [], total: 0, hasMore: false };
    }

    const data = await response.json() as TodoAPI.GetTodosResponse;
    let todos = data.tasks || [];

    // Apply client-side filters that API doesn't support
    if (statusFilter === 'deferred') {
      todos = todos.filter((t) => t.status === 'DEFERRED');
    }

    if (!includeDone) {
      todos = todos.filter((t) => t.status !== 'DONE');
    }

    // Calculate total - API doesn't return total count, so estimate from results
    const hasMore = data.links?.next != null;
    const total = hasMore ? (page * limit) + 1 : (page - 1) * limit + todos.length;

    return {
      todos,
      total,
      hasMore,
    };
  } catch (error) {
    console.error('[Todos] Fetch error:', error);
    return { todos: [], total: 0, hasMore: false };
  }
}

/**
 * Get todos from mock data (for development)
 */
function getTodosFromMock(options: GetTodosOptions): GetTodosResult {
  const {
    statusFilter = 'all',
    includeDone = false,
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = options;

  let todos = [...MOCK_TODOS];

  // Filter by tab
  switch (statusFilter) {
    case 'watchlist':
      todos = todos.filter((t) => t.in_watchlist === true);
      break;
    case 'deferred':
      todos = todos.filter((t) => t.status === 'DEFERRED');
      break;
    case 'all':
    default:
      // No additional filtering for 'all'
      break;
  }

  // Filter out done tasks unless includeDone is true
  if (!includeDone) {
    todos = todos.filter((t) => t.status !== 'DONE');
  }

  // Search filter
  if (search.trim()) {
    const searchLower = search.toLowerCase();
    todos = todos.filter(
      (t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.displayId.toLowerCase().includes(searchLower)
    );
  }

  // Sort
  todos.sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;

    switch (sortBy) {
      case 'title':
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'priority':
        // Lower number = higher priority, so reverse for desc
        aVal = a.priority ?? 999;
        bVal = b.priority ?? 999;
        break;
      case 'dueAt':
        aVal = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        bVal = b.dueAt ? new Date(b.dueAt).getTime() : 0;
        break;
      case 'createdAt':
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = todos.length;
  const paginatedTodos = todos.slice(offset, offset + limit);

  return {
    todos: paginatedTodos,
    total,
    hasMore: offset + paginatedTodos.length < total,
  };
}

/**
 * Get todos with filtering, sorting, and pagination.
 * Uses real API in production, mock data in development.
 */
export async function getTodos(options: GetTodosOptions = {}): Promise<GetTodosResult> {
  if (USE_MOCK_DATA) {
    // Simulate network delay in dev
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getTodosFromMock(options);
  }

  return fetchTodosFromAPI(options);
}

/**
 * Get a single todo by ID
 */
export async function getTodoById(id: string): Promise<TodoAPI.Todo | null> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_TODOS.find((t) => t.id === id) || null;
}

/**
 * Get teams for the current user
 */
export async function getTeams(): Promise<TodoAPI.Team[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return MOCK_TEAMS;
}

/**
 * Get todo statistics
 */
export async function getTodoStats(): Promise<{
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  deferred: number;
  done: number;
  watchlist: number;
}> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  const todos = MOCK_TODOS;
  return {
    total: todos.length,
    todo: todos.filter((t) => t.status === 'TODO').length,
    inProgress: todos.filter((t) => t.status === 'IN_PROGRESS').length,
    blocked: todos.filter((t) => t.status === 'BLOCKED').length,
    deferred: todos.filter((t) => t.status === 'DEFERRED').length,
    done: todos.filter((t) => t.status === 'DONE').length,
    watchlist: todos.filter((t) => t.in_watchlist).length,
  };
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
