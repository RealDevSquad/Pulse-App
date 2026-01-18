'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  getAvoidabilityColorClasses,
  getAvoidabilityByWeight,
  type AvoidabilityType,
  type RootCauseType,
  type ExtensionEnrichmentEvent,
  type AutoComputedFlags,
} from '@/lib/extension-enrichment-types';
import {
  Loader2,
  CheckCircle,
  Tags,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface AISuggestion {
  avoidabilities: AvoidabilityType[];
  rootCause: RootCauseType;
  reasoning: string;
}

interface ExtensionEnrichmentDialogProps {
  extensionId: string;
  taskId: string;
  userId: string;
  taskTitle: string;
  assigneeName?: string;
  /** Date change info for context */
  oldEndsOn?: number;
  newEndsOn?: number;
  /** Extension reason for context */
  reason?: string;
  /** Pre-computed flags (if available) */
  preComputedFlags?: Partial<AutoComputedFlags>;
  existingEnrichment?: ExtensionEnrichmentEvent | null;
  onEnrichmentSaved?: (enrichment: ExtensionEnrichmentEvent) => void;
  trigger?: React.ReactNode;
}

/** Weight label for grouping */
const WEIGHT_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Unavoidable', color: 'text-gray-600 dark:text-gray-400' },
  1: { label: 'Partially Avoidable', color: 'text-yellow-600 dark:text-yellow-400' },
  2: { label: 'Avoidable', color: 'text-orange-600 dark:text-orange-400' },
  3: { label: 'Clearly Avoidable', color: 'text-red-600 dark:text-red-400' },
};

