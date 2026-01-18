'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { getScoreColor, type MetricScore } from '@/lib/member-metrics-types';

interface MetricItemProps {
  label: string;
  icon: LucideIcon;
  metric: MetricScore;
  description?: string;
}

export function MetricItem({ label, icon: Icon, metric, description }: MetricItemProps) {
  const colors = getScoreColor(metric.value);

  // Determine trend icon and color
  let TrendIcon = Minus;
  let trendColor = 'text-muted-foreground';
  let trendLabel = 'Stable';

  if (metric.trend > 3) {
    TrendIcon = TrendingUp;
    trendColor = 'text-green-500';
    trendLabel = `+${metric.trend}% vs 90d`;
  } else if (metric.trend < -3) {
    TrendIcon = TrendingDown;
    trendColor = 'text-red-500';
    trendLabel = `${metric.trend}% vs 90d`;
  }

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${colors.bg} ${colors.border}`}>
      {/* Icon and Score */}
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${colors.text}`} />
        <span className={`text-2xl sm:text-3xl font-bold ${colors.text}`}>
          {metric.value}
        </span>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-foreground">{label}</p>

      {/* Description (optional) */}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Progress Bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            metric.value >= 81
              ? 'bg-green-500'
              : metric.value >= 61
                ? 'bg-blue-500'
                : metric.value >= 41
                  ? 'bg-yellow-500'
                  : metric.value >= 21
                    ? 'bg-orange-500'
                    : 'bg-red-500'
          }`}
          style={{ width: `${metric.value}%` }}
        />
      </div>

      {/* Trend Indicator */}
      <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
        <TrendIcon className="h-3 w-3" />
        <span>{trendLabel}</span>
      </div>
    </div>
  );
}
