'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExtensionRequestStatus } from '@/types';

interface FilterState {
  status: ExtensionRequestStatus | 'all';
  sortOrder: 'asc' | 'desc';
}

interface ExtensionRequestsFilterBarProps {
  filters: FilterState;
  counts?: Record<ExtensionRequestStatus | 'all', number>;
}

export function ExtensionRequestsFilterBar({ filters, counts }: ExtensionRequestsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: keyof FilterState, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      // Reset cursor on filter change
      params.delete('cursor');
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const getCountLabel = (status: ExtensionRequestStatus | 'all') => {
    if (!counts) return '';
    const count = counts[status];
    return count !== undefined ? ` (${count})` : '';
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <Select
        value={filters.status}
        onValueChange={(value) => updateFilter('status', value)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[160px] h-10">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All{getCountLabel('all')}</SelectItem>
          <SelectItem value="PENDING">Pending{getCountLabel('PENDING')}</SelectItem>
          <SelectItem value="APPROVED">Approved{getCountLabel('APPROVED')}</SelectItem>
          <SelectItem value="DENIED">Denied{getCountLabel('DENIED')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort Order */}
      <Select
        value={filters.sortOrder}
        onValueChange={(value) => updateFilter('sortOrder', value)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[160px] h-10">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Newest first</SelectItem>
          <SelectItem value="asc">Oldest first</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
