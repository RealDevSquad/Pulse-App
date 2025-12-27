import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { getCachedUsers, type UserSortField, type SortOrder } from '@/lib/users-cache';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserInfoPopover } from '@/components/user-info-popover';
import { MembersFilterBar } from '@/components/members-filter-bar';
import { MembersTable } from '@/components/members-table';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    sortBy?: string;
    sortOrder?: string;
    inDiscord?: string;
    archived?: string;
    hideSuperusers?: string;
  }>;
}

const ITEMS_PER_PAGE = 20;

const sortableColumns: { key: UserSortField; label: string }[] = [
  { key: 'first_name', label: 'Name' },
  { key: 'username', label: 'Username' },
  { key: 'github_id', label: 'GitHub' },
  { key: 'created_at', label: 'Joined' },
  { key: 'lastProgress', label: 'Last Progress' },
  { key: 'lastTaskUpdate', label: 'Last Task Update' },
  { key: 'activeTaskCount', label: 'Active Tasks' },
];

interface FilterState {
  sortBy: UserSortField;
  sortOrder: SortOrder;
  inDiscord: boolean;
  archived: boolean;
  hideSuperusers: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState & { page: number }> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('inDiscord', String(overrides.inDiscord ?? filters.inDiscord));
  params.set('archived', String(overrides.archived ?? filters.archived));
  params.set('hideSuperusers', String(overrides.hideSuperusers ?? filters.hideSuperusers));
  params.set('page', String(overrides.page ?? 1));
  return `/members?${params.toString()}`;
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

function getDiscordBadge(inDiscord?: boolean) {
  return inDiscord
    ? { label: 'Yes', className: 'border-green-500 text-green-600 bg-transparent' }
    : { label: 'No', className: 'border-red-300 text-red-400 bg-transparent' };
}

function getArchivedBadge(archived?: boolean) {
  return archived
    ? { label: 'Yes', className: 'border-red-300 text-red-400 bg-transparent' }
    : { label: 'No', className: 'border-green-500 text-green-600 bg-transparent' };
}

export default async function MembersPage({ searchParams }: PageProps) {
  // Access is already checked in layout - session is guaranteed
  const session = (await getSession())!;
  const isRoot = isRootUser(session.userId);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page || '1', 10));
  const sortBy = (sortableColumns.find(c => c.key === params.sortBy)?.key || 'created_at') as UserSortField;
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as SortOrder;

  // Parse filter params with defaults: inDiscord=true, archived=false, hideSuperusers=true
  const inDiscord = params.inDiscord !== 'false';
  const archived = params.archived === 'true';
  const hideSuperusers = params.hideSuperusers !== 'false';

  const filters: FilterState = { sortBy, sortOrder, inDiscord, archived, hideSuperusers };

  const { users, total, hasMore } = await getCachedUsers({
    limit: ITEMS_PER_PAGE,
    offset: (page - 1) * ITEMS_PER_PAGE,
    sortBy,
    sortOrder,
    inDiscord,
    archived,
    hideSuperusers,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          {total} members found
        </p>
      </div>

      {/* Filter Bar */}
      <MembersFilterBar filters={filters} />

      {/* Desktop Table (Resizable) */}
      <div className="hidden md:block">
        <MembersTable users={users} filters={filters} isRoot={isRoot} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const discordInfo = getDiscordBadge(user.roles?.in_discord);
          const archivedInfo = getArchivedBadge(user.roles?.archived);
          return (
            <Link 
              key={user.id} 
              href={`/member/${user.id}`}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.picture?.url} alt={user.username} />
                <AvatarFallback>
                  {getInitials(user.first_name, user.last_name, user.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  @{user.username}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Badge variant="outline" className={`text-xs ${discordInfo.className}`}>
                  Discord: {discordInfo.label}
                </Badge>
                {user.roles?.archived && (
                  <Badge variant="outline" className={`text-xs ${archivedInfo.className}`}>
                    Archived
                  </Badge>
                )}
              </div>
              {isRoot && <UserInfoPopover userId={user.id} />}
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page <= 1}
            >
              <Link
                href={buildUrl(filters, { page: page - 1 })}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={!hasMore}
            >
              <Link
                href={buildUrl(filters, { page: page + 1 })}
                className={!hasMore ? 'pointer-events-none opacity-50' : ''}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
