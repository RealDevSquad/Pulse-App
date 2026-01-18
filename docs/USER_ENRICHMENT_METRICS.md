# User Enrichment Metrics: Red Task Tracking

This document describes how to derive user performance metrics from existing RDS data for the user enrichment feature.

## Data Sources

| Collection | Key Fields | Purpose |
|------------|-----------|---------|
| `tasks` | `assignee`, `startedOn`, `endsOn`, `status` | Task assignment and deadlines |
| `logs` (type: "task") | `timestamp`, `body.new.status` | Track when status changed to COMPLETED |
| `extensionRequests` | `timestamp`, `oldEndsOn`, `newEndsOn`, `status`, `reason` | Track deadline extensions |

## Red Task Detection

A "red task" is a task that crossed its deadline before completion.

### How to Detect Red Tasks

```
Timeline:
─────────────────────────────────────────────────────────────────────►
     │                              │                    │
 startedOn                       endsOn            log[COMPLETED]
 (assigned)                    (deadline)          (actual finish)

If log[COMPLETED].timestamp > task.endsOn → RED TASK (late completion)
If NOW > task.endsOn && status != COMPLETED → CURRENTLY RED
```

### What We CAN Determine

| Metric | Source | How |
|--------|--------|-----|
| When user was assigned | `task.startedOn` | Timestamp on task document |
| Original deadline | `task.endsOn` | Timestamp on task document |
| When task completed | Task logs | Find log where `body.new.status = "COMPLETED"` |
| Days overdue | Calculation | `completionTimestamp - endsOn` (in days) |

### What We CANNOT Determine

| Metric | Why |
|--------|-----|
| Who assigned the task | `assignedBy` not captured |
| If start date was changed | Changes to `startedOn` not logged |
| Why dates were changed | No reason field in task logs |
| Previous assignees | Reassignment history not preserved |

## Communication Score: Late Extension Requests

A key indicator of user communication quality is whether they request extensions **before** or **after** a task becomes red.

### Detection Logic

```javascript
const wasAlreadyRed = extensionRequest.timestamp > extensionRequest.oldEndsOn;

// If wasAlreadyRed && status === 'APPROVED':
// → Extension was granted AFTER task crossed deadline
// → Indicates lack of proactive communication
```

### Communication Score Calculation

```javascript
const approvedExtensions = extensionRequests.filter(er => er.status === 'APPROVED');
const proactiveCount = approvedExtensions.filter(er => er.timestamp <= er.oldEndsOn).length;
const communicationScore = (proactiveCount / approvedExtensions.length) * 100;
```

**Interpretation:**
- **90-100%**: Excellent communication - consistently asks for help before deadlines
- **70-89%**: Good communication - occasionally reactive
- **Below 70%**: Needs improvement - frequently lets tasks go red before asking for extensions

### Example Output (Hariom)

```
Total APPROVED extensions: 22
Requested BEFORE deadline (proactive): 20
Requested AFTER deadline (reactive):   2

Communication Score: 91% proactive
```

## Suggested User Enrichment Schema

```json
{
  "userId": "MONmowaKYkul24eT5fuG",
  "username": "hariom-vashista-1",
  "metrics": {
    "totalTasksAnalyzed": 11,
    "tasksWithDeadlines": 11,
    "completedTasks": 10,
    "redTaskCount": 2,
    "completedAfterDeadline": 1,
    "currentlyOverdue": 1,
    "hasRedTask": true,
    "communicationScore": 91,
    "extensionStats": {
      "totalApproved": 22,
      "proactive": 20,
      "reactive": 2
    },
    "redTaskHistory": [
      {
        "taskId": "8YialVi1u4hHymR2vdiN",
        "daysOverdue": 1,
        "status": "COMPLETED",
        "originalDeadline": 1763510400,
        "completedAt": 1763517356
      }
    ]
  }
}
```

## Implementation in Pulse App

The late extension detection is integrated into:

### 1. Member Metrics (`src/lib/member-metrics.ts`)

The `calculateCompletionQuality()` function now differentiates between proactive and reactive extensions:

```typescript
// Heavier penalty for late extensions (lack of communication)
const proactivePenalty = Math.min(20, proactiveCount * 5);   // -5 each, max -20
const lateExtensionPenalty = Math.min(45, lateCount * 15);   // -15 each, max -45
```

### 2. AI Prompts

**Member Analysis** (`src/lib/ai/prompts/member-analysis.ts`):
- Added `{lateExtensionRequests}` and `{communicationScore}` placeholders
- AI is instructed to flag communication score < 80% as a coaching opportunity

**Extension Analysis** (`src/lib/ai/prompts/extension-analysis.ts`):
- Added `{lateExtensionCount}` placeholder
- AI is instructed to flag late extensions as a communication concern

### 3. AI Chains

**Member Analysis Chain** (`src/lib/ai/chains/member-analysis.ts`):
- `MemberActivityMetrics` interface now includes `lateExtensionRequests`
- Calculates `communicationScore` (% of extensions requested before deadline)

**Extension Analysis Chain** (`src/lib/ai/chains/extension-analysis.ts`):
- Calculates `lateExtensionCount` by comparing `timestamp` vs `oldEndsOn`

## Related Scripts

Analysis scripts are located in the RDS workspace:

```
Real-Dev-Squad/
└── OOO Issue 001/
    └── manual-scripts/
        ├── run-analysis.js          # Main red task analysis
        ├── verify-data-capture-v2.js # Verify what data is available
        └── analyze-red-tasks.ts     # TypeScript version
```

**Usage:**
```bash
cd backend-nodejs
export FIRESTORE_CONFIG='...'  # See OOO Issue 001/CLAUDE.md for setup
node "../OOO Issue 001/manual-scripts/run-analysis.js" <username>
```

## Important Assumptions

1. **`task.startedOn`** represents when the CURRENT assignee started, not original assignment date
2. **Extension requests** capture the deadline at time of request (`oldEndsOn`), allowing before/after comparison
3. **Task logs** only capture status changes and `percentCompleted`, not date field changes
4. **Completion detection** relies on finding the log entry where status became COMPLETED/DONE/VERIFIED
