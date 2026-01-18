# Pulse App - Development Guidelines

## Firestore Write Policy (CRITICAL)

**All data written directly to Firestore from Pulse App (without using RDS APIs) MUST go into the `pulseAppOnly` collection.**

```
pulseAppOnly/                              ← collection
├── {auto-generated-id}/                   ← document (one per event)
│   ├── meta: { type: "availability_hidden", by: "adminUserId", target: "user" }
│   ├── action: "hide" | "show"
│   ├── targetId: "userId"             ← unified field for all event types
│   └── timestamp: 1705...
├── {auto-generated-id}/                   ← member enrichment event
│   ├── meta: { type: "member_enrichment", by: "superUserId", target: "user" }
│   ├── targetId: "userId"             ← unified field (same index as above)
│   ├── enrichmentType: "context_note" | "goal_set" | "skill_assessment" | "intervention"
│   ├── content: { text: "...", category: "mentorship" | "blocker" | "growth" | "recognition" }
│   └── timestamp: 1705...
├── {auto-generated-id}/                   ← task enrichment event
│   ├── meta: { type: "task_enrichment", by: "superUserId", target: "task" }
│   ├── targetId: "taskId"             ← unified field (same index as above)
│   ├── skills: ["React", "Node.js"]    ← required skills
│   ├── skillCount: 2                   ← number for querying (where skillCount >= 3)
│   ├── complexity: "trivial" | "simple" | "moderate" | "complex" | "very_complex"
│   ├── complexityWeight: 3             ← linear 1-5 scale for querying (where complexityWeight >= 3)
│   ├── unknownFactors: ["API latency"] ← risks/unknowns (always array)
│   ├── unknownCount: 1                 ← number for querying (where unknownCount > 0)
│   ├── notes?: "..."                   ← optional notes
│   └── timestamp: 1705...
└── ...
```

### Index Strategy

**Single composite index for all event types:** `meta.type + targetId + timestamp (desc)`

This unified approach means:
- All events use `targetId` regardless of what they target (user, task, etc.)
- `meta.target` specifies the entity type: `"user"` or `"task"`
- No need for separate indexes per event type

### Event Types Reference

| `meta.type` | Purpose | Related Files |
|-------------|---------|---------------|
| `availability_hidden` | Hide/show members from availability tracker | `src/app/api/availability/hidden-users/route.ts` |
| `member_enrichment` | Superuser notes about members (goals, context, assessments) | `src/lib/enrichment-types.ts`, `src/app/api/member-enrichment/route.ts` |
| `task_enrichment` | Task metadata (skills, complexity) for weighted productivity | `src/lib/task-enrichment-types.ts`, `src/app/api/task-enrichment/route.ts` |

### Access Control

| Level | Check Function | Who | Features |
|-------|---------------|-----|----------|
| **Admin** | `isAdminUser()` | Any user with `roles.super_user === true` | Member enrichment, AI reports, task requests, extension requests |
| **Root** | `isRootUser()` | Ankush only (+ super_user) | Sensitive contact info, applications, destructive operations |

Use `isAdminUser()` for admin features. Use `isRootUser()` only for the most sensitive operations.

**Rules:**
1. **NEVER write to existing RDS collections** (tasks, users, usersStatus, etc.) directly from Pulse App
2. **ALWAYS use RDS APIs** for modifying shared data (tasks, users, etc.)
3. **Only use `pulseAppOnly` collection** for Pulse-specific data that doesn't exist in RDS
4. **Always include a `meta.type` field** in documents for filtering (e.g., `meta: { type: "settings" }`)
5. Use descriptive document IDs with type prefix (e.g., `settings_{userId}`, `draft_{id}`)
6. **Use Event Trail Pattern** for all data - store events/actions with timestamps rather than just current state. This enables auditing and tracing changes over time.
7. **Consistent field naming** for all events:
   - `targetId` = the subject/target of the event (user ID, task ID, etc.)
   - `meta.by` = who performed the action
   - `meta.target` = type of entity being targeted (`"user"` or `"task"`)
   - This allows reusing a single composite index: `meta.type + targetId + timestamp`

**Why:** RDS backend has triggers, validations, and business logic tied to its collections. Direct writes bypass these and can corrupt data or cause inconsistencies.

**Example:**
```ts
// ❌ BAD - Writing directly to RDS collection
await db.collection('tasks').doc(id).update({ ... });

// ✅ GOOD - Use RDS API for shared data
await fetch(`${RDS_API}/tasks/${id}`, { method: 'PATCH', ... });

// ✅ GOOD - One document per event (event sourcing)
// meta contains: type (for querying), by (who created), target (entity type)
await db.collection('pulseAppOnly').add({
  meta: { type: 'availability_hidden', by: session.userId, target: 'user' },
  action: 'hide',
  targetId: userId,  // unified field for all event types
  timestamp: Date.now(),
});

// ✅ GOOD - Query events by meta.type + targetId (uses single composite index)
const snapshot = await db.collection('pulseAppOnly')
  .where('meta.type', '==', 'availability_hidden')
  .where('targetId', '==', userId)
  .orderBy('timestamp', 'desc')
  .limit(1)
  .get();

// ✅ GOOD - Derive current state from latest event per entity
const latestByTarget = new Map();
for (const doc of snapshot.docs) {
  const data = doc.data();
  if (!latestByTarget.has(data.targetId)) latestByTarget.set(data.targetId, data);
}
```

