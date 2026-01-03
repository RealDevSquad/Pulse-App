'use client';

import { format, differenceInDays } from 'date-fns';
import { ExternalLink, Calendar, User, Clock, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
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
  if (!timestamp) return 'Not set';
  try {
    // Convert seconds to milliseconds if needed
    const ms = isSeconds && timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    return format(new Date(ms), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

function getDaysDiff(oldEndsOn: number, newEndsOn: number): number {
  try {
    // Assuming both are in seconds
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

function getDashboardUrl(taskId: string, status: string): string {
  const statusParam = status || 'PENDING';
  return `https://dashboard.realdevsquad.com/extension-requests?order=desc&q=taskId:${taskId},status:${statusParam}`;
}

// =============================================================================
// Component
// =============================================================================

interface ExtensionRequestDetailModalProps {
  extensionRequest: ExtensionRequestWithUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtensionRequestDetailModal({
  extensionRequest,
  open,
  onOpenChange,
}: ExtensionRequestDetailModalProps) {
  if (!extensionRequest) return null;

  const daysDiff = getDaysDiff(extensionRequest.oldEndsOn, extensionRequest.newEndsOn);
  const user = extensionRequest.assigneeUser;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3 pr-8">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-left">Extension Request</span>
          </DialogTitle>
        </DialogHeader>

        {/* Task Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {extensionRequest.taskTitle || extensionRequest.title || 'Unknown Task'}
            </h3>
            <Badge className={cn('text-xs', getStatusStyle(extensionRequest.status))}>
              {extensionRequest.status}
            </Badge>
          </div>
          <Link
            href={`/task/${extensionRequest.taskId}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            View Task Details
          </Link>
        </div>

        <Separator />

        {/* Assignee */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Assignee
          </h3>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.picture?.url} />
              <AvatarFallback>
                {getInitials(user?.first_name, user?.last_name, user?.username)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username || 'Unknown User'}
              </p>
              {user?.username && (
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Extension Details */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Extension Details
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Current ETA</p>
              <p className="font-medium">{formatDate(extensionRequest.oldEndsOn)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Requested ETA</p>
              <p className="font-medium">
                {formatDate(extensionRequest.newEndsOn)}
                {daysDiff > 0 && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">
                    (+{daysDiff} days)
                  </span>
                )}
              </p>
            </div>
          </div>
          {extensionRequest.requestNumber && extensionRequest.requestNumber > 1 && (
            <p className="text-sm text-muted-foreground">
              Request #{extensionRequest.requestNumber} for this task
            </p>
          )}
        </div>

        <Separator />

        {/* Reason */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Reason</h3>
          <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg border">
            <p className="whitespace-pre-wrap">
              {extensionRequest.reason || 'No reason provided.'}
            </p>
          </div>
        </div>

        {/* Reviewed By (if approved/denied) */}
        {extensionRequest.reviewedBy && (
          <>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Reviewed by:</span> {extensionRequest.reviewedBy}
              {extensionRequest.reviewedAt && (
                <span className="ml-2">
                  on {formatDate(extensionRequest.reviewedAt)}
                </span>
              )}
            </div>
          </>
        )}

        <Separator />

        {/* Dashboard Link */}
        <div className="flex justify-end">
          <Button asChild>
            <a
              href={getDashboardUrl(extensionRequest.taskId, extensionRequest.status)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              Manage in Dashboard
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
