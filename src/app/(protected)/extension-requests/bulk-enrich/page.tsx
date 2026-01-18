import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { fetchExtensionRequests } from '@/lib/extension-requests-cache';
import { Button } from '@/components/ui/button';
import { ExtensionEnrichmentBulk } from '@/components/extension-enrichment-bulk';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    assignee?: string;
  }>;
}

export default async function BulkEnrichPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getSession(), searchParams]);

  // Access check: only admins can bulk enrich
  if (!session?.userId || !(await isAdminUser(session.userId))) {
    redirect('/');
  }

  // Fetch extension requests (default to all statuses, larger page size for bulk)
  const status = (['all', 'PENDING', 'APPROVED', 'DENIED'].includes(params.status || '')
    ? params.status
    : 'all') as 'all' | 'PENDING' | 'APPROVED' | 'DENIED';

  const { extensionRequests } = await fetchExtensionRequests({
    status,
    assignee: params.assignee,
    size: 100, // Larger page for bulk operations
    sortOrder: 'desc',
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/extension-requests">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Bulk Enrichment
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Enrich multiple extension requests at once
          </p>
        </div>
      </div>

      {/* Bulk Enrichment Component */}
      <ExtensionEnrichmentBulk extensionRequests={extensionRequests} />
    </div>
  );
}
