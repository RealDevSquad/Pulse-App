'use client';

import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Award,
  AlertTriangle,
  Lightbulb,
  Activity,
  Code,
  Eye,
  Clock,
  CheckCircle2,
  MessageSquare,
  Calendar,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface AIReportSectionProps {
  userId: string;
}

interface ReportMetrics {
  tenure: {
    days: number;
    since: number;
  };
  tasks: {
    completed: number;
    started: number;
    active: number;
    overdue: number;
  };
  extensions: {
    total: number;
    late: number;
    proactive: number;
  };
  communicationScore: number;
  onTimeRate: number;
  progressUpdates: {
    count: number;
    daysSinceLast: number | null;
  };
  multiPeriod: Array<{
    label: string;
    days: number;
    completed: number;
    started: number;
    extensions: number;
  }>;
}

interface ParsedSection {
  title: string;
  content: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

function parseReportSections(markdown: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = markdown.split('\n');
  let currentSection: ParsedSection | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }
      const title = line.replace('## ', '').trim();
      currentSection = {
        title,
        content: '',
        icon: getSectionIcon(title),
        variant: getSectionVariant(title),
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

function getSectionIcon(title: string): React.ComponentType<{ className?: string }> {
  const lower = title.toLowerCase();
  if (lower.includes('executive') || lower.includes('summary')) return Sparkles;
  if (lower.includes('trend') || lower.includes('performance')) return Activity;
  if (lower.includes('strength')) return Award;
  if (lower.includes('development') || lower.includes('improvement') || lower.includes('area')) return Target;
  if (lower.includes('next steps') || lower.includes('recommended')) return Lightbulb;
  if (lower.includes('risk') || lower.includes('flag')) return AlertTriangle;
  if (lower.includes('activity')) return FileText;
  return Activity;
}

function getSectionVariant(title: string): 'default' | 'success' | 'warning' | 'destructive' {
  const lower = title.toLowerCase();
  if (lower.includes('strength')) return 'success';
  if (lower.includes('risk') || lower.includes('flag')) return 'destructive';
  if (lower.includes('development') || lower.includes('improvement') || lower.includes('area')) return 'warning';
  return 'default';
}

function getTrendIcon(content: string): React.ReactNode {
  const lower = content.toLowerCase();
  if (lower.includes('improved') || lower.includes('improving') || lower.includes('increased')) {
    return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  if (lower.includes('declined') || lower.includes('declining') || lower.includes('decreased')) {
    return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  }
  return <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
}

function getTrendBadgeVariant(content: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const lower = content.toLowerCase();
  if (lower.includes('improved') || lower.includes('improving')) return 'default';
  if (lower.includes('declined') || lower.includes('declining')) return 'destructive';
  return 'secondary';
}

function formatTenure(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

// Stat Card Component
function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400',
    red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/50',
    green: 'bg-green-100 dark:bg-green-900/50',
    orange: 'bg-orange-100 dark:bg-orange-900/50',
    red: 'bg-red-100 dark:bg-red-900/50',
    purple: 'bg-purple-100 dark:bg-purple-900/50',
  };

  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <div className="flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
            {trend === 'neutral' && <Minus className="h-3 w-3 text-gray-400" />}
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{label}</p>
        {subValue && <p className="text-xs text-muted-foreground/70 mt-0.5">{subValue}</p>}
      </div>
    </div>
  );
}

// Communication Donut Chart
function CommunicationChart({ proactive, late }: { proactive: number; late: number }) {
  const total = proactive + late;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No extensions yet</p>
      </div>
    );
  }

  const data = [
    { name: 'Proactive', value: proactive, color: '#22C55E' },
    { name: 'Late', value: late, color: '#EF4444' },
  ];

  const score = Math.round((proactive / total) * 100);

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={40}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{score}%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>{proactive} proactive</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>{late} late</span>
        </div>
      </div>
    </div>
  );
}

