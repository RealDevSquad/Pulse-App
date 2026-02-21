import { getSession } from '@/lib/auth';
import { isRootUser } from '@/lib/users';
import { getCachedUsers, type UserSortField, type SortOrder } from '@/lib/users-cache';
import { db } from '@/lib/firebase-admin';
import { ChevronLeft, ChevronRight, Clock, MoreVertical } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserInfoPopover } from '@/components/user-info-popover';
import { MembersFilterBar } from '@/components/members-filter-bar';
import { MembersSearch } from '@/components/members-search';
import { MembersTable } from '@/components/members-table';
import { MemberHideMenu } from '@/components/member-hide-menu';
import Link from 'next/link';

const MEMBERS_HIDDEN_META_TYPE = 'members_hidden';

/**
 * Fetch hidden user IDs from Firestore
 */
async function getHiddenUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const hiddenUserIds = new Set<string>();

  await Promise.all(
    userIds.map(async (userId) => {
      const snapshot = await db
        .collection('pulseAppOnly')
        .where('meta.type', '==', MEMBERS_HIDDEN_META_TYPE)
        .where('targetId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const latestEvent = snapshot.docs[0].data();
        if (latestEvent.action === 'hide') {
          hiddenUserIds.add(userId);
        }
      }
    })
  );

  return hiddenUserIds;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    sortBy?: string;
    sortOrder?: string;
    inDiscord?: string;
    archived?: string;
    hideSuperusers?: string;
    search?: string;
    showHidden?: string;
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
  search: string;
  showHidden: boolean;
}

function buildUrl(filters: FilterState, overrides: Partial<FilterState & { page: number }> = {}) {
  const params = new URLSearchParams();
  params.set('sortBy', overrides.sortBy ?? filters.sortBy);
  params.set('sortOrder', overrides.sortOrder ?? filters.sortOrder);
  params.set('inDiscord', String(overrides.inDiscord ?? filters.inDiscord));
  params.set('archived', String(overrides.archived ?? filters.archived));
  params.set('hideSuperusers', String(overrides.hideSuperusers ?? filters.hideSuperusers));
  params.set('showHidden', String(overrides.showHidden ?? filters.showHidden));
  params.set('page', String(overrides.page ?? 1));
  // Preserve search param
  const searchVal = overrides.search ?? filters.search;
  if (searchVal) {
    params.set('search', searchVal);
  }
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

function formatLastActive(timestamp?: number): string {
  if (!timestamp) return 'No activity';
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default async function MembersPage({ searchParams }: PageProps) {
  // Fetch session and params in parallel
  const [session, params] = await Promise.all([
    getSession(),
    searchParams,
  ]);

  const page = Math.max(1, parseInt(params.page || '1', 10));
  const sortBy = (sortableColumns.find(c => c.key === params.sortBy)?.key || 'created_at') as UserSortField;
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as SortOrder;

  // Parse filter params with defaults: inDiscord=true, archived=false, hideSuperusers=true, showHidden=false
  const inDiscord = params.inDiscord !== 'false';
  const archived = params.archived === 'true';
  const hideSuperusers = params.hideSuperusers !== 'false';
  const showHidden = params.showHidden === 'true';
  const search = params.search || '';

  const filters: FilterState = { sortBy, sortOrder, inDiscord, archived, hideSuperusers, search, showHidden };

  // Fetch isRoot and users data in parallel
  const [isRoot, { users: allUsers, total: totalBeforeHidden, hasMore: hasMoreBeforeHidden }] = await Promise.all([
    isRootUser(session!.userId),
    getCachedUsers({
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
      sortBy,
      sortOrder,
      inDiscord,
      archived,
      hideSuperusers,
      search,
    }),
  ]);

  // Fetch hidden user IDs for all users (any user can see the filtered list)
  const hiddenUserIds = await getHiddenUserIds(allUsers.map(u => u.id));

  // Filter out hidden users unless showHidden is true
  const users = showHidden
    ? allUsers
    : allUsers.filter(u => !hiddenUserIds.has(u.id));

  // Calculate totals - note: hidden count is only for the current page's users
  const hiddenCount = hiddenUserIds.size;
  const total = showHidden ? totalBeforeHidden : totalBeforeHidden - hiddenCount;
  const hasMore = showHidden ? hasMoreBeforeHidden : hasMoreBeforeHidden;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {total} members found{search && ` for "${search}"`}
          </p>
        </div>
        {/* Desktop search - hidden on mobile */}
        <div className="hidden sm:block">
          <MembersSearch />
        </div>
      </div>

      {/* Filter Bar with mobile search */}
      <MembersFilterBar filters={filters} hiddenCount={hiddenCount} isRoot={isRoot} />

      {/* Desktop Table (Resizable) */}
      <div className="hidden md:block">
        <MembersTable users={users} filters={filters} isRoot={isRoot} hiddenUserIds={hiddenUserIds} />
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const lastActive = user.lastTaskUpdate || user.lastProgress || undefined;
          const lastActiveText = formatLastActive(lastActive);
          const isRecentlyActive = lastActive && (Date.now() - lastActive) < 7 * 24 * 60 * 60 * 1000;
          const isUserHidden = hiddenUserIds.has(user.id);

          return (
            <div
              key={user.id}
              className="p-4 rounded-lg bg-card border shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              {/* Header: Avatar + Name */}
              <div className="flex items-center gap-3">
                <Link href={`/member/${user.id}`} className="relative shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.picture?.url} alt={user.username} />
                    <AvatarFallback className="text-base font-medium">
                      {getInitials(user.first_name, user.last_name, user.username)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Activity indicator */}
                  {isRecentlyActive && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card" />
                  )}
                </Link>
                <Link href={`/member/${user.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    @{user.username}
                  </div>
                </Link>
                {isRoot && (
                  <div className="flex items-center gap-1">
                    <UserInfoPopover userId={user.id} />
                    <MemberHideMenu userId={user.id} isHidden={isUserHidden} username={user.username} />
                  </div>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-4 text-sm">
                  {/* Discord status */}
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${user.roles?.in_discord ? 'bg-indigo-500' : 'bg-muted'}`} />
                    <span className="text-muted-foreground">Discord</span>
                  </div>
                  {/* Active tasks */}
                  {user.activeTaskCount !== undefined && user.activeTaskCount > 0 && (
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">{user.activeTaskCount}</span> tasks
                    </div>
                  )}
                </div>
                {/* Last active */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{lastActiveText}</span>
                </div>
              </div>

              {/* Badges row */}
              {(user.roles?.archived || isUserHidden) && (
                <div className="mt-2 flex gap-2">
                  {isUserHidden && (
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-500 bg-transparent">
                      Hidden
                    </Badge>
                  )}
                  {user.roles?.archived && (
                    <Badge variant="outline" className="text-xs border-red-300 text-red-400 bg-transparent">
                      Archived
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {users.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
            <span>No members found</span>
          </div>
        )}
      </div>

      {/* Pagination - sticky at bottom */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-4 py-4 border-t bg-background">
          <p className="text-sm text-muted-foreground shrink-0">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page <= 1}
              className="h-10"
            >
              <Link
                href={buildUrl(filters, { page: page - 1 })}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={!hasMore}
              className="h-10"
            >
              <Link
                href={buildUrl(filters, { page: page + 1 })}
                className={!hasMore ? 'pointer-events-none opacity-50' : ''}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
