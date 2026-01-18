'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ArrowRight, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExtensionEnrichmentInline } from '@/components/extension-enrichment-badge';
import {
  AVOIDABILITY_OPTIONS,
  ROOT_CAUSE_OPTIONS,
  getAvoidabilityColorClasses,
  getAvoidabilityByWeight,
  type AvoidabilityType,
  type RootCauseType,
  type ExtensionEnrichmentEvent,
} from '@/lib/extension-enrichment-types';
import type { ExtensionRequestWithUser } from '@/lib/extension-requests-cache';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(timestamp: number | undefined, isSeconds = true): string {
  if (!timestamp) return 'N/A';
  try {
    const ms = isSeconds && timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    return format(new Date(ms), 'MMM d');
  } catch {
    return 'N/A';
  }
}

function getDaysDiff(oldEndsOn: number, newEndsOn: number): number {
  try {
    const oldDate = new Date(oldEndsOn * 1000);
    const newDate = new Date(newEndsOn * 1000);
    return differenceInDays(newDate, oldDate);
  } catch {
    return 0;
  }
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

/** Weight label for grouping */
const WEIGHT_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Unavoidable', color: 'text-gray-600 dark:text-gray-400' },
  1: { label: 'Partially Avoidable', color: 'text-yellow-600 dark:text-yellow-400' },
  2: { label: 'Avoidable', color: 'text-orange-600 dark:text-orange-400' },
  3: { label: 'Clearly Avoidable', color: 'text-red-600 dark:text-red-400' },
};

// =============================================================================
// Component
// =============================================================================

interface ExtensionEnrichmentBulkProps {
  extensionRequests: ExtensionRequestWithUser[];
}

