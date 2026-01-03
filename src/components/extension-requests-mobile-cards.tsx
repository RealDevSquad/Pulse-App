'use client';

import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ArrowRight, Calendar, User, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { ExtensionRequestDetailModal } from '@/components/extension-request-detail-modal';
import { cn } from '@/lib/utils';
import type { ExtensionRequestWithUser } from '@/lib/extension-requests-cache';

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusStyle(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'DENIED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'PENDING':
    default:
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
}

function formatDate(timestamp: number | undefined, isSeconds = true): string {
  if (!timestamp) return 'N/A';
  try {
    const ms = isSeconds && timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    return format(new Date(ms), 'MMM d');
  } catch {
    return 'N/A';
  }
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const now = Date.now();
    const diff = now - ms;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'In future';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return 'Unknown';
  }
}

function getDaysDiff(oldEndsOn: number, newEndsOn: number): number {
  try {
    const oldDate = new Date(oldEndsOn * 1000);
    const newDate = new Date(newEndsOn * 1000);
    return differenceInDays(newDate, oldDate);
  } catch {
    return 0;
  }
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

// =============================================================================
// Component
// =============================================================================

interface ExtensionRequestsMobileCardsProps {
  extensionRequests: ExtensionRequestWithUser[];
}

export function ExtensionRequestsMobileCards({ extensionRequests }: ExtensionRequestsMobileCardsProps) {
  const [selectedRequest, setSelectedRequest] = useState<ExtensionRequestWithUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (request: ExtensionRequestWithUser) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  if (extensionRequests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No extension requests found.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {extensionRequests.map((request) => {
          const user = request.assigneeUser;
          const daysDiff = getDaysDiff(request.oldEndsOn, request.newEndsOn);

          return (
            <Card
              key={request.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleCardClick(request)}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header: Status and Date */}
                <div className="flex items-center justify-between">
                  <Badge className={cn('text-xs', getStatusStyle(request.status))}>
                    {request.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatRelativeTime(request.timestamp)}
                  </div>
                </div>

                {/* Task Title */}
                <h3 className="font-medium line-clamp-2">
                  {request.taskTitle || request.title || 'Unknown Task'}
                </h3>

                {/* Assignee */}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.picture?.url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(user?.first_name, user?.last_name, user?.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground truncate">
                    {user?.first_name && user?.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user?.username || 'Unknown'}
                  </span>
                </div>

                {/* ETA Change */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{formatDate(request.oldEndsOn)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{formatDate(request.newEndsOn)}</span>
                    {daysDiff > 0 && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        +{daysDiff}d
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ExtensionRequestDetailModal
        extensionRequest={selectedRequest}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function ExtensionRequestsMobileCardsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-16 rounded-full" />
              <SkeletonPulse className="h-4 w-16" />
            </div>
            <SkeletonPulse className="h-5 w-3/4" />
            <div className="flex items-center gap-2">
              <SkeletonPulse className="h-4 w-4" />
              <SkeletonPulse className="h-6 w-6 rounded-full" />
              <SkeletonPulse className="h-4 w-24" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SkeletonPulse className="h-4 w-16" />
                <SkeletonPulse className="h-3 w-3" />
                <SkeletonPulse className="h-4 w-16" />
              </div>
              <SkeletonPulse className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
