# AI Member Performance Summary

This document explains how the AI-powered member performance summary is calculated in Pulse App.

## Overview

The AI summary analyzes a member's activity, deadline compliance, communication patterns, and enrichment notes to generate a comprehensive performance report. The report is generated via streaming from the `/api/ai/member-analysis` endpoint.

## Data Sources

### 1. User Tasks (`tasks` collection)
- All tasks assigned to the user
- Used to calculate: active tasks, overdue tasks, historical late completions

### 2. Activity Logs (`logs` collection)
- Task-related activity logs
- Used to calculate: tasks assigned, started, completed, task updates
- Also used to determine `activeSince` (first task activity date for accurate tenure)

### 3. Extension Requests (`extensionRequests` collection)
- All extension requests by the user (last 90 days)
- Used to calculate: total extensions, late extensions (requested after deadline)

### 4. Progress Updates (`progresses` collection)
- Progress updates submitted by the user (last 90 days)
- Used to extract: recent blockers, update frequency, days since last update

### 5. Task Requests (`taskRequests` collection)
- Self-initiated task requests (last 90 days)
- Used to calculate: initiative metrics (requests made, approved, denied)

### 6. Enrichment Notes (`pulseAppOnly` collection)
- Superuser notes about the member (`meta.type: 'member_enrichment'`)
- Extension enrichments (`meta.type: 'extension_enrichment'`)
- Task enrichments (`meta.type: 'task_enrichment'`)

## Key Metrics

### Deadline Violations (Critical)

**Total Deadline Violations = Historical Late Completions + Late Extension Requests**

#### Currently Overdue Tasks
Tasks that have passed their `endsOn` deadline and are NOT yet completed.
- Status: RED (critical)
- Requires immediate attention

#### Historical Late Completions
Tasks that were completed AFTER their deadline (`updatedAt > endsOn`).
- Even ONE late completion is flagged as a concern
- Indicates pattern of missing deadlines

#### Late Extension Requests
Extensions requested AFTER the task deadline had passed (`timestamp > oldEndsOn`).
- This means the task was "red" (overdue) before the member asked for help
- Indicates lack of proactive communication

**Important:** ANY deadline violation - whether a task was completed late OR went overdue before getting an extension - is treated seriously. Green flags for "reliability" are only awarded if there are ZERO violations of any type.

### Communication Score

```
communicationScore = (proactiveExtensions / totalExtensions) * 100
```

- **Proactive extensions**: Requested BEFORE the deadline
- **Late extensions**: Requested AFTER the deadline (task was already red)
- Score of 100% if no extensions were needed
- Score < 80% suggests need for coaching on proactive communication

### On-Time Completion Rate

```
onTimeRate = (completedOnTime / totalCompleted) * 100
```

- Based on tasks completed in the last 90 days
- `completedOnTime`: Tasks where `updatedAt <= endsOn`
- `completedLate`: Tasks where `updatedAt > endsOn`

### Timeline Metrics

- **Average days to start**: Time from task assignment to `IN_PROGRESS` status
- **On-time completion rate**: Percentage of tasks completed before deadline

### Initiative Metrics

- **Task requests made**: Self-initiated task requests
- **Approved/Denied**: Approval rate indicates skill alignment

### Weighted Productivity

Tasks are weighted by complexity (from task enrichment):
- Trivial: 1 point
- Simple: 2 points
- Moderate: 3 points
- Complex: 4 points
- Very Complex: 5 points

## Auto-Detected Flags

### Red Flags
1. **Overdue tasks**: `🚨 X OVERDUE task(s) - requires immediate attention`
2. **Deadline violations**: `⚠️ X deadline violation(s): Y completed late, Z went overdue before extension`
3. **No progress updates**: `No progress updates for X days` (if > 14 days)
4. **Low on-time rate**: `Low on-time completion rate (X%)` (if < 50%)

### Green Flags (only if NO deadline violations)
1. **Perfect deadline record**: No overdue or late completions
2. **Proactive extensions**: 100% requested before deadline
3. **Consistent updates**: Updates every 2-3 days
4. **Self-starter**: All task requests approved
5. **Excellent on-time rate**: >= 90% on-time completion

## Multi-Period Analysis

Activity is analyzed across multiple time periods to identify trends:
- Last 30 days
- Last 3 months
- Last 6 months
- Last 12 months

The AI compares these periods to determine if the member is:
- **Improving**: Increasing activity/completion over time
- **Declining**: Decreasing activity/completion
- **Stable**: Consistent performance
- **Fluctuating**: Inconsistent patterns

## AI Prompt Structure

The AI receives structured data including:

1. **Member Profile**: Name, username, roles, tenure, status
2. **Multi-Period Breakdown**: Activity metrics per time period
3. **Recent Activity**: Detailed last-30-day metrics
4. **Progress Update Quality**: Update count, blockers, recency
5. **Weighted Productivity**: Complexity-adjusted output
6. **Initiative Metrics**: Self-direction indicators
7. **Timeline Accuracy**: Start time and completion patterns
8. **Overdue Tasks**: Currently overdue (critical section)
9. **Deadline Violation History**: Late completions + late extensions
10. **Auto-Detected Flags**: Red and green flags
11. **Active Tasks**: Current task list with overdue markers
12. **Enrichment Notes**: Superuser observations
13. **Extension Patterns**: Extension request analysis

## Report Sections

The AI generates a report with these sections:

1. **Executive Summary**: 2-3 sentence overview
2. **Performance Trend Analysis**: Period-over-period comparison
3. **Activity Analysis**: Task engagement patterns
4. **Strengths**: Notable positives (2-3 items)
5. **Areas for Development**: Improvement opportunities (1-2 items)
6. **Recommended Next Steps**: For member and mentor
7. **Risk Flags**: Concerns requiring attention

## Client Visualization

The UI displays metrics before the AI report loads:

### Warning Banners
- **Red**: Currently overdue tasks
- **Orange**: Deadline violation history (late completions + late extensions)

### Stat Cards
- Tenure
- Tasks Completed (shows overdue count if any)
- On-Time Rate (color-coded)
- Communication Score (color-coded)

### Charts
- Communication donut chart (proactive vs late extensions)
- Activity trend area chart (completion over time)
- Score progress bars

## Files

- **API Route**: `src/app/api/ai/member-analysis/route.ts`
- **Chain**: `src/lib/ai/chains/member-analysis.ts`
- **Prompt**: `src/lib/ai/prompts/member-analysis.ts`
- **UI Component**: `src/components/member-report/ai-report-section.tsx`

## Related Documentation

- [User Enrichment Metrics](./USER_ENRICHMENT_METRICS.md) - Detailed metrics derivation
- [Design Guidelines](./DESIGN.md) - UI/UX patterns
