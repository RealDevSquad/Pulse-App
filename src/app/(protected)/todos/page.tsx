import { getTodos, getTodoStats, type TodoStatusFilter, type TodoSortField, type SortOrder } from '@/lib/todos';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TodosTable } from '@/components/todos-table';
import { TodosFilterBar } from '@/components/todos-filter-bar';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    search?: string;
    includeDone?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

export default async function TodosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const tab = (['all', 'watchlist', 'deferred'].includes(params.tab || '') 
    ? params.tab 
    : 'all') as TodoStatusFilter;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const search = params.search || '';
  const includeDone = params.includeDone === 'true';
  const sortBy = (params.sortBy || 'createdAt') as TodoSortField;
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as SortOrder;

  const [{ todos, total, hasMore }, stats] = await Promise.all([
    getTodos({
      statusFilter: tab,
      includeDone,
      search,
      sortBy,
      sortOrder,
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
    }),
    getTodoStats(),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Build URL helper
  const buildUrl = (overrides: Record<string, string | number | boolean> = {}) => {
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
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Todos</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {total} {tab === 'watchlist' ? 'watchlist' : tab === 'deferred' ? 'deferred' : ''} todos
          {includeDone ? ' (including done)' : ''}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <Link
            href={buildUrl({ tab: 'all', page: 1 })}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
              tab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            All
            <span className="ml-1.5 text-xs text-muted-foreground">({stats.total - stats.done})</span>
          </Link>
          <Link
            href={buildUrl({ tab: 'watchlist', page: 1 })}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
              tab === 'watchlist'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            Watch List
            <span className="ml-1.5 text-xs text-muted-foreground">({stats.watchlist})</span>
          </Link>
          <Link
            href={buildUrl({ tab: 'deferred', page: 1 })}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
              tab === 'deferred'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            Deferred
            <span className="ml-1.5 text-xs text-muted-foreground">({stats.deferred})</span>
          </Link>
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

      {/* Table */}
      <TodosTable 
        todos={todos} 
        sortBy={sortBy}
        sortOrder={sortOrder}
        tab={tab}
        search={search}
        includeDone={includeDone}
      />

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
                href={buildUrl({ page: page - 1 })}
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
                href={buildUrl({ page: page + 1 })}
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