// Activity Trend Chart
function ActivityTrendChart({ periods }: { periods: ReportMetrics['multiPeriod'] }) {
  // Reverse to show oldest first (left to right)
  const data = [...periods].reverse().map(p => ({
    name: p.label.replace('Last ', ''),
    completed: p.completed,
    started: p.started,
  }));

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="#22C55E"
            strokeWidth={2}
            fill="url(#colorCompleted)"
            name="Completed"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Progress Bar with Label
function ScoreBar({
  label,
  value,
  color = 'blue',
}: {
  label: string;
  value: number;
  color?: 'blue' | 'green' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: '[&>div]:bg-blue-500',
    green: '[&>div]:bg-green-500',
    orange: '[&>div]:bg-orange-500',
    red: '[&>div]:bg-red-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={value} className={`h-2 ${colorClasses[color]}`} />
    </div>
  );
}

export function AIReportSection({ userId }: AIReportSectionProps) {
  const [report, setReport] = useState<string>('');
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const sections = useMemo(() => {
    if (!report) return [];
    return parseReportSections(report);
  }, [report]);

  const executiveSummary = sections.find((s) =>
    s.title.toLowerCase().includes('executive')
  );
  const otherSections = sections.filter(
    (s) => !s.title.toLowerCase().includes('executive')
  );

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setReport('');
    setMetrics(null);

    try {
      const response = await fetch('/api/ai/member-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.metrics) {
                setMetrics(parsed.metrics);
              }
              if (parsed.content) {
                setReport((prev) => prev + parsed.content);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [userId]);

  // Render section with appropriate styling based on variant
  const renderSection = (section: ParsedSection, index: number) => {
    const Icon = section.icon || Activity;
    const isTrendSection = section.title.toLowerCase().includes('trend');
    const isRiskSection = section.title.toLowerCase().includes('risk');
    const isStrengthSection = section.title.toLowerCase().includes('strength');
    const isDevelopmentSection =
      section.title.toLowerCase().includes('development') ||
      section.title.toLowerCase().includes('improvement') ||
      section.title.toLowerCase().includes('area');

    // Section-specific styling
    let borderClass = 'border';
    let bgClass = '';
    let headerBgClass = '';
    let iconColorClass = 'text-blue-600 dark:text-blue-400';
    let iconBgClass = 'bg-blue-100 dark:bg-blue-900/30';

    if (isStrengthSection) {
      borderClass = 'border-green-200 dark:border-green-800';
      bgClass = 'bg-green-50/50 dark:bg-green-950/20';
      iconColorClass = 'text-green-600 dark:text-green-400';
      iconBgClass = 'bg-green-100 dark:bg-green-900/30';
    } else if (isDevelopmentSection) {
      borderClass = 'border-orange-200 dark:border-orange-800';
      bgClass = 'bg-orange-50/50 dark:bg-orange-950/20';
      iconColorClass = 'text-orange-600 dark:text-orange-400';
      iconBgClass = 'bg-orange-100 dark:bg-orange-900/30';
    } else if (isRiskSection) {
      if (section.content.toLowerCase().includes('none') || section.content.toLowerCase().includes('no immediate')) {
        borderClass = 'border-green-200 dark:border-green-800';
        bgClass = 'bg-green-50/50 dark:bg-green-950/20';
        iconColorClass = 'text-green-600 dark:text-green-400';
        iconBgClass = 'bg-green-100 dark:bg-green-900/30';
      } else {
        borderClass = 'border-red-200 dark:border-red-800';
        bgClass = 'bg-red-50/50 dark:bg-red-950/20';
        iconColorClass = 'text-red-600 dark:text-red-400';
        iconBgClass = 'bg-red-100 dark:bg-red-900/30';
      }
    }

    return (
      <Card key={index} className={`${borderClass} ${bgClass} overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${iconBgClass}`}>
              <Icon className={`h-4 w-4 ${iconColorClass}`} />
            </div>
            <h3 className="font-semibold text-sm sm:text-base">{section.title}</h3>
          </div>
          {isTrendSection ? (
            (() => {
              const trendItems = section.content
                .split('\n')
                .map((line) => {
                  if (line.trim().startsWith('- **')) {
                    const match = line.match(/\*\*(.*?)\*\*:\s*(.*)/);
                    if (match) {
                      return { label: match[1], description: match[2] };
                    }
                  }
                  return null;
                })
                .filter(Boolean) as { label: string; description: string }[];

              if (trendItems.length === 0) {
                return (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-ul:space-y-2 prose-li:text-sm prose-strong:text-foreground">
                    <ReactMarkdown>{section.content}</ReactMarkdown>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {trendItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      {getTrendIcon(item.description)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{item.label}</span>
                          {(item.description.toLowerCase().includes('improved') ||
                            item.description.toLowerCase().includes('declined') ||
                            item.description.toLowerCase().includes('stable')) && (
                            <Badge
                              variant={getTrendBadgeVariant(item.description)}
                              className="text-xs"
                            >
                              {item.description.toLowerCase().includes('improved')
                                ? 'Improving'
                                : item.description.toLowerCase().includes('declined')
                                  ? 'Declining'
                                  : 'Stable'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : isRiskSection && (section.content.toLowerCase().includes('none') || section.content.toLowerCase().includes('no immediate')) ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100/50 dark:bg-green-900/20">
              <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                No immediate concerns identified
              </p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-ul:space-y-2 prose-li:text-sm prose-strong:text-foreground">
              <ReactMarkdown>{section.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
            AI Performance Analysis
          </CardTitle>
          {hasGenerated && !isGenerating && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRaw(!showRaw)}
              >
                {showRaw ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Show Formatted
                  </>
                ) : (
                  <>
                    <Code className="h-4 w-4 mr-1" />
                    Show Raw
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={generateReport}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {!hasGenerated && !isGenerating && !error && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto text-purple-500/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Generate AI Analysis</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Get an AI-powered performance assessment including strengths, areas for development,
              and actionable next steps.
            </p>
            <Button onClick={generateReport}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        )}

        {/* Loading indicator */}
        {isGenerating && !error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 mb-4">
            <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            <span className="text-purple-700 dark:text-purple-300 font-medium">
              Analyzing member performance...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={generateReport}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Metrics visualizations - show as soon as metrics arrive */}
        {metrics && !error && (
          <div className="space-y-6 mb-6">
            {/* Critical: Overdue Tasks Warning */}
            {metrics.tasks.overdue > 0 && (
              <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">
                    {metrics.tasks.overdue} Overdue Task{metrics.tasks.overdue !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Tasks past their deadline require immediate attention
                  </p>
                </div>
              </div>
            )}

            {/* Hero Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Tenure"
                value={formatTenure(metrics.tenure.days)}
                icon={Calendar}
                color="purple"
              />
              <StatCard
                label="Tasks Completed"
                value={metrics.tasks.completed}
                subValue={metrics.tasks.overdue > 0 ? `⚠️ ${metrics.tasks.overdue} overdue` : metrics.tasks.active > 0 ? `${metrics.tasks.active} active` : undefined}
                icon={CheckCircle2}
                color={metrics.tasks.overdue > 0 ? 'red' : 'green'}
              />
              <StatCard
                label="On-Time Rate"
                value={`${metrics.onTimeRate}%`}
                icon={Clock}
                color={metrics.onTimeRate >= 80 ? 'green' : metrics.onTimeRate >= 50 ? 'orange' : 'red'}
              />
              <StatCard
                label="Communication"
                value={`${metrics.communicationScore}%`}
                subValue={metrics.extensions.total > 0 ? `${metrics.extensions.total} extensions` : 'No extensions'}
                icon={MessageSquare}
                color={metrics.communicationScore >= 80 ? 'green' : metrics.communicationScore >= 50 ? 'orange' : 'red'}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Communication Breakdown */}
              <Card className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Extension Requests
                </h4>
                <CommunicationChart
                  proactive={metrics.extensions.proactive}
                  late={metrics.extensions.late}
                />
              </Card>

              {/* Activity Trend */}
              <Card className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Task Completion Trend
                </h4>
                <ActivityTrendChart periods={metrics.multiPeriod} />
              </Card>
            </div>

            {/* Score Bars */}
            <Card className="p-4">
              <h4 className="text-sm font-medium mb-4">Performance Scores</h4>
              <div className="space-y-4">
                <ScoreBar
                  label="On-Time Completion"
                  value={metrics.onTimeRate}
                  color={metrics.onTimeRate >= 80 ? 'green' : metrics.onTimeRate >= 50 ? 'orange' : 'red'}
                />
                <ScoreBar
                  label="Communication (Proactive Extensions)"
                  value={metrics.communicationScore}
                  color={metrics.communicationScore >= 80 ? 'green' : metrics.communicationScore >= 50 ? 'orange' : 'red'}
                />
              </div>
            </Card>
          </div>
        )}

        {/* AI Generated Content */}
        {(isGenerating || hasGenerated) && !error && report && (
          <div className="space-y-4">
            {/* Raw output view */}
            {showRaw && !isGenerating && (
              <div className="rounded-lg border bg-muted/30 p-4 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">{report}</pre>
              </div>
            )}

            {/* Formatted view */}
            {!showRaw && (
              <>
                {/* Executive Summary */}
                {executiveSummary && (
                  <div className="rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                        <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                        {executiveSummary.title}
                      </h3>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-base prose-p:leading-relaxed">
                      <ReactMarkdown>{executiveSummary.content}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Other Sections */}
                {otherSections.map((section, index) => renderSection(section, index))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
