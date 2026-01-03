# RDS API Documentation

**Base URL:** `https://api.realdevsquad.com`

**Source:** [website-api-contracts](https://github.com/RealDevSquad/website-api-contracts)

---

## Authentication

All authenticated endpoints require the `rds-session` cookie containing a JWT token.

---

## Users API

### User Object

```json
{
  "id": "string",
  "username": "string",
  "first_name": "string",
  "last_name": "string",
  "email": "string",
  "phone": "number",
  "yoe": "number",
  "company": "string",
  "designation": "string",
  "img": "string",
  "github_id": "string",
  "linkedin_id": "string",
  "twitter_id": "string",
  "website": "string",
  "discordId": "string",
  "roles": {
    "member": "boolean",
    "in_discord": "boolean",
    "archived": "boolean"
  },
  "picture": {
    "url": "string"
  }
}
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get all users |
| GET | `/users/self` | Get current user |
| GET | `/users/userId/:userId` | Get user by ID |
| GET | `/users/:username` | Get user by username |
| GET | `/users/search` | Search users with filters |

#### GET /users

Query params:
- `size` - Number of users per page (1-100, default: 100)
- `page` - Page number (default: 0)
- `search` - Username prefix search
- `next` / `prev` - Pagination cursors

Response:
```json
{
  "message": "Users returned successfully!",
  "users": [{ "<user_object>" }],
  "links": {
    "next": "/users?next={id}&size={n}",
    "prev": "/users?prev={id}&size={n}"
  }
}
```

#### GET /users/search

Query params:
- `state` - User state: ACTIVE, OOO, IDLE, ONBOARDING
- `role` - User role: MEMBER, INDISCORD, ARCHIVED
- `verified` - Boolean

---

## Tasks API

### Task Object

```json
{
  "id": "string",
  "title": "string",
  "type": "feature | group",
  "status": "AVAILABLE | ASSIGNED | IN_PROGRESS | BLOCKED | COMPLETED | NEEDS_REVIEW | IN_REVIEW | VERIFIED | DONE",
  "assignee": "userId",
  "createdBy": "userId",
  "createdAt": "epoch",
  "updatedAt": "epoch",
  "endsOn": "epoch",
  "startedOn": "epoch",
  "percentCompleted": "number (0-100)",
  "priority": "HIGH | MEDIUM | LOW",
  "github": {
    "issue": {
      "id": "number",
      "html_url": "string",
      "status": "string"
    }
  }
}
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | Get all tasks |
| GET | `/tasks/self` | Get current user's tasks |
| GET | `/tasks/:id/details` | Get task details |
| GET | `/tasks/:username` | Get user's tasks |
| POST | `/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task |
| PATCH | `/tasks/self/:id` | Update own task |

#### GET /tasks

Query params:
- `status` - Filter by status (case insensitive)
- `assignee` - Filter by assignee username(s)
- `title` - Filter by title prefix
- `page` - Page number (default: 0)
- `size` - Tasks per page (1-100, default: 5)
- `next` / `prev` - Pagination cursors

Response:
```json
{
  "message": "Tasks returned successfully!",
  "tasks": [{ "<task_object>" }]
}
```

---

## Logs API

### Log Object

```json
{
  "type": "string",
  "meta": {
    "userId": "string",
    "taskId": "string",
    "username": "string"
  },
  "body": {
    "old": {},
    "new": {}
  },
  "timestamp": {
    "_seconds": "number",
    "_nanoseconds": "number"
  }
}
```

### Log Types

- `task` - Task status changes
- `extensionRequests` - Extension request logs
- `REQUEST_CREATED` - Task request created
- `REQUEST_APPROVED` - Task request approved
- `REQUEST_REJECTED` - Task request rejected
- `PROFILE_DIFF_APPROVED` - Profile change approved
- `PROFILE_DIFF_REJECTED` - Profile change rejected

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/logs` | Get all logs (superuser only) |
| GET | `/logs/:type` | Get logs by type |

#### GET /logs

Query params:
- `type` - Filter by log type
- `format=feed` - Get flattened format
- `page` - Page number
- `size` - Logs per page (default: 5)
- `next` / `prev` - Pagination cursors

**Note:** Requires superuser access.

---

## Users Status API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/status` | Get all user statuses |
| GET | `/users/status/:userId` | Get user status |

---

## Extension Requests API

Extension requests allow task assignees to request deadline extensions for their assigned tasks.

### Extension Request Object

```json
{
  "id": "string",
  "taskId": "string",
  "title": "string (task title)",
  "assignee": "userId",
  "assigneeId": "userId",
  "oldEndsOn": "epoch (seconds)",
  "newEndsOn": "epoch (seconds)",
  "reason": "string",
  "status": "PENDING | APPROVED | DENIED",
  "requestNumber": "number (nth request by this user)",
  "timestamp": "epoch (seconds, creation time)"
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting review |
| `APPROVED` | Extension granted, task deadline updated |
| `DENIED` | Extension rejected |

### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/extension-requests` | List extension requests with filters | Super User |
| GET | `/extension-requests/:id` | Get single extension request | Super User |
| GET | `/extension-requests/self` | Get own extension requests | Authenticated |
| GET | `/extension-requests/user/:userId` | Get user's extension requests | Authenticated |
| POST | `/extension-requests` | Create extension request | Authenticated |
| PATCH | `/extension-requests/:id` | Update extension request | Super User |
| PATCH | `/extension-requests/:id/status` | Approve or deny request | Super User |

---

### GET /extension-requests

List extension requests with pagination and filtering. **Requires super_user role.**

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `PENDING`, `APPROVED`, `DENIED` (comma-separated for multiple) |
| `taskId` | string | Filter by task ID |
| `assignee` | string | Filter by assignee userId |
| `cursor` | string | Pagination cursor (extension request ID) |
| `size` | number | Page size (default: 5) |
| `order` | string | Sort order: `asc` or `desc` (by timestamp) |

#### Examples

```
# Get pending extension requests
GET /extension-requests?status=PENDING&size=20&order=desc

# Get all extension requests for a specific task
GET /extension-requests?taskId=abc123

# Get extension requests for a specific user
GET /extension-requests?assignee=userId123&status=PENDING
```

#### Response (Success - 200)

```json
{
  "message": "Extension Requests returned successfully!",
  "allExtensionRequests": [
    {
      "id": "ext123",
      "taskId": "task456",
      "title": "Fix login bug",
      "assignee": "userId",
      "assigneeId": "userId",
      "oldEndsOn": 1697452226,
      "newEndsOn": 1698062026,
      "reason": "Need additional time due to scope increase",
      "status": "PENDING",
      "requestNumber": 1,
      "timestamp": 1697452226
    }
  ],
  "next": "/extension-requests?cursor=ext124&size=20&status=PENDING"
}
```

---

### GET /extension-requests/:id

Get a single extension request by ID. **Requires super_user role.**

#### Response (Success - 200)

```json
{
  "message": "Extension Requests returned successfully!",
  "extensionRequest": {
    "id": "ext123",
    "taskId": "task456",
    "title": "Fix login bug",
    "assignee": "userId",
    "oldEndsOn": 1697452226,
    "newEndsOn": 1698062026,
    "reason": "Need additional time due to scope increase",
    "status": "PENDING",
    "requestNumber": 1,
    "timestamp": 1697452226
  }
}
```

#### Response (Not Found - 404)

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Extension Request not found"
}
```

---

### GET /extension-requests/self

Get all extension requests for the currently authenticated user.

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `taskId` | string | Filter by task ID (returns latest request for that task) |
| `status` | string | Filter by status |

#### Response (Success - 200)

```json
{
  "message": "Extension Requests returned successfully!",
  "allExtensionRequests": [
    {
      "id": "ext123",
      "taskId": "task456",
      "title": "Fix login bug",
      "oldEndsOn": 1697452226,
      "newEndsOn": 1698062026,
      "reason": "Need additional time",
      "status": "APPROVED",
      "reviewedBy": "Admin Name",
      "reviewedAt": 1697552226
    }
  ]
}
```

---

### POST /extension-requests

Create a new extension request for a task.

#### Request Body

```json
{
  "taskId": "task456",
  "oldEndsOn": 1697452226,
  "newEndsOn": 1698062026,
  "reason": "The scope increased after initial estimation. Need more time to implement additional security measures."
}
```

#### Validation Rules

- User must be the task assignee (or super_user)
- `newEndsOn` must be greater than `oldEndsOn`
- `oldEndsOn` must match the task's current `endsOn`
- No pending extension request should exist for this task

#### Response (Success - 201)

```json
{
  "message": "Extension Request created successfully!",
  "extensionRequest": {
    "id": "newExtRequestId",
    "taskId": "task456",
    "oldEndsOn": 1697452226,
    "newEndsOn": 1698062026,
    "reason": "...",
    "status": "PENDING",
    "requestNumber": 1
  }
}
```

#### Error Responses

| Status | Message |
|--------|---------|
| 400 | `Task Not Found` |
| 400 | `Assignee is not present for this task` |
| 400 | `New ETA must be greater than Old ETA` |
| 400 | `Old ETA does not match the task's ETA` |
| 400 | `An extension request for this task already exists.` |
| 403 | `Only assigned user and super user can create an extension request for this task.` |

