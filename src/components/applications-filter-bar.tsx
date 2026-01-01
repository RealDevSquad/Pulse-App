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
import type { ApplicationStatus } from '@/types';

interface FilterState {
  status: ApplicationStatus | 'all';
}

interface ApplicationsFilterBarProps {
  filters: FilterState;
  counts?: Record<ApplicationStatus | 'all', number>;
  onLoadingChange?: (loading: boolean) => void;
}

export function ApplicationsFilterBar({ filters, counts, onLoadingChange }: ApplicationsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: keyof FilterState, value: string) => {
    onLoadingChange?.(true);
    
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      params.set('page', '1'); // Reset to first page on filter change
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const getCountLabel = (status: ApplicationStatus | 'all') => {
    if (!counts) return '';
    return ` (${counts[status]})`;
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
          <SelectItem value="pending">Pending{getCountLabel('pending')}</SelectItem>
          <SelectItem value="accepted">Accepted{getCountLabel('accepted')}</SelectItem>
          <SelectItem value="rejected">Rejected{getCountLabel('rejected')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
