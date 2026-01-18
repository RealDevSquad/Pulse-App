'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ENRICHMENT_TYPES,
  ENRICHMENT_CATEGORIES,
  type MemberEnrichmentEvent,
} from '@/lib/enrichment-types';
import { MessageSquare, Target, Award, Handshake, Loader2, Clock, User } from 'lucide-react';

const ICON_MAP = {
  MessageSquare,
  Target,
  Award,
  Handshake,
} as const;

interface MemberEnrichmentHistoryProps {
  targetUserId: string;
  /** Map of userId -> username for displaying who added notes */
  userMap?: Map<string, string>;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  });
}

export function MemberEnrichmentHistory({ targetUserId, userMap }: MemberEnrichmentHistoryProps) {
  const [events, setEvents] = useState<MemberEnrichmentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch(`/api/member-enrichment?userId=${targetUserId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch enrichment history');
        }
        const data = await response.json();
        setEvents(data.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, [targetUserId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading enrichment history...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Enrichment History</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <p className="text-muted-foreground text-center py-8">
            No enrichment notes yet. Add your first note above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Enrichment History ({events.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-4">
          {events.map((event) => {
            const typeInfo = ENRICHMENT_TYPES[event.enrichmentType];
            const categoryInfo = ENRICHMENT_CATEGORIES[event.content.category];
            const IconComponent = ICON_MAP[typeInfo.icon as keyof typeof ICON_MAP];
            const authorName = userMap?.get(event.meta.by) || 'Unknown';

            return (
              <div
                key={event.id}
                className={`rounded-lg border p-4 space-y-3 ${categoryInfo.bgClass} ${categoryInfo.borderClass}`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="gap-1">
                      {IconComponent && <IconComponent className="h-3 w-3" />}
                      {typeInfo.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`${categoryInfo.bgClass} ${categoryInfo.textClass} ${categoryInfo.borderClass}`}
                    >
                      {categoryInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{authorName}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(event.timestamp)}</span>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{event.content.text}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
