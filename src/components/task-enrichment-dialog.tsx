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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  SKILL_CATEGORIES,
  COMPLEXITY_LEVELS,
  getSkillColorClasses,
  getComplexityColorClasses,
  calculateTaskScore,
  type ComplexityLevel,
  type TaskEnrichmentEvent,
} from '@/lib/task-enrichment-types';
import {
  Loader2,
  CheckCircle,
  X,
  Plus,
  Tags,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface AISuggestion {
  skills: string[];
  complexity: ComplexityLevel;
  unknownFactors: string[];
  reasoning: string;
}

interface TaskEnrichmentDialogProps {
  taskId: string;
  taskTitle: string;
  /** Optional task metadata for better AI suggestions */
  taskType?: string;
  taskStatus?: string;
  taskPriority?: string;
  existingEnrichment?: TaskEnrichmentEvent | null;
  onEnrichmentSaved?: (enrichment: TaskEnrichmentEvent) => void;
  trigger?: React.ReactNode;
}

export function TaskEnrichmentDialog({
  taskId,
  taskTitle,
  taskType,
  taskStatus,
  taskPriority,
  existingEnrichment,
  onEnrichmentSaved,
  trigger,
}: TaskEnrichmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    existingEnrichment?.skills || []
  );
  const [complexity, setComplexity] = useState<ComplexityLevel | ''>(
    existingEnrichment?.complexity || ''
  );
  const [unknownFactors, setUnknownFactors] = useState<string[]>(
    existingEnrichment?.unknownFactors ?? []
  );
  const [newFactor, setNewFactor] = useState('');
  const [notes, setNotes] = useState(existingEnrichment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['frontend', 'backend', 'database'])
  );

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  // Fetch AI suggestions when dialog opens (only if no existing enrichment)
  useEffect(() => {
    if (open && !existingEnrichment && !aiSuggestion && !isLoadingSuggestion) {
      fetchAISuggestion();
    }
  }, [open, existingEnrichment, aiSuggestion, isLoadingSuggestion]);

  async function fetchAISuggestion() {
    setIsLoadingSuggestion(true);
    try {
      const response = await fetch('/api/ai/task-enrichment-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          type: taskType,
          status: taskStatus,
          priority: taskPriority,
        }),
      });

      if (response.ok) {
        const suggestion = await response.json();
        setAiSuggestion(suggestion);

        // Auto-apply suggestions if form is empty
        if (selectedSkills.length === 0 && !complexity) {
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
    setSelectedSkills(suggestion.skills);
    setComplexity(suggestion.complexity);
    setUnknownFactors(suggestion.unknownFactors);
    setSuggestionApplied(true);

    // Expand categories that have suggested skills
    const categoriesToExpand = new Set<string>();
    for (const [categoryKey, category] of Object.entries(SKILL_CATEGORIES)) {
      if (suggestion.skills.some(s => (category.skills as readonly string[]).includes(s))) {
        categoriesToExpand.add(categoryKey);
      }
    }
    if (categoriesToExpand.size > 0) {
      setExpandedCategories(categoriesToExpand);
    }
  }

  const canSubmit = selectedSkills.length > 0 && complexity !== '';

  const toggleSkill = useCallback((skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const addUnknownFactor = useCallback(() => {
    if (newFactor.trim()) {
      setUnknownFactors((prev) => [...prev, newFactor.trim()]);
      setNewFactor('');
    }
  }, [newFactor]);

  const removeUnknownFactor = useCallback((index: number) => {
    setUnknownFactors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetForm = useCallback(() => {
    setSelectedSkills(existingEnrichment?.skills || []);
    setComplexity(existingEnrichment?.complexity || '');
    setUnknownFactors(existingEnrichment?.unknownFactors || []);
    setNotes(existingEnrichment?.notes || '');
    setNewFactor('');
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
      const response = await fetch('/api/task-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          skills: selectedSkills,
          complexity,
          unknownFactors: unknownFactors.length > 0 ? unknownFactors : undefined,
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
            {existingEnrichment ? 'Edit Enrichment' : 'Enrich Task'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingEnrichment ? 'Edit Task Enrichment' : 'Enrich Task'}
          </DialogTitle>
          <DialogDescription className="break-words">
            Add metadata to &quot;{taskTitle}&quot; for accurate productivity scoring.
          </DialogDescription>
        </DialogHeader>

        {/* AI Suggestion Indicator */}
        {isLoadingSuggestion && (
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              AI is analyzing the task...
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
          {/* Skills Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Skills Required <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select the skills needed to complete this task
            </p>

            {/* Selected skills preview */}
            {selectedSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                {selectedSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className={`${getSkillColorClasses(skill)} cursor-pointer`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Skill categories */}
            <div className="space-y-2 border rounded-lg p-3">
              {Object.entries(SKILL_CATEGORIES).map(([categoryKey, category]) => (
                <div key={categoryKey} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleCategory(categoryKey)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full"
                  >
                    {expandedCategories.has(categoryKey) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {category.label}
                    {selectedSkills.filter((s) => (category.skills as readonly string[]).includes(s)).length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {selectedSkills.filter((s) => (category.skills as readonly string[]).includes(s)).length}
                      </Badge>
                    )}
                  </button>

                  {expandedCategories.has(categoryKey) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-6">
                      {category.skills.map((skill) => (
                        <label
                          key={skill}
                          className="flex items-center gap-2 cursor-pointer py-1"
                        >
                          <Checkbox
                            checked={selectedSkills.includes(skill)}
                            onCheckedChange={() => toggleSkill(skill)}
                          />
                          <span className="text-sm">{skill}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Complexity Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Complexity Level <span className="text-red-500">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Select the complexity that best matches this task
            </p>

            <RadioGroup
              value={complexity}
              onValueChange={(value: string) => setComplexity(value as ComplexityLevel)}
              className="space-y-2"
            >
              {Object.entries(COMPLEXITY_LEVELS).map(([key, level]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    complexity === key
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <RadioGroupItem value={key} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${getComplexityColorClasses(key as ComplexityLevel)}`}>
                        {level.label}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {level.weight}x
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{level.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Unknown Factors */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Unknown Factors</Label>
            <p className="text-sm text-muted-foreground">
              List any unknowns, dependencies, or risks (optional)
            </p>

            {unknownFactors.length > 0 && (
              <ul className="space-y-2">
                {unknownFactors.map((factor, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
                  >
                    <span className="flex-1 text-sm">{factor}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUnknownFactor(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newFactor}
                onChange={(e) => setNewFactor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addUnknownFactor();
                  }
                }}
                placeholder="Add unknown factor..."
                className="flex-1 h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUnknownFactor}
                disabled={!newFactor.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base font-medium">
              Additional Notes
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context, considerations, or observations... (optional)"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              rows={3}
            />
          </div>

          {/* Preview Panel */}
          {canSubmit && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <span>Productivity Impact Preview</span>
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  Base Score: <strong>1.0</strong>
                </span>
                <span>
                  Complexity Multiplier:{' '}
                  <strong className={getComplexityColorClasses(complexity as ComplexityLevel)}>
                    {COMPLEXITY_LEVELS[complexity as ComplexityLevel].weight}x
                  </strong>
                </span>
                <span>
                  Final Score:{' '}
                  <strong>{calculateTaskScore(complexity as ComplexityLevel)} points</strong>
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
