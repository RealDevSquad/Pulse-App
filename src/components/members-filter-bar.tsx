'use client';

import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface FilterState {
  sortBy: string;
  sortOrder: string;
  inDiscord: boolean;
  archived: boolean;
  hideSuperusers: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('inDiscord', String(overrides.inDiscord ?? filters.inDiscord));
  params.set('archived', String(overrides.archived ?? filters.archived));
  params.set('hideSuperusers', String(overrides.hideSuperusers ?? filters.hideSuperusers));
  params.set('page', '1');
  return `/members?${params.toString()}`;
}

export function MembersFilterBar({ filters }: { filters: FilterState }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <Switch
          id="in-discord"
          checked={filters.inDiscord}
          onCheckedChange={(checked) => {
            router.push(buildUrl(filters, { inDiscord: checked }));
          }}
        />
        <Label htmlFor="in-discord" className="text-sm font-medium cursor-pointer">
          In Discord
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="archived"
          checked={filters.archived}
          onCheckedChange={(checked) => {
            router.push(buildUrl(filters, { archived: checked }));
          }}
        />
        <Label htmlFor="archived" className="text-sm font-medium cursor-pointer">
          Archived
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="hide-superusers"
          checked={filters.hideSuperusers}
          onCheckedChange={(checked) => {
            router.push(buildUrl(filters, { hideSuperusers: checked === true }));
          }}
        />
        <Label htmlFor="hide-superusers" className="text-sm font-medium cursor-pointer">
          Hide Superusers
        </Label>
      </div>
    </div>
  );
}
