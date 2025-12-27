import { getSession } from '@/lib/auth';
import { isUserAllowed } from '@/lib/users';
import { getCachedOOORequests, getCachedFutureStatuses, type OOOSortField, type SortOrder } from '@/lib/ooo-cache';
import { ShieldX, ChevronLeft, ChevronRight, Database, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OOOFilterBar } from '@/components/ooo-filter-bar';
import { OOOTable } from '@/components/ooo-table';
import { FutureStatusSection } from '@/components/future-status-section';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    sortBy?: string;
    sortOrder?: string;
    showPastRejected?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

const sortableColumns: { key: OOOSortField; label: string }[] = [
  { key: 'from', label: 'Start Date' },
  { key: 'until', label: 'End Date' },
  { key: 'createdAt', label: 'Created' },
  { key: 'status', label: 'Status' },
];

interface FilterState {
  sortBy: OOOSortField;
  sortOrder: SortOrder;
  showPastRejected: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState & { page: number }> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('showPastRejected', String(overrides.showPastRejected ?? filters.showPastRejected));
  params.set('page', String(overrides.page ?? 1));
  return `/ooo?${params.toString()}`;
}

export default async function OOOPage({ searchParams }: PageProps) {
  const session = await getSession();
  const params = await searchParams;

  if (!session?.userId || !isUserAllowed(session.userId)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldX className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">403 - Access Denied</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  const page = Math.max(1, parseInt(params.page || '1', 10));
  const sortBy = (sortableColumns.find((c) => c.key === params.sortBy)?.key || 'from') as OOOSortField;
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as SortOrder;
  const showPastRejected = params.showPastRejected === 'true';

  const filters: FilterState = { sortBy, sortOrder, showPastRejected };

  const [oooResult, futureStatuses] = await Promise.all([
    getCachedOOORequests({
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      sortBy,
      sortOrder,
      showPastRejected,
    }),
    getCachedFutureStatuses(),
  ]);

  const { requests, total, hasMore } = oooResult;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Out of Office</h1>
          <p className="text-muted-foreground">{total} OOO entries found</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>requests</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="h-4 w-4 text-blue-500" />
            <span>usersStatus</span>
          </div>
        </div>
      </div>

      {/* Future Status Section */}
      {futureStatuses.length > 0 && (
        <FutureStatusSection entries={futureStatuses} />
      )}

      {/* Filter Bar */}
      <OOOFilterBar filters={filters} />

      {/* Desktop Table */}
      <div className="hidden md:block">
        <OOOTable requests={requests} filters={filters} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="p-4 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {request.user?.first_name} {request.user?.last_name}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  request.status === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : request.status === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {request.status}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {new Date(request.from).toLocaleDateString()} - {new Date(request.until).toLocaleDateString()}
            </div>
            {request.reason && (
              <div className="text-sm text-muted-foreground truncate">{request.reason}</div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={page <= 1}>
              <Link
                href={buildUrl(filters, { page: page - 1 })}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={!hasMore}>
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
