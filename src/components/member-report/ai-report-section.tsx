'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface AIReportSectionProps {
  userId: string;
}

export function AIReportSection({ userId }: AIReportSectionProps) {
  const [report, setReport] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

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
            <Button variant="outline" size="sm" onClick={generateReport}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
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

        {isGenerating && (
          <div className="py-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing member performance...</span>
            </div>
            {report && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            )}
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

        {hasGenerated && !isGenerating && !error && report && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
