'use client';

import { useState, useCallback } from 'react';
import { TasksFilterBar } from '@/components/tasks-filter-bar';
import { TasksTabs } from '@/components/tasks-tabs';
import { TasksTable, TasksTableSkeleton } from '@/components/tasks-table';
import { TasksMobileCards, TasksMobileCardsSkeleton } from '@/components/tasks-mobile-cards';
import type { TaskWithAssignee, TaskSortField, SortOrder, TaskStatusFilter } from '@/lib/tasks-cache';

type TaskTab = 'current' | 'overdue';

interface FilterState {
  sortBy: TaskSortField;
  sortOrder: SortOrder;
  statusFilter: TaskStatusFilter;
}

interface TasksContentProps {
  tasks: TaskWithAssignee[];
  filters: FilterState;
  isRoot: boolean;
  isAdmin?: boolean;
  activeTab: TaskTab;
  isOverdueTab?: boolean;
  /** Whether to show filter bar (hidden on overdue tab) */
  showFilters?: boolean;
}

export function TasksContent({
  tasks,
  filters,
  isRoot,
  isAdmin = false,
  activeTab,
  isOverdueTab = false,
  showFilters = true,
}: TasksContentProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Combine loading states from tabs and filters
  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tabs and Filter Bar in same row */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <TasksTabs activeTab={activeTab} onLoadingChange={handleLoadingChange} />
        {showFilters && (
          <TasksFilterBar filters={filters} onLoadingChange={handleLoadingChange} />
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        {isLoading ? (
          <TasksTableSkeleton />
        ) : (
          <TasksTable tasks={tasks} filters={filters} isRoot={isRoot} isAdmin={isAdmin} />
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {isLoading ? (
          <TasksMobileCardsSkeleton />
        ) : (
          <TasksMobileCards tasks={tasks} isRoot={isRoot} isAdmin={isAdmin} isOverdueTab={isOverdueTab} />
        )}
      </div>
    </div>
  );
}
