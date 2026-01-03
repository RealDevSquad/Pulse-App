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
import type { TaskRequestStatus, TaskRequestType } from '@/types';

interface FilterState {
  status: TaskRequestStatus | 'all';
  requestType: TaskRequestType | 'all';
  sortBy: 'created' | 'requestors';
  sortOrder: 'asc' | 'desc';
}

interface TaskRequestsFilterBarProps {
  filters: FilterState;
  counts?: Record<TaskRequestStatus | 'all', number>;
}

export function TaskRequestsFilterBar({ filters, counts }: TaskRequestsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: keyof FilterState, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      params.set('page', '1'); // Reset to first page on filter change
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const getCountLabel = (status: TaskRequestStatus | 'all') => {
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

      {/* Request Type Filter */}
      <Select
        value={filters.requestType}
        onValueChange={(value) => updateFilter('requestType', value)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[160px] h-10">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
          <SelectItem value="CREATION">Creation</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select
        value={`${filters.sortBy}-${filters.sortOrder}`}
        onValueChange={(value) => {
          const [sortBy, sortOrder] = value.split('-') as ['created' | 'requestors', 'asc' | 'desc'];
          const params = new URLSearchParams(searchParams.toString());
          params.set('sortBy', sortBy);
          params.set('sortOrder', sortOrder);
          params.set('page', '1');
          startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
          });
        }}
        disabled={isPending}
      >
        <SelectTrigger className="w-[180px] h-10">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created-desc">Newest first</SelectItem>
          <SelectItem value="created-asc">Oldest first</SelectItem>
          <SelectItem value="requestors-desc">Most requestors</SelectItem>
          <SelectItem value="requestors-asc">Fewest requestors</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
