'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { TaskSortField, SortOrder, TaskStatusFilter } from '@/lib/tasks-cache';

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

interface TasksFilterBarProps {
  filters: FilterState;
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

export function TasksFilterBar({ filters }: TasksFilterBarProps) {
  const router = useRouter();

  const handleStatusChange = (value: TaskStatusFilter) => {
    router.push(buildUrl(filters, { statusFilter: value }));
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="status-filter" className="text-sm whitespace-nowrap">
        Status:
      </Label>
      <Select value={filters.statusFilter} onValueChange={handleStatusChange}>
        <SelectTrigger id="status-filter" className="w-[140px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
