'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetricItem } from './metric-item';
import { getScoreLevel, getScoreColor, type MemberMetrics } from '@/lib/member-metrics-types';
import {
  Zap,
  MessageSquare,
  Activity,
  Award,
  TrendingUp,
  BarChart3,
  Info,
} from 'lucide-react';

interface PerformanceMetricsCardProps {
  metrics: MemberMetrics;
}

const LEVEL_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  below_average: 'Below Average',
  poor: 'Needs Attention',
};

const METRIC_DESCRIPTIONS = {
  taskVelocity: 'On-time task completion rate',
  communicationConsistency: 'Regular updates and standup participation',
  workSteadiness: 'Consistency of work activity across weeks',
  completionQuality: 'Tasks completed without extensions or blockers',
  growthTrajectory: 'Improvement trend over time',
};

export function PerformanceMetricsCard({ metrics }: PerformanceMetricsCardProps) {
  const overallLevel = getScoreLevel(metrics.overallScore);
  const overallColors = getScoreColor(metrics.overallScore);

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            Performance Metrics
          </CardTitle>

          {/* Overall Score Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Overall:</span>
            <Badge
              variant="outline"
              className={`text-base font-bold ${overallColors.text} ${overallColors.bg} ${overallColors.border}`}
            >
              {metrics.overallScore}/100 - {LEVEL_LABELS[overallLevel]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        {/* 2x2 Grid for main metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricItem
            label="Task Velocity"
            icon={Zap}
            metric={metrics.taskVelocity}
            description={METRIC_DESCRIPTIONS.taskVelocity}
          />
          <MetricItem
            label="Communication"
            icon={MessageSquare}
            metric={metrics.communicationConsistency}
            description={METRIC_DESCRIPTIONS.communicationConsistency}
          />
          <MetricItem
            label="Work Steadiness"
            icon={Activity}
            metric={metrics.workSteadiness}
            description={METRIC_DESCRIPTIONS.workSteadiness}
          />
          <MetricItem
            label="Completion Quality"
            icon={Award}
            metric={metrics.completionQuality}
            description={METRIC_DESCRIPTIONS.completionQuality}
          />
        </div>

        {/* Growth Trajectory - Full Width */}
        <MetricItem
          label="Growth Trajectory"
          icon={TrendingUp}
          metric={metrics.growthTrajectory}
          description={METRIC_DESCRIPTIONS.growthTrajectory}
        />

        {/* Data Availability Info */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
          <Info className="h-3 w-3" />
          <span>
            Based on {metrics.dataAvailability.tasksAnalyzed} tasks,{' '}
            {metrics.dataAvailability.logsAnalyzed} logs,{' '}
            {metrics.dataAvailability.progressesAnalyzed} progress updates
          </span>
          {metrics.dataAvailability.oooDaysExcluded > 0 && (
            <span className="text-muted-foreground">
              ({metrics.dataAvailability.oooDaysExcluded} OOO days excluded)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
