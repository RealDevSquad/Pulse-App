/**
 * Member Performance Metrics Types and Utilities
 *
 * This file contains types and pure utility functions that can be used
 * in both server and client components. The actual metric calculation
 * functions that require Firebase Admin are in member-metrics.ts.
 */

// ============================================================================
// Types
// ============================================================================

export interface MetricScore {
  /** Current score 0-100 */
  value: number;
  /** % change from 90-day baseline (positive = improvement) */
  trend: number;
  /** Score for last 30 days */
  period30: number;
  /** Score for last 90 days */
  period90: number;
}

export interface MemberMetrics {
  taskVelocity: MetricScore;
  communicationConsistency: MetricScore;
  workSteadiness: MetricScore;
  completionQuality: MetricScore;
  growthTrajectory: MetricScore;
  /** Weighted average of all metrics */
  overallScore: number;
  /** Calculation timestamp in ms */
  calculatedAt: number;
  /** Data availability summary */
  dataAvailability: {
    tasksAnalyzed: number;
    logsAnalyzed: number;
    progressesAnalyzed: number;
    oooDaysExcluded: number;
  };
}

export type ScoreLevel = 'excellent' | 'good' | 'average' | 'below_average' | 'poor';

// ============================================================================
// Score Level Utilities
// ============================================================================

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 81) return 'excellent';
  if (score >= 61) return 'good';
  if (score >= 41) return 'average';
  if (score >= 21) return 'below_average';
  return 'poor';
}

export function getScoreColor(score: number): { text: string; bg: string; border: string } {
  const level = getScoreLevel(score);
  switch (level) {
    case 'excellent':
      return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    case 'good':
      return { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'average':
      return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    case 'below_average':
      return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    case 'poor':
      return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  }
}
