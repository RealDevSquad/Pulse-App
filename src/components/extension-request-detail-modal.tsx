'use client';

import { useState, useEffect } from 'react';
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
import { ExtensionEnrichmentDisplay } from './extension-enrichment-display';
import type { ExtensionEnrichmentEvent, AutoComputedFlags } from '@/lib/extension-enrichment-types';

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusStyle(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'border-green-500 text-green-600 bg-transparent dark:text-green-400';
    case 'DENIED':
      return 'border-red-500 text-red-600 bg-transparent dark:text-red-400';
    case 'PENDING':
    default:
      return 'border-yellow-500 text-yellow-600 bg-transparent dark:text-yellow-400';
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
  /** Whether the current user is an admin */
  isAdmin?: boolean;
  /** Callback when enrichment is updated */
  onEnrichmentUpdated?: (extensionId: string, enrichment: ExtensionEnrichmentEvent) => void;
}

export function ExtensionRequestDetailModal({
  extensionRequest,
  open,
  onOpenChange,
  isAdmin = false,
  onEnrichmentUpdated,
}: ExtensionRequestDetailModalProps) {
  const [enrichment, setEnrichment] = useState<ExtensionEnrichmentEvent | null>(null);
  const [isLoadingEnrichment, setIsLoadingEnrichment] = useState(false);

  // Fetch enrichment data when modal opens
  useEffect(() => {
    if (open && extensionRequest?.id) {
      setIsLoadingEnrichment(true);
      fetch(`/api/extension-enrichment?extensionId=${extensionRequest.id}`)
        .then((res) => res.json())
        .then((data) => {
          setEnrichment(data.enrichment || null);
        })
        .catch((err) => {
          console.error('Failed to fetch extension enrichment:', err);
          setEnrichment(null);
        })
        .finally(() => {
          setIsLoadingEnrichment(false);
        });
    }
  }, [open, extensionRequest?.id]);

  // Reset enrichment when modal closes
  useEffect(() => {
    if (!open) {
      setEnrichment(null);
    }
  }, [open]);

  if (!extensionRequest) return null;

  const daysDiff = getDaysDiff(extensionRequest.oldEndsOn, extensionRequest.newEndsOn);
  const user = extensionRequest.assigneeUser;

  // Pre-compute some flags for the enrichment dialog
  const preComputedFlags: Partial<AutoComputedFlags> = {
    sameTaskRepeat: (extensionRequest.requestNumber || 1) > 1,
    significantDelay: daysDiff > 7,
  };

  const handleEnrichmentSaved = (newEnrichment: ExtensionEnrichmentEvent) => {
    setEnrichment(newEnrichment);
    if (onEnrichmentUpdated) {
      onEnrichmentUpdated(extensionRequest.id, newEnrichment);
    }
  };

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

        {/* Enrichment Analysis */}
        {!isLoadingEnrichment && (
          <ExtensionEnrichmentDisplay
            enrichment={enrichment}
            extensionId={extensionRequest.id}
            taskId={extensionRequest.taskId}
            userId={extensionRequest.assignee}
            taskTitle={extensionRequest.taskTitle || extensionRequest.title || 'Unknown Task'}
            assigneeName={
              user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.username
            }
            oldEndsOn={extensionRequest.oldEndsOn}
            newEndsOn={extensionRequest.newEndsOn}
            reason={extensionRequest.reason}
            preComputedFlags={preComputedFlags}
            isAdmin={isAdmin}
            onEnrichmentUpdated={handleEnrichmentSaved}
          />
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
