'use client';

import { useState } from 'react';
import { TasksFilterBar } from '@/components/tasks-filter-bar';
import { TasksTable, TasksTableSkeleton } from '@/components/tasks-table';
import { TasksMobileCards, TasksMobileCardsSkeleton } from '@/components/tasks-mobile-cards';
import type { TaskWithAssignee, TaskSortField, SortOrder, TaskStatusFilter } from '@/lib/tasks-cache';

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

interface TasksContentProps {
  tasks: TaskWithAssignee[];
  filters: FilterState;
  isRoot: boolean;
  /** Slot for tabs to be rendered inline with filter bar */
  tabsSlot?: React.ReactNode;
}

export function TasksContent({ tasks, filters, isRoot, tabsSlot }: TasksContentProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tabs and Filter Bar in same row */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {tabsSlot}
        <TasksFilterBar filters={filters} onLoadingChange={setIsLoading} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        {isLoading ? (
          <TasksTableSkeleton />
        ) : (
          <TasksTable tasks={tasks} filters={filters} isRoot={isRoot} />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {isLoading ? (
          <TasksMobileCardsSkeleton />
        ) : (
          <TasksMobileCards tasks={tasks} isRoot={isRoot} />
        )}
      </div>
    </div>
  );
}
