import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { getCachedApplications, getApplicationCounts } from '@/lib/applications-cache';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApplicationsTable, ApplicationsTableSkeleton } from '@/components/applications-table';
import { ApplicationsMobileCards, ApplicationsMobileCardsSkeleton } from '@/components/applications-mobile-cards';
import { ApplicationsFilterBar } from '@/components/applications-filter-bar';
import Link from 'next/link';
import type { ApplicationStatus } from '@/types';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

interface FilterState {
  status: ApplicationStatus | 'all';
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState & { page: number }> = {}) {
  const params = new URLSearchParams();
  params.set('status', overrides.status ?? filters.status);
  params.set('page', String(overrides.page ?? 1));
  return `/applications?${params.toString()}`;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  // Access check: only root users can view applications
  const session = await getSession();
  if (!session?.userId || !(await isRootUser(session.userId))) {
    redirect('/');
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const status = (['all', 'pending', 'accepted', 'rejected'].includes(params.status || '')
    ? params.status
    : 'pending') as ApplicationStatus | 'all';

  const filters: FilterState = { status };

  // Fetch applications and counts in parallel
  const [{ applications, total, hasMore }, counts] = await Promise.all([
    getCachedApplications({
      status,
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    getApplicationCounts(),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Applications</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {total} applications found
        </p>
      </div>

      {/* Filter Bar */}
      <ApplicationsFilterBar filters={filters} counts={counts} />

      {/* Desktop Table */}
      <div className="hidden md:block">
        <ApplicationsTable applications={applications} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        <ApplicationsMobileCards applications={applications} />
      </div>

      {/* Pagination */}
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
