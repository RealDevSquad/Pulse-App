'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonPulse } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingDown, Clock, RefreshCw, Zap } from 'lucide-react';
import {
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  getAvoidabilityColorClasses,
  calculateEnrichmentStats,
  type ExtensionEnrichmentEvent,
  type AvoidabilityType,
  type RootCauseType,
} from '@/lib/extension-enrichment-types';

interface ExtensionPatternsAnalysisProps {
  userId: string;
}

interface EnrichmentStats {
  total: number;
  byAvoidability: Record<AvoidabilityType, number>;
  byRootCause: Record<RootCauseType, number>;
  avgAvoidabilityWeight: number;
  flagCounts: {
    repeatOffender: number;
    sameTaskRepeat: number;
    shortInterval: number;
    significantDelay: number;
  };
}

function BarChart({
  data,
  maxValue,
  getLabel,
  getColor,
}: {
  data: Record<string, number>;
  maxValue: number;
  getLabel: (key: string) => string;
  getColor?: (key: string) => string;
}) {
  // Sort by count descending
  const sortedEntries = Object.entries(data)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  if (sortedEntries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No data available</p>
    );
  }

  return (
    <div className="space-y-2">
      {sortedEntries.map(([key, count]) => {
        const percentage = maxValue > 0 ? (count / maxValue) * 100 : 0;
        const colorClass = getColor?.(key) || 'bg-primary';

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{getLabel(key)}</span>
              <span className="text-muted-foreground ml-2">
                {count} ({Math.round((count / Object.values(data).reduce((a, b) => a + b, 0)) * 100) || 0}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${colorClass}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExtensionPatternsAnalysis({ userId }: ExtensionPatternsAnalysisProps) {
  const [enrichments, setEnrichments] = useState<ExtensionEnrichmentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    fetch(`/api/extension-enrichment?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.enrichments) {
          setEnrichments(data.enrichments);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch extension enrichments:', err);
        setError('Failed to load extension patterns');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [userId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
            Extension Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-4">
            <SkeletonPulse className="h-4 w-32" />
            <SkeletonPulse className="h-20 w-full" />
            <SkeletonPulse className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
            Extension Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (enrichments.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
            Extension Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <p className="text-sm text-muted-foreground italic">
            No enriched extension requests found for this member.
          </p>
        </CardContent>
      </Card>
    );
  }

  const stats = calculateEnrichmentStats(enrichments);
  const maxAvoidability = Math.max(...Object.values(stats.byAvoidability));
  const maxRootCause = Math.max(...Object.values(stats.byRootCause));

  // Calculate avoidable percentage (weight >= 2)
  const avoidableCount = Object.entries(stats.byAvoidability)
    .filter(([key]) => AVOIDABILITY_OPTIONS[key as AvoidabilityType].weight >= 2)
    .reduce((sum, [, count]) => sum + count, 0);
  const avoidablePercentage = stats.total > 0 ? Math.round((avoidableCount / stats.total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
          Extension Patterns
          <Badge variant="outline" className="ml-auto text-xs">
            {stats.total} enriched
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Enriched</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p
              className={`text-xl font-bold ${
                avoidablePercentage >= 50 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {avoidablePercentage}%
            </p>
            <p className="text-xs text-muted-foreground">Avoidable</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl font-bold">{stats.avgAvoidabilityWeight.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Severity</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p
              className={`text-xl font-bold ${
                stats.flagCounts.repeatOffender > 0 ? 'text-red-600' : ''
              }`}
            >
              {stats.flagCounts.repeatOffender}
            </p>
            <p className="text-xs text-muted-foreground">Repeat Offenses</p>
          </div>
        </div>

        {/* Avoidability Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Avoidability Distribution</h4>
          <BarChart
            data={stats.byAvoidability as Record<string, number>}
            maxValue={maxAvoidability}
            getLabel={(key) => AVOIDABILITY_OPTIONS[key as AvoidabilityType].label}
            getColor={(key) => {
              const weight = AVOIDABILITY_OPTIONS[key as AvoidabilityType].weight;
              if (weight === 0) return 'bg-gray-400';
              if (weight === 1) return 'bg-yellow-500';
              if (weight === 2) return 'bg-orange-500';
              return 'bg-red-500';
            }}
          />
        </div>

        {/* Root Cause Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Root Cause Distribution</h4>
          <BarChart
            data={stats.byRootCause as Record<string, number>}
            maxValue={maxRootCause}
            getLabel={(key) => ROOT_CAUSE_OPTIONS[key as RootCauseType].label}
            getColor={() => 'bg-blue-500'}
          />
        </div>

        {/* Auto-Detected Patterns */}
        {(stats.flagCounts.repeatOffender > 0 ||
          stats.flagCounts.sameTaskRepeat > 0 ||
          stats.flagCounts.shortInterval > 0 ||
          stats.flagCounts.significantDelay > 0) && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Auto-Detected Patterns
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {stats.flagCounts.repeatOffender > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
                  <RefreshCw className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      Repeat Offender
                    </p>
                    <p className="text-xs text-red-600/70">
                      {stats.flagCounts.repeatOffender} occurrences
                    </p>
                  </div>
                </div>
              )}
              {stats.flagCounts.sameTaskRepeat > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      Same Task Repeat
                    </p>
                    <p className="text-xs text-orange-600/70">
                      {stats.flagCounts.sameTaskRepeat} occurrences
                    </p>
                  </div>
                </div>
              )}
              {stats.flagCounts.shortInterval > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                      Short Interval
                    </p>
                    <p className="text-xs text-yellow-600/70">
                      {stats.flagCounts.shortInterval} occurrences
                    </p>
                  </div>
                </div>
              )}
              {stats.flagCounts.significantDelay > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                      Significant Delay
                    </p>
                    <p className="text-xs text-purple-600/70">
                      {stats.flagCounts.significantDelay} occurrences
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
