'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ENRICHMENT_TYPES,
  ENRICHMENT_CATEGORIES,
  type EnrichmentType,
  type EnrichmentCategory,
} from '@/lib/enrichment-types';
import { MessageSquare, Target, Award, Handshake, Loader2, CheckCircle } from 'lucide-react';

const ICON_MAP = {
  MessageSquare,
  Target,
  Award,
  Handshake,
} as const;

interface MemberEnrichmentFormProps {
  targetUserId: string;
  memberName: string;
}

export function MemberEnrichmentForm({ targetUserId, memberName }: MemberEnrichmentFormProps) {
  const router = useRouter();
  const [enrichmentType, setEnrichmentType] = useState<EnrichmentType | ''>('');
  const [category, setCategory] = useState<EnrichmentCategory | ''>('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = enrichmentType && category && text.trim().length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/member-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          enrichmentType,
          content: {
            text: text.trim(),
            category,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save enrichment');
      }

      setSubmitSuccess(true);

      // Reset form after a short delay
      setTimeout(() => {
        setText('');
        setEnrichmentType('');
        setCategory('');
        setSubmitSuccess(false);
      }, 2000);

      // Refresh the page data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">Add Enrichment Note</CardTitle>
        <CardDescription>
          Add context, goals, or observations about {memberName}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type and Category Selection - side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Enrichment Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="enrichment-type">Type of Note</Label>
              <Select
                value={enrichmentType}
                onValueChange={(value) => setEnrichmentType(value as EnrichmentType)}
              >
                <SelectTrigger id="enrichment-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ENRICHMENT_TYPES) as [EnrichmentType, typeof ENRICHMENT_TYPES[EnrichmentType]][]).map(
                    ([key, info]) => {
                      const IconComponent = ICON_MAP[info.icon as keyof typeof ICON_MAP];
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {IconComponent && <IconComponent className="h-4 w-4" />}
                            <span>{info.label}</span>
                          </div>
                        </SelectItem>
                      );
                    }
                  )}
                </SelectContent>
              </Select>
              {enrichmentType && (
                <p className="text-xs text-muted-foreground">
                  {ENRICHMENT_TYPES[enrichmentType].description}
                </p>
              )}
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as EnrichmentCategory)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ENRICHMENT_CATEGORIES) as [EnrichmentCategory, typeof ENRICHMENT_CATEGORIES[EnrichmentCategory]][]).map(
                    ([key, info]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full`}
                            style={{
                              backgroundColor:
                                key === 'mentorship'
                                  ? '#3b82f6'
                                  : key === 'blocker'
                                    ? '#ef4444'
                                    : key === 'growth'
                                      ? '#22c55e'
                                      : '#eab308',
                            }}
                          />
                          <span>{info.label}</span>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Note Content</Label>
            <textarea
              id="content"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add your observations, context, or notes..."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              {text.length} characters (minimum 10 required)
            </p>
          </div>

          {/* Preview */}
          {enrichmentType && category && text.trim() && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{ENRICHMENT_TYPES[enrichmentType].label}</Badge>
                <Badge
                  variant="outline"
                  className={`${ENRICHMENT_CATEGORIES[category].bgClass} ${ENRICHMENT_CATEGORIES[category].textClass} ${ENRICHMENT_CATEGORIES[category].borderClass}`}
                >
                  {ENRICHMENT_CATEGORIES[category].label}
                </Badge>
              </div>
              <p className="text-sm">{text.trim()}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : submitSuccess ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                'Save Enrichment Note'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