---

### PATCH /extension-requests/:id/status

Approve or deny an extension request. **Requires super_user role.**

#### Request Body

```json
{
  "status": "APPROVED"
}
```

Or:

```json
{
  "status": "DENIED"
}
```

#### Response (Success - 200)

```json
{
  "message": "Extension request APPROVED successfully!",
  "extensionLog": {
    "id": "logId",
    "type": "extensionRequests",
    "meta": {
      "extensionRequestId": "ext123",
      "taskId": "task456",
      "username": "superuser",
      "userId": "superUserId"
    },
    "body": {
      "status": "APPROVED"
    }
  }
}
```

#### Approve Side Effects

When an extension request is APPROVED:
1. The task's `endsOn` is updated to `newEndsOn`
2. A log entry is created for the task update
3. A log entry is created for the extension request status change

#### Error Responses

| Status | Message |
|--------|---------|
| 404 | `Extension Request not found` |

---

## OOO (Out of Office) API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/requests?type=OOO` | Get OOO requests |

---

## Task Requests API

Task requests allow users to request assignment to existing tasks or request creation of new tasks from GitHub issues.

### Task Request Object

```json
{
  "id": "string",
  "requestors": ["userId1", "userId2"],
  "status": "PENDING | APPROVED | DENIED | WAITING",
  "taskTitle": "string",
  "taskId": "string (for ASSIGNMENT type)",
  "externalIssueUrl": "string (GitHub API URL)",
  "externalIssueHtmlUrl": "string (GitHub web URL)",
  "requestType": "CREATION | ASSIGNMENT",
  "users": [
    {
      "userId": "string",
      "username": "string",
      "first_name": "string",
      "last_name": "string",
      "picture": "string",
      "proposedDeadline": "epoch (ms)",
      "proposedStartDate": "epoch (ms)",
      "description": "string (optional)",
      "markdownEnabled": "boolean",
      "status": "PENDING | APPROVED",
      "requestedAt": "epoch (ms)"
    }
  ],
  "usersCount": "number",
  "createdBy": "userId",
  "createdAt": "epoch (ms)",
  "lastModifiedBy": "userId",
  "lastModifiedAt": "epoch (ms)",
  "approvedTo": "userId (when approved)",
  "url": "string (link to task request)"
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting review |
| `APPROVED` | Request was approved |
| `DENIED` | Request was rejected |
| `WAITING` | Legacy status (deprecated) |

### Request Types

| Type | Description |
|------|-------------|
| `CREATION` | Request to create a new task from a GitHub issue |
| `ASSIGNMENT` | Request to be assigned to an existing task |

### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/taskRequests` | List task requests with pagination/filters | Authenticated |
| GET | `/taskRequests/:id` | Get single task request by ID | Authenticated |
| POST | `/taskRequests` | Create a new task request | Authenticated |
| PATCH | `/taskRequests` | Approve or reject a task request | Super User |
| PATCH | `/taskRequests/approve` | Approve a task request (deprecated) | Super User |
| POST | `/taskRequests/addOrUpdate` | Legacy add/update (deprecated) | Authenticated |

