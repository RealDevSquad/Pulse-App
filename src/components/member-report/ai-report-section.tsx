'use client';

import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

interface AIReportSectionProps {
  userId: string;
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
    // Check for ## headers (main sections)
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
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

  // Save last section
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
  if (lower.includes('development') || lower.includes('improvement')) return Target;
  if (lower.includes('next steps') || lower.includes('recommended')) return Lightbulb;
  if (lower.includes('risk') || lower.includes('flag')) return AlertTriangle;
  return Activity;
}

function getSectionVariant(title: string): 'default' | 'success' | 'warning' | 'destructive' {
  const lower = title.toLowerCase();
  if (lower.includes('strength')) return 'success';
  if (lower.includes('risk') || lower.includes('flag')) return 'destructive';
  if (lower.includes('development') || lower.includes('improvement')) return 'warning';
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

function getTrendBadgeVariant(
  content: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const lower = content.toLowerCase();
  if (lower.includes('improved') || lower.includes('improving')) return 'default';
  if (lower.includes('declined') || lower.includes('declining')) return 'destructive';
  return 'secondary';
}

export function AIReportSection({ userId }: AIReportSectionProps) {
  const [report, setReport] = useState<string>('');
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

        // Process SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
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

        {/* Single render path for both streaming and completed states */}
        {(isGenerating || hasGenerated) && !error && report && (
          <div className="space-y-4">
            {/* Loading indicator shown during streaming */}
            {isGenerating && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span className="text-purple-700 dark:text-purple-300 font-medium">Analyzing member performance...</span>
              </div>
            )}

            {/* Raw output view */}
            {showRaw && !isGenerating && (
              <div className="rounded-lg border bg-muted/30 p-4 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">{report}</pre>
              </div>
            )}

            {/* Formatted view - Executive Summary - Hero Section */}
            {!showRaw && executiveSummary && (
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

            {/* Other Sections - Always Open Cards */}
            {!showRaw && otherSections.map((section, index) => {
              const Icon = section.icon || Activity;
              const isTrendSection = section.title.toLowerCase().includes('trend');
              const isRiskSection = section.title.toLowerCase().includes('risk');

              return (
                <Card key={index}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`p-2 rounded-lg ${
                          section.variant === 'success'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : section.variant === 'warning'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30'
                              : section.variant === 'destructive'
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            section.variant === 'success'
                              ? 'text-green-600 dark:text-green-400'
                              : section.variant === 'warning'
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : section.variant === 'destructive'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-blue-600 dark:text-blue-400'
                          }`}
                        />
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base">{section.title}</h3>
                    </div>
                    {isTrendSection ? (
                      // Enhanced rendering for trend analysis with badges
                      (() => {
                        // Parse trend items from content
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

                        // If no trend items found, fall back to markdown
                        if (trendItems.length === 0) {
                          return (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-ul:space-y-2 prose-li:text-sm prose-strong:text-foreground">
                              <ReactMarkdown>{section.content}</ReactMarkdown>
                            </div>
                          );
                        }

                        // Render enhanced trend items
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
                    ) : isRiskSection && section.content.toLowerCase().includes('none') ? (
                      // Special rendering for "None identified" risk flags
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <p className="text-sm text-green-700 dark:text-green-300">
                          No immediate concerns identified
                        </p>
                      </div>
                    ) : (
                      // Default markdown rendering with enhanced styling
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-ul:space-y-2 prose-li:text-sm prose-strong:text-foreground">
                        <ReactMarkdown>{section.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
