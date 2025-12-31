'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TodosTable, TodosTableSkeleton } from '@/components/todos-table';
import { TodosFilterBar } from '@/components/todos-filter-bar';
import { cn } from '@/lib/utils';
import { 
  type TodoStatusFilter, 
  type TodoSortField, 
  type SortOrder,
  type GetTodosResult,
  getTodoStatusStyle,
  getPriorityInfo,
  formatTodoDueDate,
} from '@/lib/todos';
import type { TodoAPI } from '@/types';

const ITEMS_PER_PAGE = 20;

// In development, use local API route (returns mock data) because localhost
// cannot send cookies to production API due to SameSite cookie policies.
// In production, call the real API directly so browser sends auth cookies.
const IS_DEV = process.env.NODE_ENV === 'development';
const TODO_API_BASE = IS_DEV ? '' : 'https://services.realdevsquad.com/todo';

interface TodoStats {
  total: number;
  todo: number;
  inProgress: number;
  blocked: number;
  deferred: number;
  done: number;
  watchlist: number;
}

export default function TodosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Parse URL params
  const tab = (['all', 'watchlist', 'deferred'].includes(searchParams.get('tab') || '') 
    ? searchParams.get('tab') 
    : 'all') as TodoStatusFilter;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const search = searchParams.get('search') || '';
  const includeDone = searchParams.get('includeDone') === 'true';
  const sortBy = (searchParams.get('sortBy') || 'createdAt') as TodoSortField;
  const sortOrder = (searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc') as SortOrder;

  // State
  const [todos, setTodos] = useState<TodoAPI.Todo[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<TodoStats>({ 
    total: 0, todo: 0, inProgress: 0, blocked: 0, deferred: 0, done: 0, watchlist: 0 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build URL helper
  const buildUrl = useCallback((overrides: Record<string, string | number | boolean> = {}) => {
    const newParams = new URLSearchParams();
    newParams.set('tab', String(overrides.tab ?? tab));
    newParams.set('page', String(overrides.page ?? page));
    if (overrides.search !== undefined ? overrides.search : search) {
      newParams.set('search', String(overrides.search ?? search));
    }
    if (overrides.includeDone !== undefined ? overrides.includeDone : includeDone) {
      newParams.set('includeDone', 'true');
    }
    newParams.set('sortBy', String(overrides.sortBy ?? sortBy));
    newParams.set('sortOrder', String(overrides.sortOrder ?? sortOrder));
    return `/todos?${newParams.toString()}`;
  }, [tab, page, search, includeDone, sortBy, sortOrder]);

  // Fetch todos from API (client-side)
  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url: string;
      
      if (IS_DEV) {
        // In development, use local API route which handles all filtering/sorting
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(ITEMS_PER_PAGE));
        params.set('tab', tab);
        params.set('includeDone', String(includeDone));
        if (search) params.set('search', search);
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
        url = `/api/todos?${params.toString()}`;
      } else {
        // In production, call the real API
        let endpoint = '/v1/tasks';
        if (tab === 'watchlist') {
          endpoint = '/v1/watchlist/tasks';
        }
        const prodUrl = new URL(`${TODO_API_BASE}${endpoint}`);
        prodUrl.searchParams.set('page', String(page));
        prodUrl.searchParams.set('limit', String(ITEMS_PER_PAGE));
        url = prodUrl.toString();
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as TodoAPI.GetTodosResponse;
      let fetchedTodos = data.tasks || [];

      // In production, apply client-side filters that the API doesn't support
      // (In dev, the local API already handles all filtering)
      if (!IS_DEV) {
        if (tab === 'deferred') {
          fetchedTodos = fetchedTodos.filter((t) => t.status === 'DEFERRED');
        }

        if (!includeDone) {
          fetchedTodos = fetchedTodos.filter((t) => t.status !== 'DONE');
        }

        // Apply client-side search
        if (search.trim()) {
          const searchLower = search.toLowerCase();
          fetchedTodos = fetchedTodos.filter(
            (t) =>
              t.title.toLowerCase().includes(searchLower) ||
              t.description?.toLowerCase().includes(searchLower) ||
              t.displayId.toLowerCase().includes(searchLower)
          );
        }

        // Apply client-side sorting
        fetchedTodos.sort((a, b) => {
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
      }

      // Calculate stats from all todos (this is an approximation since we only have current page)
      const apiHasMore = data.links?.next != null;
      const totalEstimate = apiHasMore ? (page * ITEMS_PER_PAGE) + 1 : (page - 1) * ITEMS_PER_PAGE + fetchedTodos.length;

      setTodos(fetchedTodos);
      setTotal(totalEstimate);
      setHasMore(apiHasMore);

      // Update stats based on current response
      // Note: These are estimates based on current page data
      const todoCount = fetchedTodos.filter((t) => t.status === 'TODO').length;
      const inProgressCount = fetchedTodos.filter((t) => t.status === 'IN_PROGRESS').length;
      const blockedCount = fetchedTodos.filter((t) => t.status === 'BLOCKED').length;
      const deferredCount = fetchedTodos.filter((t) => t.status === 'DEFERRED').length;
      const doneCount = fetchedTodos.filter((t) => t.status === 'DONE').length;
      const watchlistCount = fetchedTodos.filter((t) => t.in_watchlist).length;

      setStats({
        total: totalEstimate,
        todo: todoCount,
        inProgress: inProgressCount,
        blocked: blockedCount,
        deferred: deferredCount,
        done: doneCount,
        watchlist: watchlistCount,
      });

    } catch (err) {
      console.error('[Todos] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch todos');
      setTodos([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, tab, includeDone, search, sortBy, sortOrder]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Todos</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <>
              {total} {tab === 'watchlist' ? 'watchlist' : tab === 'deferred' ? 'deferred' : ''} todos
              {includeDone ? ' (including done)' : ''}
            </>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            onClick={() => startTransition(() => router.push(buildUrl({ tab: 'all', page: 1 })))}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
              tab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            All
            {!isLoading && <span className="ml-1.5 text-xs text-muted-foreground">({stats.total - stats.done})</span>}
          </button>
          <button
            onClick={() => startTransition(() => router.push(buildUrl({ tab: 'watchlist', page: 1 })))}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
              tab === 'watchlist'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            Watch List
            {!isLoading && <span className="ml-1.5 text-xs text-muted-foreground">({stats.watchlist})</span>}
          </button>
          <button
            onClick={() => startTransition(() => router.push(buildUrl({ tab: 'deferred', page: 1 })))}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
              tab === 'deferred'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            Deferred
            {!isLoading && <span className="ml-1.5 text-xs text-muted-foreground">({stats.deferred})</span>}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <TodosFilterBar
        search={search}
        includeDone={includeDone}
        sortBy={sortBy}
        sortOrder={sortOrder}
        tab={tab}
      />

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">
            Failed to load todos: {error}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchTodos}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TodosTableSkeleton />
      ) : !error && (
        <TodosTable 
          todos={todos} 
          sortBy={sortBy}
          sortOrder={sortOrder}
          tab={tab}
          search={search}
          includeDone={includeDone}
        />
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="text-sm text-muted-foreground shrink-0">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              className="h-10"
              onClick={() => startTransition(() => router.push(buildUrl({ page: page - 1 })))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore || isPending}
              className="h-10"
              onClick={() => startTransition(() => router.push(buildUrl({ page: page + 1 })))}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