---

### GET /taskRequests

List task requests with pagination, filtering, and sorting.

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `size` | number | Page size (1-100) |
| `next` | string | Cursor for next page (task request ID) |
| `prev` | string | Cursor for previous page (task request ID) |
| `q` | string | RQL query string for filters and sorting |

#### RQL Query Syntax

The `q` parameter supports a Resource Query Language (RQL) format:

**Filters:**
- `status:+pending` - Include pending requests
- `status:+approved` - Include approved requests  
- `status:+denied` - Include denied requests
- `request-type:+creation` - Include creation requests
- `request-type:+assignment` - Include assignment requests

**Sorting:**
- `sort:created+asc` - Sort by creation date ascending
- `sort:created+desc` - Sort by creation date descending (default)
- `sort:requestors+asc` - Sort by requestor count ascending
- `sort:requestors+desc` - Sort by requestor count descending

**Examples:**
```
# Get pending creation requests, newest first
?q=status:+pending,request-type:+creation&size=10

# Get all approved requests sorted by requestor count
?q=status:+approved,sort:requestors+desc&size=20
```

#### Response

```json
{
  "message": "Task requests returned successfully",
  "data": [
    {
      "id": "abc123",
      "requestors": ["user1Id", "user2Id"],
      "status": "PENDING",
      "taskTitle": "Fix login bug",
      "externalIssueUrl": "https://api.github.com/repos/Real-Dev-Squad/website-backend/issues/1599",
      "externalIssueHtmlUrl": "https://github.com/Real-Dev-Squad/website-backend/issues/1599",
      "requestType": "CREATION",
      "users": [
        {
          "userId": "user1Id",
          "username": "johndoe",
          "first_name": "John",
          "last_name": "Doe",
          "picture": "https://...",
          "proposedDeadline": 1697452226789,
          "proposedStartDate": 1697452226789,
          "description": "I can fix this issue",
          "markdownEnabled": false,
          "status": "PENDING",
          "requestedAt": 1697452226789
        }
      ],
      "usersCount": 1,
      "createdBy": "user1Id",
      "createdAt": 1697452229369,
      "lastModifiedBy": "user1Id",
      "lastModifiedAt": 1697452229369
    }
  ],
  "next": "/taskRequests?next=abc124&size=10&q=status:+pending",
  "prev": "/taskRequests?prev=abc122&size=10&q=status:+pending"
}
```

