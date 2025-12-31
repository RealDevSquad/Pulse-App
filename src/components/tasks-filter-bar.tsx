'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskSortField, SortOrder, TaskStatusFilter } from '@/lib/tasks-cache';

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

interface TasksFilterBarProps {
  filters: FilterState;
  onLoadingChange?: (loading: boolean) => void;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('tab', 'current');
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('status', overrides.statusFilter ?? filters.statusFilter);
  params.set('page', '1');
  return `/tasks?${params.toString()}`;
}

const statusOptions: { value: TaskStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Tasks' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'backlog', label: 'Backlog' },
];

export function TasksFilterBar({ filters, onLoadingChange }: TasksFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticFilter, setOptimisticFilter] = useState(filters.statusFilter);

  const handleStatusChange = (value: TaskStatusFilter) => {
    // Update UI immediately
    setOptimisticFilter(value);
    onLoadingChange?.(true);
    
    // Navigate with transition
    startTransition(() => {
      router.push(buildUrl(filters, { statusFilter: value }));
    });
  };

  // Sync optimistic state when filters change (navigation complete)
  if (!isPending && optimisticFilter !== filters.statusFilter) {
    setOptimisticFilter(filters.statusFilter);
    onLoadingChange?.(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={optimisticFilter} onValueChange={handleStatusChange}>
        <SelectTrigger 
          className="w-[140px] h-10 bg-background hover:bg-accent/50 transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-1"
          aria-label="Filter by status"
        >
          <SelectValue placeholder="Filter status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="min-h-[44px] flex items-center cursor-pointer"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