export function ExtensionEnrichmentDialog({
  extensionId,
  taskId,
  userId,
  taskTitle,
  assigneeName,
  oldEndsOn,
  newEndsOn,
  reason,
  preComputedFlags,
  existingEnrichment,
  onEnrichmentSaved,
  trigger,
}: ExtensionEnrichmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedAvoidabilities, setSelectedAvoidabilities] = useState<AvoidabilityType[]>(
    existingEnrichment?.avoidabilities || []
  );
  const [rootCause, setRootCause] = useState<RootCauseType | ''>(
    existingEnrichment?.rootCause || ''
  );
  const [notes, setNotes] = useState(existingEnrichment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapse state for avoidability groups
  const [expandedWeights, setExpandedWeights] = useState<Set<number>>(
    new Set([0, 1, 2, 3]) // All expanded by default
  );

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  // Fetch AI suggestions when dialog opens (only if no existing enrichment and has reason)
  useEffect(() => {
    if (open && !existingEnrichment && reason && !aiSuggestion && !isLoadingSuggestion) {
      fetchAISuggestion();
    }
  }, [open, existingEnrichment, reason, aiSuggestion, isLoadingSuggestion]);

  async function fetchAISuggestion() {
    if (!reason) return;

    setIsLoadingSuggestion(true);
    try {
      const response = await fetch('/api/ai/extension-enrichment-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle,
          reason,
          assigneeName,
          daysExtended,
        }),
      });

      if (response.ok) {
        const suggestion = await response.json();
        setAiSuggestion(suggestion);

        // Auto-apply suggestions if form is empty
        if (selectedAvoidabilities.length === 0 && !rootCause) {
          applySuggestion(suggestion);
        }
      }
    } catch (err) {
      console.error('Failed to fetch AI suggestion:', err);
    } finally {
      setIsLoadingSuggestion(false);
    }
  }

  function applySuggestion(suggestion: AISuggestion) {
    setSelectedAvoidabilities(suggestion.avoidabilities);
    setRootCause(suggestion.rootCause);
    setSuggestionApplied(true);

    // Expand the weight groups containing the suggested avoidabilities
    const weights = suggestion.avoidabilities.map(a => AVOIDABILITY_OPTIONS[a].weight);
    setExpandedWeights((prev) => new Set([...prev, ...weights]));
  }

  const toggleAvoidability = useCallback((avoidability: AvoidabilityType) => {
    setSelectedAvoidabilities((prev) =>
      prev.includes(avoidability)
        ? prev.filter((a) => a !== avoidability)
        : [...prev, avoidability]
    );
  }, []);

  const canSubmit = selectedAvoidabilities.length > 0 && rootCause !== '';

  // Group avoidability options by weight
  const avoidabilityByWeight = getAvoidabilityByWeight();

  // Calculate days extended
  const daysExtended =
    oldEndsOn && newEndsOn ? Math.round((newEndsOn - oldEndsOn) / (24 * 60 * 60)) : null;

  const toggleWeight = useCallback((weight: number) => {
    setExpandedWeights((prev) => {
      const next = new Set(prev);
      if (next.has(weight)) {
        next.delete(weight);
      } else {
        next.add(weight);
      }
      return next;
    });
  }, []);

  const resetForm = useCallback(() => {
    setSelectedAvoidabilities(existingEnrichment?.avoidabilities || []);
    setRootCause(existingEnrichment?.rootCause || '');
    setNotes(existingEnrichment?.notes || '');
    setError(null);
    setSubmitSuccess(false);
    // Reset AI suggestion state so it fetches again next time
    setAiSuggestion(null);
    setSuggestionApplied(false);
  }, [existingEnrichment]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/extension-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionId,
          taskId,
          userId,
          avoidabilities: selectedAvoidabilities,
          rootCause,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save enrichment');
      }

      const data = await response.json();
      setSubmitSuccess(true);

      if (onEnrichmentSaved) {
        onEnrichmentSaved(data.enrichment);
      }

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false);
        setSubmitSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Tags className="h-4 w-4 mr-1" />
            {existingEnrichment ? 'Edit Enrichment' : 'Enrich'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingEnrichment ? 'Edit Extension Enrichment' : 'Enrich Extension Request'}
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block break-words">{taskTitle}</span>
            {assigneeName && (
              <span className="block text-xs">
                {assigneeName}
                {daysExtended !== null && ` • +${daysExtended} days`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Context: Extension Reason */}
        {reason && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Extension Reason
            </p>
            <p className="text-sm">{reason}</p>
          </div>
        )}

        {/* AI Suggestion Indicator */}
        {isLoadingSuggestion && (
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              AI is analyzing the extension reason...
            </span>
          </div>
        )}

        {suggestionApplied && aiSuggestion?.reasoning && (
          <div className="flex items-start gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-sm font-medium text-primary">AI Suggestions Applied</span>
              <p className="text-xs text-muted-foreground">{aiSuggestion.reasoning}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avoidability Assessment - Multi-select */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Avoidability Factors <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select all factors that contributed to needing this extension
            </p>

            {/* Selected factors preview */}
            {selectedAvoidabilities.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                {selectedAvoidabilities.map((key) => (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${getAvoidabilityColorClasses(key)}`}
                    onClick={() => toggleAvoidability(key)}
                  >
                    {AVOIDABILITY_OPTIONS[key].label}
                    <span className="text-current/70">×</span>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {/* Group by weight */}
              {[0, 1, 2, 3].map((weight) => {
                const options = avoidabilityByWeight[weight];
                if (options.length === 0) return null;

                const weightInfo = WEIGHT_LABELS[weight];
                const selectedCount = options.filter((opt) => selectedAvoidabilities.includes(opt)).length;

                return (
                  <div key={weight} className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleWeight(weight)}
                      className={`flex items-center gap-2 w-full p-3 text-left hover:bg-muted/50 rounded-t-lg ${
                        selectedCount > 0 ? 'bg-primary/5' : ''
                      }`}
                    >
                      {expandedWeights.has(weight) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={`font-medium ${weightInfo.color}`}>
                        {weightInfo.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({options.length} option{options.length !== 1 ? 's' : ''})
                      </span>
                      {selectedCount > 0 && (
                        <span className="ml-auto text-xs font-medium text-primary">
                          {selectedCount} selected
                        </span>
                      )}
                    </button>

                    {expandedWeights.has(weight) && (
                      <div className="p-3 pt-0 space-y-2">
                        {options.map((key) => {
                          const option = AVOIDABILITY_OPTIONS[key];
                          const isSelected = selectedAvoidabilities.includes(key);
                          return (
                            <label
                              key={key}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleAvoidability(key)}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <span className="font-medium">{option.label}</span>
                                <p className="text-sm text-muted-foreground">
                                  {option.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Root Cause */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Root Cause <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              What was the primary cause of this extension?
            </p>

            <RadioGroup
              value={rootCause}
              onValueChange={(value: string) => setRootCause(value as RootCauseType)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {Object.entries(ROOT_CAUSE_OPTIONS).map(([key, option]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    rootCause === key
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <RadioGroupItem value={key} className="mt-0.5" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{option.label}</span>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Auto-Computed Flags (read-only) */}
          {preComputedFlags && Object.values(preComputedFlags).some(Boolean) && (
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Auto-Detected Patterns
              </Label>
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3">
                <ul className="space-y-1 text-sm">
                  {preComputedFlags.repeatOffender && (
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Repeat Offender (3+ extensions in 30 days)</span>
                    </li>
                  )}
                  {preComputedFlags.sameTaskRepeat && (
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>Same Task Repeat (multiple extensions on this task)</span>
                    </li>
                  )}
                  {preComputedFlags.shortInterval && (
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Short Interval (requested within 3 days of deadline)</span>
                    </li>
                  )}
                  {preComputedFlags.significantDelay && (
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>Significant Delay (extending by 7+ days)</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base font-medium">
              Additional Context (Optional)
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context for AI analysis..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              rows={3}
            />
          </div>

          {/* Preview Panel */}
          {canSubmit && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Enrichment Summary
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {selectedAvoidabilities.map((key) => (
                  <span
                    key={key}
                    className={`px-2 py-1 rounded ${getAvoidabilityColorClasses(key)}`}
                  >
                    {AVOIDABILITY_OPTIONS[key].label}
                  </span>
                ))}
                <span className="text-muted-foreground">•</span>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {ROOT_CAUSE_OPTIONS[rootCause as RootCauseType].label}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
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
                'Save Enrichment'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