---

### GET /taskRequests/:id

Get a single task request by ID.

#### Response (Success - 200)

```json
{
  "message": "Task request returned successfully",
  "data": {
    "id": "abc123",
    "requestors": ["user1Id"],
    "status": "PENDING",
    "taskTitle": "Fix login bug",
    "externalIssueUrl": "https://api.github.com/repos/Real-Dev-Squad/...",
    "externalIssueHtmlUrl": "https://github.com/Real-Dev-Squad/...",
    "requestType": "CREATION",
    "users": [...],
    "usersCount": 1,
    "createdAt": 1697452229369,
    "url": "https://members.realdevsquad.com/taskRequests/abc123"
  }
}
```

#### Response (Not Found - 404)

```json
{
  "message": "Task request not found"
}
```

---

### POST /taskRequests

Create a new task request.

#### Request Body (CREATION type)

```json
{
  "requestType": "CREATION",
  "externalIssueUrl": "https://api.github.com/repos/Real-Dev-Squad/website-status/issues/1050",
  "externalIssueHtmlUrl": "https://github.com/Real-Dev-Squad/website-status/issues/1050",
  "userId": "requestingUserId",
  "proposedStartDate": 1697452226700,
  "proposedDeadline": 1697552226700,
  "description": "Optional description of why user wants this task",
  "markdownEnabled": false
}
```

#### Request Body (ASSIGNMENT type)

```json
{
  "requestType": "ASSIGNMENT",
  "taskId": "existingTaskId",
  "externalIssueUrl": "https://api.github.com/repos/Real-Dev-Squad/...",
  "externalIssueHtmlUrl": "https://github.com/Real-Dev-Squad/...",
  "userId": "requestingUserId",
  "proposedStartDate": 1697452226700,
  "proposedDeadline": 1697552226700,
  "description": "Optional description",
  "markdownEnabled": false
}
```

#### Validation Rules

