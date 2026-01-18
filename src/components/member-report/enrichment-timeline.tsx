'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ENRICHMENT_TYPES,
  ENRICHMENT_CATEGORIES,
  type MemberEnrichmentEvent,
} from '@/lib/enrichment-types';
import { MessageSquare, Target, Award, Handshake, Loader2, History, Plus, User } from 'lucide-react';

const ICON_MAP = {
  MessageSquare,
  Target,
  Award,
  Handshake,
} as const;

interface EnrichmentTimelineProps {
  targetUserId: string;
  userMap?: Map<string, string>;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function EnrichmentTimeline({ targetUserId, userMap }: EnrichmentTimelineProps) {
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
          Loading enrichment notes...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <History className="h-4 w-4 sm:h-5 sm:w-5" />
            Enrichment Notes ({events.length})
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/member/${targetUserId}/enrich`}>
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No enrichment notes yet.</p>
            <Button variant="outline" asChild>
              <Link href={`/member/${targetUserId}/enrich`}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Note
              </Link>
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-4">
              {events.map((event, index) => {
                const typeInfo = ENRICHMENT_TYPES[event.enrichmentType];
                const categoryInfo = ENRICHMENT_CATEGORIES[event.content.category];
                const IconComponent = ICON_MAP[typeInfo.icon as keyof typeof ICON_MAP];
                const authorName = userMap?.get(event.meta.by) || 'Unknown';

                return (
                  <div key={event.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ${categoryInfo.bgClass} ${categoryInfo.borderClass} border-2`}
                    >
                      {IconComponent && (
                        <IconComponent className={`h-3 w-3 ${categoryInfo.textClass}`} />
                      )}
                    </div>

                    <div
                      className={`rounded-lg border p-3 ${categoryInfo.bgClass} ${categoryInfo.borderClass}`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {typeInfo.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${categoryInfo.bgClass} ${categoryInfo.textClass} ${categoryInfo.borderClass}`}
                          >
                            {categoryInfo.label}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{event.content.text}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <User className="h-3 w-3" />
                        <span>by {authorName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
