import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface MemberMetrics {
  tasksAssigned: number;
  tasksStarted: number;
  tasksCompleted: number;
  taskUpdates: number;
  extensionRequests: number;
}

interface MetricsCardProps {
  metrics: MemberMetrics;
}

export function MetricsCard({ metrics }: MetricsCardProps) {
  const completionRate =
    metrics.tasksAssigned > 0
      ? Math.round((metrics.tasksCompleted / metrics.tasksAssigned) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
          30-Day Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{metrics.tasksAssigned}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Assigned</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">{metrics.tasksStarted}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Started</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">{metrics.tasksCompleted}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-xl sm:text-2xl font-bold">{metrics.taskUpdates}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Updates</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50 col-span-2 sm:col-span-1">
            <p
              className={`text-xl sm:text-2xl font-bold ${metrics.extensionRequests > 0 ? 'text-red-600' : ''}`}
            >
              {metrics.extensionRequests}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">Extensions</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="mt-4 p-3 rounded-lg bg-muted/30 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Completion Rate</span>
          <span
            className={`text-lg font-bold ${
              completionRate >= 70
                ? 'text-green-600'
                : completionRate >= 40
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {completionRate}%
          </span>
        </div>

        {/* Warning for high extension requests */}
        {metrics.extensionRequests > 2 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start sm:items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-sm font-medium">Multiple extension requests detected</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