- `proposedDeadline` must be greater than `proposedStartDate`
- `externalIssueUrl` must be a valid GitHub API issue URL from RDS repos
- `externalIssueHtmlUrl` must be a valid GitHub web issue URL from RDS repos
- For ASSIGNMENT: `taskId` is required and task must exist
- For CREATION: GitHub issue must exist and not already have a task

#### Response (Created - 201)

```json
{
  "message": "Task request successful.",
  "data": {
    "id": "newTaskRequestId",
    "requestors": ["userId"],
    "status": "PENDING",
    "taskTitle": "Issue title from GitHub",
    "externalIssueUrl": "...",
    "requestType": "CREATION",
    "users": [...],
    "usersCount": 1,
    "createdAt": 1697452229369
  }
}
```

#### Response (Updated existing request - 200)

When another user requests the same issue, they're added to the existing request:

```json
{
  "message": "Task request successful.",
  "data": {
    "id": "existingRequestId",
    "requestors": ["user1Id", "user2Id"],
    "usersCount": 2,
    ...
  }
}
```

#### Error Responses

| Status | Message |
|--------|---------|
| 400 | `Task deadline cannot be before the start date` |
| 400 | `User not found` |
| 400 | `Task does not exist` (ASSIGNMENT) |
| 400 | `Issue does not exist` (CREATION) |
| 400 | `External issue url is not valid` |
| 400 | `Task was already requested` |
| 403 | `Not authorized to create the request` |
| 409 | `Task exists for the given issue.` |

---

### PATCH /taskRequests

Approve or reject a task request. **Requires super_user role.**

#### Query Parameters

| Param | Values | Description |
|-------|--------|-------------|
| `action` | `approve` / `reject` | Action to perform (default: `approve`) |

#### Request Body (Approve)

```json
{
  "taskRequestId": "taskRequest123",
  "userId": "userIdToApprove"
}
```

#### Request Body (Reject)

```json
{
  "taskRequestId": "taskRequest123"
}
```

Note: `userId` is not required for rejection.

#### Response (Success - 200)

```json
{
  "message": "Task updated successfully.",
  "taskRequest": {
    "users": [...],
    "approvedTo": "userId",
    "status": "APPROVED",
    "taskId": "newlyCreatedTaskId",
    "lastModifiedBy": "superUserId",
    "lastModifiedAt": 1697452229369
  }
}
```

#### Approve Side Effects

When a CREATION request is approved:
1. A new task is created with:
   - `assignee`: The approved user
   - `title`: From the GitHub issue
   - `type`: FEATURE
   - `status`: ASSIGNED
   - `priority`: HIGH (default)
   - `github.issue.url`: The external issue URL
   - `startedOn`: User's proposed start date
   - `endsOn`: User's proposed deadline

2. The approved user's status is updated to ACTIVE

#### Error Responses

| Status | Message |
|--------|---------|
| 400 | `taskRequestId not provided` |
| 400 | `userId not provided` (for approve action) |
| 400 | `Task request not found.` |
| 400 | `User request not available.` (user didn't request this task) |
| 400 | `Task request was previously approved or rejected.` |
| 400 | `Unknown action` |
| 401 | Unauthorized (not super_user) |

---

### Deprecated Endpoints

#### POST /taskRequests/addOrUpdate (Deprecated)

Legacy endpoint for creating/updating task requests. Use `POST /taskRequests` instead.

#### PATCH /taskRequests/approve (Deprecated)

Legacy approval endpoint. Use `PATCH /taskRequests?action=approve` instead.

---

## Useful Query Patterns

### Get active members with tasks
```
GET /users/search?state=ACTIVE&role=MEMBER
```

### Get overdue tasks
```
GET /tasks?status=IN_PROGRESS
# Then filter client-side by endsOn < now
```

### Get user activity logs
```
GET /logs?type=task&userId={userId}
```

### Get pending task requests
```
GET /taskRequests?q=status:+pending&size=20
```

### Get task creation requests only
```
GET /taskRequests?q=request-type:+creation,status:+pending&size=20
```

### Get all task requests sorted by requestor count
```
GET /taskRequests?q=sort:requestors+desc&size=50
```

---

## Rate Limits

No documented rate limits, but be reasonable with API calls.

---

## Error Responses

Standard error format:
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthenticated User"
}
```

Common status codes:
- `401` - Unauthenticated
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable
