'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { TodoStatusFilter, TodoSortField, SortOrder } from '@/lib/todos';

const DEBOUNCE_MS = 300;

interface TodosFilterBarProps {
  search: string;
  includeDone: boolean;
  sortBy: TodoSortField;
  sortOrder: SortOrder;
  tab: TodoStatusFilter;
}

function buildUrl(params: {
  tab: TodoStatusFilter;
  search: string;
  includeDone: boolean;
  sortBy: TodoSortField;
  sortOrder: SortOrder;
}) {
  const urlParams = new URLSearchParams();
  urlParams.set('tab', params.tab);
  urlParams.set('page', '1');
  if (params.search) {
    urlParams.set('search', params.search);
  }
  if (params.includeDone) {
    urlParams.set('includeDone', 'true');
  }
  urlParams.set('sortBy', params.sortBy);
  urlParams.set('sortOrder', params.sortOrder);
  return `/todos?${urlParams.toString()}`;
}

export function TodosFilterBar({
  search,
  includeDone,
  sortBy,
  sortOrder,
  tab,
}: TodosFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when prop changes (e.g., when navigating back/forward)
  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  // Debounced search - triggers URL update after user stops typing
  const debouncedSearch = useCallback((value: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      startTransition(() => {
        router.push(buildUrl({ tab, search: value, includeDone, sortBy, sortOrder }));
      });
    }, DEBOUNCE_MS);
  }, [router, tab, includeDone, sortBy, sortOrder]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleIncludeDoneChange = (checked: boolean) => {
    startTransition(() => {
      router.push(buildUrl({ tab, search: searchValue, includeDone: checked, sortBy, sortOrder }));
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
      {/* Search */}
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search tasks"
          value={searchValue}
          onChange={handleSearchChange}
          className="pl-9 w-full sm:w-[280px] h-10"
        />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Include Done Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="include-done"
          checked={includeDone}
          onCheckedChange={handleIncludeDoneChange}
        />
        <Label htmlFor="include-done" className="text-sm text-muted-foreground cursor-pointer">
          Include Done
        </Label>
      </div>
    </div>
  );
}
