'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { ApplicationDetailModal } from '@/components/application-detail-modal';
import { cn } from '@/lib/utils';
import type { Application, ApplicationStatus } from '@/types';

// =============================================================================
// Helper functions
// =============================================================================

function getStatusStyle(status: ApplicationStatus) {
  switch (status) {
    case 'accepted':
      return 'border-green-500 text-green-600 bg-transparent dark:text-green-400';
    case 'rejected':
      return 'border-red-500 text-red-600 bg-transparent dark:text-red-400';
    case 'pending':
    default:
      return 'border-yellow-500 text-yellow-600 bg-transparent dark:text-yellow-400';
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'In future';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return dateString;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// =============================================================================
// Component
// =============================================================================

interface ApplicationsTableProps {
  applications: Application[];
}

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRowClick = (application: Application) => {
    setSelectedApplication(application);
    setIsModalOpen(true);
  };

  const columns: ColumnDef<Application>[] = [
    {
      id: 'name',
      header: 'Name',
      size: 180,
      cell: ({ row }) => {
        const firstName = row.original.biodata.firstName;
        const lastName = row.original.biodata.lastName;
        return (
          <span className="font-medium capitalize">
            {firstName} {lastName}
          </span>
        );
      },
    },
    {
      id: 'location',
      header: 'Location',
      size: 180,
      cell: ({ row }) => {
        const { city, country } = row.original.location;
        return (
          <span className="text-muted-foreground">
            {city}, {country}
          </span>
        );
      },
    },
    {
      id: 'institution',
      header: 'Institution',
      size: 200,
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {row.original.professional.institution}
        </span>
      ),
    },
    {
      id: 'hours',
      header: 'Hours/wk',
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.intro.numberOfHours}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      size: 100,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            getStatusStyle(status)
          )}>
            {capitalize(status)}
          </span>
        );
      },
    },
    {
      id: 'applied',
      header: 'Applied',
      size: 100,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatRelativeTime(row.original.createdAt)}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: applications,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No applications found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ApplicationDetailModal
        application={selectedApplication}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function ApplicationsTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: 180 }}>Name</TableHead>
            <TableHead style={{ width: 180 }}>Location</TableHead>
            <TableHead style={{ width: 200 }}>Institution</TableHead>
            <TableHead style={{ width: 80 }}>Hours/wk</TableHead>
            <TableHead style={{ width: 100 }}>Status</TableHead>
            <TableHead style={{ width: 100 }}>Applied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><SkeletonPulse className="h-4 w-32" /></TableCell>
              <TableCell><SkeletonPulse className="h-4 w-28" /></TableCell>
              <TableCell><SkeletonPulse className="h-4 w-40" /></TableCell>
              <TableCell><SkeletonPulse className="h-4 w-8" /></TableCell>
              <TableCell><SkeletonPulse className="h-6 w-16 rounded-full" /></TableCell>
              <TableCell><SkeletonPulse className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
