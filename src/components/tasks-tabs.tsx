'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

type TaskTab = 'current' | 'overdue';

interface TasksTabsProps {
  activeTab: TaskTab;
  onLoadingChange?: (loading: boolean) => void;
}

export function TasksTabs({ activeTab, onLoadingChange }: TasksTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (tab: TaskTab) => {
    if (tab === activeTab) return;

    // Notify parent about loading state
    onLoadingChange?.(true);

    startTransition(() => {
      // Preserve other params when switching to current, reset for overdue
      const params = new URLSearchParams();
      params.set('tab', tab);
      
      if (tab === 'current') {
        // Preserve existing filters for current tab
        const status = searchParams.get('status');
        const sortBy = searchParams.get('sortBy');
        const sortOrder = searchParams.get('sortOrder');
        if (status) params.set('status', status);
        if (sortBy) params.set('sortBy', sortBy);
        if (sortOrder) params.set('sortOrder', sortOrder);
      }
      
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // When transition completes, turn off loading
  // Note: isPending becomes false when navigation completes
  if (!isPending && onLoadingChange) {
    // We'll handle this through the page re-render instead
  }

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
      <button
        onClick={() => handleTabChange('current')}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
          activeTab === 'current'
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50'
        )}
      >
        Current
      </button>
      <button
        onClick={() => handleTabChange('overdue')}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-all min-h-[36px]',
          activeTab === 'overdue'
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50'
        )}
      >
        Overdue
      </button>
    </div>
  );
}
