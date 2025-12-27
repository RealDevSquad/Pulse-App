'use client';

import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface FilterState {
  sortBy: string;
  sortOrder: string;
  showPastRejected: boolean;
}

interface OOOFilterBarProps {
  filters: FilterState;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('showPastRejected', String(overrides.showPastRejected ?? filters.showPastRejected));
  params.set('page', '1');
  return `/ooo?${params.toString()}`;
}

export function OOOFilterBar({ filters }: OOOFilterBarProps) {
  const router = useRouter();

  const handleCheckboxChange = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      router.push(buildUrl(filters, { showPastRejected: checked }));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-past-rejected"
          checked={filters.showPastRejected}
          onCheckedChange={handleCheckboxChange}
        />
        <Label htmlFor="show-past-rejected" className="text-sm cursor-pointer">
          Show past & rejected
        </Label>
      </div>
    </div>
  );
}
