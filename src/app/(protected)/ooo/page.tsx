import { getCachedOOORequests, getCachedFutureStatuses, type OOOSortField, type SortOrder } from '@/lib/ooo-cache';
import { ChevronLeft, ChevronRight, Database, FileText, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FolderOpenIcon } from '@/components/ui/folder-open';
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

function getInitials(firstName?: string, lastName?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return '??';
}

function formatDateRange(from: number, until: number): string {
  const fromDate = new Date(from);
  const untilDate = new Date(until);
  const sameYear = fromDate.getFullYear() === untilDate.getFullYear();
  const sameMonth = sameYear && fromDate.getMonth() === untilDate.getMonth();
  
  if (sameMonth) {
    return `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${untilDate.getDate()}`;
  }
  if (sameYear) {
    return `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${untilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} - ${untilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'REJECTED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
}

export default async function OOOPage({ searchParams }: PageProps) {
  // Access is already checked in layout
  const params = await searchParams;

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
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Out of Office</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{total} OOO entries found</p>
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
      <div className="md:hidden space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="p-4 rounded-lg bg-card border shadow-sm space-y-3 overflow-hidden">
            {/* Header: Avatar + Name + Status */}
            <div className="flex items-center gap-3">
              <Link href={`/member/${request.userId}`}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={request.user?.picture?.url} alt={request.user?.username} />
                  <AvatarFallback className="text-sm">
                    {getInitials(request.user?.first_name, request.user?.last_name)}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/member/${request.userId}`}
                  className="font-semibold text-foreground hover:text-primary hover:underline transition-colors truncate block"
                >
                  {request.user?.first_name} {request.user?.last_name}
                </Link>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateRange(request.from, request.until)}</span>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${getStatusStyle(request.status)}`}>
                {request.status}
              </span>
            </div>

            {/* Reason */}
            {request.reason && (
              <div className="text-sm text-muted-foreground line-clamp-2 pl-[52px]">
                {request.reason}
              </div>
            )}

            {/* Source indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 pl-[52px]">
              {request.source === 'usersStatus' ? (
                <>
                  <Database className="h-3 w-3 text-blue-500" />
                  <span>usersStatus</span>
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3" />
                  <span>requests</span>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {requests.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
            <span>No OOO requests found</span>
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
            <Button variant="outline" size="sm" asChild disabled={page <= 1} className="h-10">
              <Link
                href={buildUrl(filters, { page: page - 1 })}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={!hasMore} className="h-10">
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