## Design Reference

See `docs/DESIGN.md` for:
- Layout structure and wireframes
- Refactoring UI principles (typography, hierarchy, spacing)
- Color palette and status indicators
- Chart guidelines

## API Reference

See `docs/API.md` for RDS backend API documentation:
- Base URL: `https://api.realdevsquad.com`
- Users, Tasks, Logs, OOO endpoints

## User Enrichment & Red Task Metrics

See `docs/USER_ENRICHMENT_METRICS.md` for:
- How to detect "red tasks" (tasks that crossed deadlines)
- Communication score calculation (proactive vs reactive extension requests)
- Available data sources and their limitations
- Suggested user enrichment schema
- Links to analysis scripts in `Real-Dev-Squad/OOO Issue 001/manual-scripts/`

**Key metrics derivable from existing RDS data:**
- `task.startedOn` → When current assignee started
- `task.endsOn` vs completion log timestamp → Red task detection
- `extensionRequest.timestamp` vs `oldEndsOn` → Communication score (proactive vs late requests)
- Authentication and error handling
- Request/response formats with examples
- Query parameters for filtering and pagination

Source: [website-api-contracts](https://github.com/RealDevSquad/website-api-contracts)

**Key endpoints used in this app:**
- `GET /users` - List members with pagination
- `GET /users/userId/:id` - Get user details
- `GET /tasks` - List tasks with status/assignee filters
- `GET /logs` - Activity logs (superuser only)
- `GET /requests?type=OOO` - Out of office requests

## Mobile Responsiveness

All features MUST be mobile responsive. Follow these breakpoints:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, bottom navigation |
| Tablet | 768px - 1279px | Two columns, collapsible sidebar |
| Desktop | >= 1280px | Three columns (Sidebar + Main + Right Panel) |

### Requirements

- Test every component on mobile viewport before marking complete
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
- No horizontal scrolling on mobile
- Touch-friendly tap targets (min 44x44px)
- Collapsible/hideable panels on smaller screens

## Tech Stack

- **Framework:** Next.js 15.5.9 (App Router)
- **Language:** TypeScript
- **Database:** Firestore
- **Auth:** JWT (private key verification)
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Package Manager:** pnpm

## Code Style

- Use TypeScript strict mode
- Prefer server components where possible
- Use `@/` path alias for imports

## Server Component Performance (Critical)

**Always parallelize independent data fetches** in server components using `Promise.all`:

```ts
// ❌ BAD - Sequential (slow)
const session = await getSession();
const params = await searchParams;
const isRoot = await isRootUser(session.userId);
const { users } = await getCachedUsers(...);

// ✅ GOOD - Parallel where possible (fast)
const [session, params] = await Promise.all([
  getSession(),
  searchParams,
]);

const [isRoot, { users }] = await Promise.all([
  isRootUser(session!.userId),
  getCachedUsers(...),
]);
```

**Rules:**
1. Group independent awaits into `Promise.all` calls
2. Chain dependent fetches (e.g., need `session` before `isRootUser`)
3. Keep data fetching in server components, pass data to client components as props

## Communication

When completing UI features, always include an ASCII UI preview showing how the component looks. Example:

```
┌─────────────────────────────────────────┐
│ [Status Badge]      Date info           │
│ Description text here                   │
└─────────────────────────────────────────┘

▶ Collapsible section (count)
   └─ Expanded content here
```

This helps visualize the implementation without running the app.

## RDS Cookie (Critical)

The RDS auth cookie (`rds-session`) is scoped to `.realdevsquad.com`, **HTTPS-only**, and **HTTP-only**:

1. **Domain scoped**: Cookie is only sent to `*.realdevsquad.com` domains - won't work on `localhost`
2. **HTTPS required**: Cookie has `Secure` flag, so it's only sent over HTTPS
3. **HTTP-only**: Client-side JS cannot read it, but Next.js `cookies()` CAN read it server-side (it reads from incoming HTTP request headers)

**For local development**: Must run on `https://dev.realdevsquad.com:3000` (see README) so the cookie is sent by the browser.

## URL State (Critical)

**All filter/sort/pagination state MUST be persisted in URL params** so users can bookmark their current view. Every link that changes page state must preserve all existing filter parameters.

## Running Scripts

Scripts in `manual-scripts/` directory should be run with:

```bash
pnpm exec tsx manual-scripts/<script-name>.ts
```

**Note:** `ts-node` doesn't work reliably due to ESM/CJS issues. Use `tsx` instead.

Scripts must:
- Load env vars manually from `.env.local` (no dotenv package)
- Initialize Firebase Admin directly (can't import from `@/lib` due to path resolution)
- See `manual-scripts/find-bad-tasks.ts` for reference implementation
