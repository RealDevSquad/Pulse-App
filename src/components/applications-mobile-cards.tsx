'use client';

import { useState } from 'react';
import { MapPin, GraduationCap, Clock } from 'lucide-react';
import { FolderOpenIcon } from '@/components/ui/folder-open';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { ApplicationDetailModal } from '@/components/application-detail-modal';
import { cn } from '@/lib/utils';
import type { Application, ApplicationStatus } from '@/types';

// =============================================================================
// Helper functions
// =============================================================================

function getStatusStyle(status: ApplicationStatus) {
  switch (status) {
    case 'accepted':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'pending':
    default:
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return 'In future';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return dateString;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// =============================================================================
// Component
// =============================================================================

interface ApplicationsMobileCardsProps {
  applications: Application[];
}

export function ApplicationsMobileCards({ applications }: ApplicationsMobileCardsProps) {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (application: Application) => {
    setSelectedApplication(application);
    setIsModalOpen(true);
  };

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <FolderOpenIcon size={32} animateOnMount className="text-muted-foreground/50" />
        <span>No applications found</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {applications.map((application) => {
          const fullName = `${application.biodata.firstName} ${application.biodata.lastName}`;
          const location = `${application.location.city}, ${application.location.country}`;

          return (
            <div
              key={application.id}
              className="p-4 rounded-lg bg-card border shadow-sm space-y-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => handleCardClick(application)}
            >
              {/* Header: Name + Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground leading-snug capitalize">
                    {fullName}
                  </span>
                </div>
                <span className={cn(
                  'shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  getStatusStyle(application.status)
                )}>
                  {capitalize(application.status)}
                </span>
              </div>

              {/* Info row */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[150px]">{application.professional.institution}</span>
                </div>
              </div>

              {/* Footer: Hours + Applied date */}
              <div className="flex items-center justify-between text-sm text-muted-foreground/70">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{application.intro.numberOfHours} hrs/week</span>
                </div>
                <span>{formatRelativeTime(application.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <ApplicationDetailModal
        application={selectedApplication}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function ApplicationsMobileCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg bg-card border shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <SkeletonPulse className="h-5 w-32" />
            <SkeletonPulse className="h-6 w-16 rounded-full" />
          </div>

          {/* Info row */}
          <div className="flex items-center gap-3">
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-4 w-28" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
