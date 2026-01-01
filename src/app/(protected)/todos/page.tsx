'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TodosTable, TodosTableSkeleton, type TeamsMap } from '@/components/todos-table';
import { TodosMobileCards, TodosMobileCardsSkeleton } from '@/components/todos-mobile-cards';
import { TodosFilterBar } from '@/components/todos-filter-bar';
import { useIsMobile } from '@/hooks/use-mobile';
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

/** Editable fields for a todo */
interface EditableFields {
  title: string;
  description: string;
  status: TodoAPI.Status | null;
  priority: TodoAPI.PriorityNumber | null;
  dueAt: string | null;
}

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
  const isMobile = useIsMobile();

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
  const [teamsMap, setTeamsMap] = useState<TeamsMap>({});

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
        // Watchlist uses separate endpoint
        // Deferred: fetch more items and filter client-side by deferredDetails
        // (API status=DEFERRED doesn't work because deferred tasks have status: "TODO")
        let endpoint = '/v1/tasks';
        if (tab === 'watchlist') {
          endpoint = '/v1/watchlist/tasks';
        }
        const prodUrl = new URL(`${TODO_API_BASE}${endpoint}`);
        prodUrl.searchParams.set('page', String(page));
        // For deferred tab, fetch more items since we filter client-side
        prodUrl.searchParams.set('limit', String(tab === 'deferred' ? 100 : ITEMS_PER_PAGE));
        
        url = prodUrl.toString();
      }

      const fetchOptions: RequestInit = {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let fetchedTodos: TodoAPI.Todo[] = [];

      // Track raw API count before client-side filtering (for pagination)
      let rawApiCount = 0;
      
      // Handle watchlist response format (WatchlistTask[]) vs regular response (Todo[])
      if (tab === 'watchlist') {
        const watchlistData = data as TodoAPI.GetWatchlistResponse;
        const rawTasks = watchlistData.tasks || [];
        rawApiCount = rawTasks.length;
        // Convert WatchlistTask to Todo format for consistent rendering
        fetchedTodos = rawTasks.map((wt: TodoAPI.WatchlistTask) => {
          // Convert priority from string to number if needed
          let priorityNum: TodoAPI.PriorityNumber | null = null;
          if (wt.priority === 'HIGH' || wt.priority === 1) priorityNum = 1;
          else if (wt.priority === 'MEDIUM' || wt.priority === 2) priorityNum = 2;
          else if (wt.priority === 'LOW' || wt.priority === 3) priorityNum = 3;

          // Convert assignee format
          const assignee: TodoAPI.Assignee | null = wt.assignee ? {
            id: wt.assignee.assignee_id,
            name: wt.assignee.assignee_name,
            relation_type: wt.assignee.user_type,
            is_action_taken: false,
            is_active: true,
          } : null;

          return {
            id: wt.taskId,
            displayId: wt.displayId,
            title: wt.title,
            description: wt.description,
            priority: priorityNum,
            status: wt.status as TodoAPI.Status | null,
            isAcknowledged: wt.isAcknowledged,
            labels: wt.labels,
            dueAt: wt.dueAt,
            deferredDetails: wt.deferredDetails,
            createdAt: wt.createdAt,
            createdBy: wt.createdBy,
            assignee,
            in_watchlist: true,
          };
        });
      } else {
        const todosData = data as TodoAPI.GetTodosResponse;
        fetchedTodos = todosData.tasks || [];
        rawApiCount = fetchedTodos.length;
        
        // In production, if includeDone is true, also fetch DONE tasks and merge
        // API excludes DONE by default, need status=DONE to get them
        if (!IS_DEV && includeDone) {
          const doneUrl = new URL(url);
          doneUrl.searchParams.set('status', 'DONE');
          
          const doneResponse = await fetch(doneUrl.toString(), fetchOptions);
          if (doneResponse.ok) {
            const doneData = await doneResponse.json() as TodoAPI.GetTodosResponse;
            const doneTasks = doneData.tasks || [];
            fetchedTodos = [...fetchedTodos, ...doneTasks];
            rawApiCount += doneTasks.length;
          }
        }
      }

      // In production, apply client-side filters that the API doesn't support
      // (In dev, the local API already handles all filtering)
      if (!IS_DEV) {
        // Filter deferred tab by deferredDetails (API doesn't support this filter)
        if (tab === 'deferred') {
          fetchedTodos = fetchedTodos.filter((t) => t.deferredDetails != null);
        }

        // Watchlist and Deferred tabs: API returns all tasks including DONE - filter client-side
        // (For 'all' tab, we fetch DONE separately with status=DONE param when includeDone=true)
        if ((tab === 'watchlist' || tab === 'deferred') && !includeDone) {
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
      const apiHasMore = (data as { links?: { next?: string | null } }).links?.next != null;
      const apiStats = (data as { stats?: TodoStats }).stats;
      
      // Determine if there are more pages:
      // - Trust API's links.next if available
      // - BUT also check if the RAW API response was full (before client-side filtering)
      // - Use rawApiCount (not fetchedTodos.length) since client-side filters may reduce count
      const requestedLimit = tab === 'deferred' ? 100 : ITEMS_PER_PAGE;
      const hasMoreItems = apiHasMore && rawApiCount === requestedLimit;
      
      // Use stats.total from API if available (dev mode), otherwise estimate from filtered results
      const totalEstimate = apiStats?.total ?? (hasMoreItems ? (page * ITEMS_PER_PAGE) + 1 : (page - 1) * ITEMS_PER_PAGE + fetchedTodos.length);

      setTodos(fetchedTodos);
      setTotal(totalEstimate);
      setHasMore(hasMoreItems);

      // Use stats from API if available (dev mode), otherwise estimate from current page
      if (apiStats) {
        setStats(apiStats);
      } else {
        // Fallback: estimate from current page data (production)
        // When on watchlist/deferred tabs, only update the count for that tab
        // to avoid resetting other stats to 0
        if (tab === 'watchlist') {
          setStats(prev => ({
            ...prev,
            watchlist: fetchedTodos.length,
          }));
        } else if (tab === 'deferred') {
          setStats(prev => ({
            ...prev,
            deferred: fetchedTodos.length,
          }));
        } else {
          // On "all" tab, calculate stats but preserve watchlist/deferred from fetchTabCounts
          const todoCount = fetchedTodos.filter((t) => t.status === 'TODO').length;
          const inProgressCount = fetchedTodos.filter((t) => t.status === 'IN_PROGRESS').length;
          const blockedCount = fetchedTodos.filter((t) => t.status === 'BLOCKED').length;
          const doneCount = fetchedTodos.filter((t) => t.status === 'DONE').length;

          setStats(prev => ({
            ...prev,
            total: totalEstimate,
            todo: todoCount,
            inProgress: inProgressCount,
            blocked: blockedCount,
            done: doneCount,
            // Keep watchlist and deferred from fetchTabCounts (they're fetched separately)
          }));
        }
      }

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

  // Fetch teams for team name lookup
  const fetchTeams = useCallback(async () => {
    try {
      const url = IS_DEV ? '/api/todos/teams' : `${TODO_API_BASE}/v1/teams`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        const map: TeamsMap = {};
        for (const team of data.teams || []) {
          map[team.id] = team.name;
        }
        setTeamsMap(map);
      }
    } catch (err) {
      console.error('[Todos] Failed to fetch teams:', err);
    }
  }, []);

  // Initialize all tab counts on mount and when includeDone changes
  // This fetches counts for All, Watchlist, and Deferred tabs in parallel
  const initializeCounts = useCallback(async () => {
    if (IS_DEV) {
      // In dev, stats come from the API response
      return;
    }

    try {
      const fetchOptions = {
        credentials: 'include' as RequestCredentials,
        headers: { 'Content-Type': 'application/json' },
      };

      // Fetch all tasks and watchlist in parallel
      const [allTasksRes, watchlistRes] = await Promise.all([
        fetch(`${TODO_API_BASE}/v1/tasks?page=1&limit=100`, fetchOptions),
        fetch(`${TODO_API_BASE}/v1/watchlist/tasks?page=1&limit=100`, fetchOptions),
      ]);

      let allCount = 0;
      let deferredCount = 0;
      let watchlistCount = 0;

      // Process all tasks response
      if (allTasksRes.ok) {
        const allTasksData = await allTasksRes.json();
        const allTasks: Array<{ status?: string; deferredDetails?: unknown }> = allTasksData.tasks || [];
        
        // Filter by done status
        const filteredTasks = includeDone 
          ? allTasks 
          : allTasks.filter(t => t.status !== 'DONE');
        
        allCount = filteredTasks.length;
        
        // Count deferred (tasks with deferredDetails set)
        const deferredTasks = filteredTasks.filter(t => t.deferredDetails != null);
        deferredCount = deferredTasks.length;
      }

      // Process watchlist response
      if (watchlistRes.ok) {
        const watchlistData = await watchlistRes.json();
        const watchlistTasks: Array<{ status?: string }> = watchlistData.tasks || [];
        
        watchlistCount = includeDone
          ? watchlistTasks.length
          : watchlistTasks.filter(t => t.status !== 'DONE').length;
      }

      // Update all stats at once
      setStats(prev => ({
        ...prev,
        total: allCount,
        deferred: deferredCount,
        watchlist: watchlistCount,
      }));
    } catch (err) {
      console.error('[Todos] Failed to initialize counts:', err);
    }
  }, [includeDone]);

  // Fetch current tab data on mount and when params change
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Initialize all tab counts
  useEffect(() => {
    initializeCounts();
  }, [initializeCounts]);

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Save handler for updating a todo
  const handleSave = useCallback(async (todoId: string, updates: Partial<EditableFields>) => {
    // Build API URL
    const url = IS_DEV 
      ? `/api/todos/${todoId}`
      : `${TODO_API_BASE}/v1/tasks/${todoId}`;

    // Convert priority from number to string for production API
    const apiUpdates = { ...updates };
    if (!IS_DEV && apiUpdates.priority !== undefined) {
      const priorityMap: Record<number, string> = { 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW' };
      (apiUpdates as Record<string, unknown>).priority = apiUpdates.priority 
        ? priorityMap[apiUpdates.priority] 
        : null;
    }

    const response = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiUpdates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update todo: ${response.status}`);
    }

    // Refetch todos to get updated data
    await fetchTodos();
  }, [fetchTodos]);

  // Defer handler
  const handleDefer = useCallback(async (todoId: string, deferredTill: string) => {
    const url = IS_DEV 
      ? `/api/todos/${todoId}?action=defer`
      : `${TODO_API_BASE}/v1/tasks/${todoId}?action=defer`;

    const response = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deferredTill }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to defer todo: ${response.status}`);
    }

    // Refetch todos to get updated data
    await fetchTodos();
  }, [fetchTodos]);

  // Undefer handler - changes status back to TODO
  const handleUndefer = useCallback(async (todoId: string) => {
    const url = IS_DEV 
      ? `/api/todos/${todoId}?action=update`
      : `${TODO_API_BASE}/v1/tasks/${todoId}/update`;

    const response = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'TODO' }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to undefer todo: ${response.status}`);
    }

    // Refetch todos to get updated data
    await fetchTodos();
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
            {!isLoading && <span className="ml-1.5 text-xs text-muted-foreground">({stats.total})</span>}
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

      {/* Table (desktop) / Cards (mobile) */}
      {isLoading ? (
        isMobile ? <TodosMobileCardsSkeleton /> : <TodosTableSkeleton />
      ) : !error && (
        isMobile ? (
          <TodosMobileCards
            todos={todos}
            teamsMap={teamsMap}
            onSave={handleSave}
            onDefer={handleDefer}
            onUndefer={handleUndefer}
          />
        ) : (
          <TodosTable 
            todos={todos} 
            teamsMap={teamsMap}
            sortBy={sortBy}
            sortOrder={sortOrder}
            tab={tab}
            search={search}
            includeDone={includeDone}
            onSave={handleSave}
            onDefer={handleDefer}
            onUndefer={handleUndefer}
          />
        )
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