export function ExtensionEnrichmentBulk({ extensionRequests }: ExtensionEnrichmentBulkProps) {
  const [enrichments, setEnrichments] = useState<Record<string, ExtensionEnrichmentEvent>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showOnlyUnenriched, setShowOnlyUnenriched] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    succeeded: number;
    failed: number;
  } | null>(null);

  // Form state
  const [selectedAvoidabilities, setSelectedAvoidabilities] = useState<AvoidabilityType[]>([]);
  const [selectedRootCauses, setSelectedRootCauses] = useState<RootCauseType[]>([]);
  const [notes, setNotes] = useState('');

  // AI suggestion state
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [aiReasoning, setAiReasoning] = useState('');

  // Fetch enrichments
  useEffect(() => {
    if (extensionRequests.length === 0) return;

    const extensionIds = extensionRequests.map((er) => er.id).join(',');
    fetch(`/api/extension-enrichment?extensionIds=${extensionIds}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.enrichments) {
          setEnrichments(data.enrichments);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch extension enrichments:', err);
      });
  }, [extensionRequests]);

  // Filter requests based on enrichment status
  const filteredRequests = useMemo(() => {
    if (!showOnlyUnenriched) return extensionRequests;
    return extensionRequests.filter((er) => !enrichments[er.id]);
  }, [extensionRequests, enrichments, showOnlyUnenriched]);

  // Count stats
  const enrichedCount = Object.keys(enrichments).length;
  const unenrichedCount = extensionRequests.length - enrichedCount;

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredRequests.map((er) => er.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const openBulkDialog = () => {
    setSelectedAvoidabilities([]);
    setSelectedRootCauses([]);
    setNotes('');
    setSubmitResult(null);
    setAiApplied(false);
    setAiReasoning('');
    setIsDialogOpen(true);
  };

  // Get first selected extension for AI suggestion
  const firstSelectedExtension = useMemo(() => {
    const firstId = Array.from(selectedIds)[0];
    return extensionRequests.find((er) => er.id === firstId);
  }, [selectedIds, extensionRequests]);

  const fetchAISuggestion = async () => {
    if (!firstSelectedExtension?.reason) return;

    setIsLoadingAI(true);
    try {
      const daysExtended = getDaysDiff(firstSelectedExtension.oldEndsOn, firstSelectedExtension.newEndsOn);
      const user = firstSelectedExtension.assigneeUser;
      const assigneeName = user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name}`
        : user?.username;

      const response = await fetch('/api/ai/extension-enrichment-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: firstSelectedExtension.taskTitle || firstSelectedExtension.title || 'Unknown Task',
          reason: firstSelectedExtension.reason,
          assigneeName,
          daysExtended,
        }),
      });

      if (response.ok) {
        const suggestion = await response.json();
        setSelectedAvoidabilities(suggestion.avoidabilities || []);
        setSelectedRootCauses(suggestion.rootCauses || []);
        setAiReasoning(suggestion.reasoning || '');
        setAiApplied(true);
      }
    } catch (err) {
      console.error('Failed to fetch AI suggestion:', err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const toggleAvoidability = (avoidability: AvoidabilityType) => {
    setSelectedAvoidabilities((prev) =>
      prev.includes(avoidability)
        ? prev.filter((a) => a !== avoidability)
        : [...prev, avoidability]
    );
  };

  const toggleRootCause = (rootCause: RootCauseType) => {
    setSelectedRootCauses((prev) =>
      prev.includes(rootCause)
        ? prev.filter((r) => r !== rootCause)
        : [...prev, rootCause]
    );
  };

  const handleBulkSubmit = async () => {
    if (selectedAvoidabilities.length === 0 || selectedRootCauses.length === 0 || selectedIds.size === 0) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Build items array
      const items = Array.from(selectedIds).map((extensionId) => {
        const er = extensionRequests.find((r) => r.id === extensionId)!;
        return {
          extensionId,
          taskId: er.taskId,
          userId: er.assignee,
          avoidabilities: selectedAvoidabilities,
          rootCauses: selectedRootCauses,
          notes: notes.trim() || undefined,
        };
      });

      const response = await fetch('/api/extension-enrichment/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save enrichments');
      }

      setSubmitResult({
        succeeded: data.summary.succeeded,
        failed: data.summary.failed,
      });

      // Update local enrichment state
      if (data.results) {
        const newEnrichments: Record<string, ExtensionEnrichmentEvent> = {};
        const maxWeight = Math.max(...selectedAvoidabilities.map(a => AVOIDABILITY_OPTIONS[a].weight));
        for (const result of data.results) {
          if (result.success && result.eventId) {
            const er = extensionRequests.find((r) => r.id === result.extensionId);
            if (er) {
              newEnrichments[result.extensionId] = {
                id: result.eventId,
                meta: { type: 'extension_enrichment', by: '', target: 'extension' },
                targetId: result.extensionId,
                taskId: er.taskId,
                userId: er.assignee,
                avoidabilities: selectedAvoidabilities,
                avoidabilityCount: selectedAvoidabilities.length,
                maxAvoidabilityWeight: maxWeight,
                rootCauses: selectedRootCauses,
                rootCauseCount: selectedRootCauses.length,
                flags: {
                  repeatOffender: false,
                  sameTaskRepeat: false,
                  shortInterval: false,
                  significantDelay: false,
                },
                timestamp: Date.now(),
              };
            }
          }
        }
        setEnrichments((prev) => ({ ...prev, ...newEnrichments }));
      }

      // Clear selection for succeeded items
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk enrichment error:', err);
      setSubmitResult({ succeeded: 0, failed: selectedIds.size });
    } finally {
      setIsSubmitting(false);
    }
  };

  const avoidabilityByWeight = getAvoidabilityByWeight();
  const canSubmit = selectedAvoidabilities.length > 0 && selectedRootCauses.length > 0;

  return (
    <div className="space-y-4">
      {/* Stats and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-4 text-sm">
          <span>
            Total: <strong>{extensionRequests.length}</strong>
          </span>
          <span>
            Enriched: <strong className="text-green-600">{enrichedCount}</strong>
          </span>
          <span>
            Not enriched: <strong className="text-orange-600">{unenrichedCount}</strong>
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={showOnlyUnenriched}
            onCheckedChange={(checked) => setShowOnlyUnenriched(!!checked)}
          />
          <span className="text-sm">Show only not enriched</span>
        </label>
      </div>

      {/* Selection Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All ({filteredRequests.length})
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone}>
            Select None
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            {selectedIds.size} selected
          </span>
        </div>
        <Button
          onClick={openBulkDialog}
          disabled={selectedIds.size === 0}
        >
          Apply Enrichment to {selectedIds.size} Selected
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredRequests.length > 0 &&
                    filteredRequests.every((er) => selectedIds.has(er.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectAll();
                    } else {
                      selectNone();
                    }
                  }}
                />
              </TableHead>
              <TableHead style={{ width: 220 }}>Task</TableHead>
              <TableHead style={{ width: 160 }}>Assignee</TableHead>
              <TableHead style={{ width: 160 }}>ETA Change</TableHead>
              <TableHead style={{ width: 150 }}>Enrichment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {showOnlyUnenriched
                    ? 'All extension requests have been enriched!'
                    : 'No extension requests found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const user = request.assigneeUser;
                const daysDiff = getDaysDiff(request.oldEndsOn, request.newEndsOn);
                const isSelected = selectedIds.has(request.id);
                const enrichment = enrichments[request.id];

                return (
                  <TableRow
                    key={request.id}
                    className={isSelected ? 'bg-primary/5' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(request.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium line-clamp-1">
                        {request.taskTitle || request.title || 'Unknown Task'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user?.picture?.url} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user?.first_name, user?.last_name, user?.username)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">
                          {user?.first_name && user?.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user?.username || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {formatDate(request.oldEndsOn)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span>{formatDate(request.newEndsOn)}</span>
                        {daysDiff > 0 && (
                          <span className="text-xs text-orange-600 dark:text-orange-400">
                            +{daysDiff}d
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ExtensionEnrichmentInline enrichment={enrichment} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Enrichment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply Enrichment to {selectedIds.size} Requests</DialogTitle>
            <DialogDescription>
              This enrichment will be applied to all selected extension requests.
            </DialogDescription>
          </DialogHeader>

          {/* Success/Error Result */}
          {submitResult && (
            <div
              className={`rounded-lg border p-4 ${
                submitResult.failed === 0
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20'
                  : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {submitResult.failed === 0 ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {submitResult.succeeded} enriched successfully
                  {submitResult.failed > 0 && `, ${submitResult.failed} failed`}
                </span>
              </div>
            </div>
          )}

          {!submitResult && (
            <div className="space-y-6">
              {/* AI Suggestion Section */}
              {firstSelectedExtension?.reason && (
                <div className="space-y-3">
                  {/* First item context */}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      First Selected: {firstSelectedExtension.taskTitle || firstSelectedExtension.title}
                    </p>
                    <p className="text-sm line-clamp-2">{firstSelectedExtension.reason}</p>
                  </div>

                  {/* AI Button or Result */}
                  {!aiApplied ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchAISuggestion}
                      disabled={isLoadingAI}
                      className="w-full"
                    >
                      {isLoadingAI ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Analyzing first item...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Get AI Suggestion from First Item
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-start gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-primary">AI Suggestions Applied</span>
                        {aiReasoning && (
                          <p className="text-xs text-muted-foreground">{aiReasoning}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Avoidability - Multi-select */}
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Avoidability Factors <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select all factors that apply to these extension requests
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
                  {[0, 1, 2, 3].map((weight) => {
                    const options = avoidabilityByWeight[weight];
                    if (options.length === 0) return null;
                    const weightInfo = WEIGHT_LABELS[weight];
                    const selectedCount = options.filter((opt) => selectedAvoidabilities.includes(opt)).length;

                    return (
                      <div key={weight} className="space-y-1">
                        <p className={`text-sm font-medium ${weightInfo.color}`}>
                          {weightInfo.label}
                          {selectedCount > 0 && (
                            <span className="ml-2 text-xs text-primary">({selectedCount} selected)</span>
                          )}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {options.map((key) => {
                            const option = AVOIDABILITY_OPTIONS[key];
                            const isSelected = selectedAvoidabilities.includes(key);
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleAvoidability(key)}
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Root Causes - Multi-select */}
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Root Causes <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select all root causes that apply to these extension requests
                </p>

                {/* Selected root causes preview */}
                {selectedRootCauses.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                    {selectedRootCauses.map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        onClick={() => toggleRootCause(key)}
                      >
                        {ROOT_CAUSE_OPTIONS[key].label}
                        <span className="text-current/70">×</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROOT_CAUSE_OPTIONS).map(([key, option]) => {
                    const isSelected = selectedRootCauses.includes(key as RootCauseType);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRootCause(key as RootCauseType)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="bulk-notes" className="text-base font-medium">
                  Notes (Optional)
                </Label>
                <textarea
                  id="bulk-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context for all selected items..."
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  rows={2}
                />
              </div>

              {/* Preview */}
              {canSubmit && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Will Apply
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
                    {selectedRootCauses.map((key) => (
                      <span
                        key={key}
                        className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      >
                        {ROOT_CAUSE_OPTIONS[key].label}
                      </span>
                    ))}
                    <span className="text-muted-foreground">
                      to {selectedIds.size} extension{selectedIds.size !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkSubmit}
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Applying...
                    </>
                  ) : (
                    `Apply to ${selectedIds.size} Selected`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Close after success */}
          {submitResult && submitResult.failed === 0 && (
            <div className="flex justify-end">
              <Button onClick={() => setIsDialogOpen(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
