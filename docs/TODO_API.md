# TODO API Documentation

Base URL: `https://services.realdevsquad.com/todo`

Source: [todo-backend](https://github.com/RealDevSquad/todo-backend)

## Authentication

All endpoints require authentication via cookies (sessionid).

## Endpoints

### Tasks

#### Get Tasks
```
GET /v1/tasks
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number for pagination (default: 1) |
| limit | integer | Number of tasks per page (default: 10, max: 100) |
| teamId | string | Filter tasks assigned to a specific team |

Response:
```json
{
  "links": {
    "next": "/v1/tasks?page=2&limit=10",
    "prev": null
  },
  "error": null,
  "tasks": [
    {
      "id": "string",
      "displayId": "string",
      "title": "string",
      "description": "string | null",
      "priority": 1 | 2 | 3 | null,
      "status": "TODO" | "IN_PROGRESS" | "DEFERRED" | "BLOCKED" | "DONE" | null,
      "assignee": {
        "id": "string",
        "name": "string",
        "relation_type": "team" | "user",
        "is_action_taken": boolean,
        "is_active": boolean
      } | null,
      "isAcknowledged": boolean | null,
      "labels": [
        {
          "id": "string",
          "name": "string",
          "color": "string",
          "createdAt": "datetime",
          "updatedAt": "datetime"
        }
      ],
      "startedAt": "datetime | null",
      "dueAt": "datetime | null",
      "deferredDetails": {
        "deferredAt": "datetime",
        "deferredTill": "datetime",
        "deferredBy": { "id": "string", "name": "string" }
      } | null,
      "in_watchlist": boolean | null,
      "createdAt": "datetime",
      "updatedAt": "datetime | null",
      "createdBy": { "id": "string", "name": "string" },
      "updatedBy": { "id": "string", "name": "string" } | null
    }
  ]
}
```

#### Get Task by ID
```
GET /v1/tasks/{task_id}
```

#### Create Task
```
POST /v1/tasks
```

Request Body:
```json
{
  "title": "string (required)",
  "description": "string | null",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "status": "TODO" | "IN_PROGRESS" | "DEFERRED" | "BLOCKED" | "DONE",
  "assignee": object | null,
  "labels": ["string"],
  "dueAt": "datetime | null"
}
```

#### Update Task
```
PATCH /v1/tasks/{task_id}
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| action | string | Action to perform: 'update' or 'defer' |

Request Body:
```json
{
  "title": "string",
  "description": "string | null",
  "priority": "HIGH" | "MEDIUM" | "LOW" | null,
  "status": "TODO" | "IN_PROGRESS" | "DEFERRED" | "BLOCKED" | "DONE" | null,
  "assignee": object | null,
  "labels": ["string"] | null,
  "dueAt": "datetime | null",
  "startedAt": "datetime | null",
  "isAcknowledged": boolean
}
```

#### Delete Task
```
DELETE /v1/tasks/{task_id}
```

### Task Assignments

#### Create Task Assignment
```
POST /v1/task-assignments
```

Request Body:
```json
{
  "task_id": "string (required)",
  "assignee_id": "string (required)",
  "user_type": "user" | "team" (required)
}
```

#### Get Task Assignment
```
GET /v1/task-assignments/{task_id}
```

#### Update Task Assignment (Set Executor)
```
PATCH /v1/task-assignments/{task_id}
```

Request Body:
```json
{
  "executor_id": "string"
}
```

#### Delete Task Assignment
```
DELETE /v1/task-assignments/{task_id}
```

### Watchlist

#### Get Watchlist Tasks
```
GET /v1/watchlist/tasks
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default: 1) |
| limit | integer | Tasks per page (default: 10, max: 100) |

#### Add Task to Watchlist
```
POST /v1/watchlist/tasks
```

Request Body:
```json
{
  "taskId": "string (required)"
}
```

#### Update Watchlist Task Status
```
PATCH /v1/watchlist/tasks/{task_id}
```

Request Body:
```json
{
  "isActive": boolean
}
```

#### Check Task in Watchlist
```
GET /v1/watchlist/tasks/check?task_id={task_id}
```

### Teams

#### Get Teams
```
GET /v1/teams
```

Returns teams assigned to the authenticated user.

#### Create Team
```
POST /v1/teams
```

Request Body:
```json
{
  "name": "string (required, max 100)",
  "description": "string (max 500)",
  "member_ids": ["string"],
  "poc_id": "string | null"
}
```

#### Get Team by ID
```
GET /v1/teams/{team_id}
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| member | boolean | If true, returns team members instead of team details |

#### Update Team
```
PATCH /v1/teams/{team_id}
```

Request Body:
```json
{
  "name": "string",
  "description": "string | null",
  "poc_id": "string | null",
  "member_ids": ["string"]
}
```

#### Add Team Members
```
POST /v1/teams/{team_id}/members
```

Request Body:
```json
{
  "member_ids": ["string"] (required, min 1)
}
```

#### Join Team by Invite Code
```
POST /v1/teams/join-by-invite
```

Request Body:
```json
{
  "invite_code": "string (required)"
}
```

### Users

#### Get Users / Search
```
GET /v1/users
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| profile | string | Set to 'true' to get current user profile |
| search | string | Search query for name or email (fuzzy search) |
| page | integer | Page number (default: 1) |
| limit | integer | Results per page (default: 10, max: 100) |

Response:
```json
{
  "users": [
    {
      "id": "string",
      "name": "string",
      "email_id": "string",
      "created_at": "datetime",
      "updated_at": "datetime | null"
    }
  ],
  "total_count": integer,
  "page": integer,
  "limit": integer
}
```

### Labels

#### Get Labels
```
GET /v1/labels
```

### Roles

#### Get Roles
```
GET /v1/roles
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| is_active | boolean | Filter by active status |
| name | string | Filter by role name |
| scope | string | Filter by scope (GLOBAL/TEAM) |

#### Create Role
```
POST /v1/roles
```

#### Get Role by ID
```
GET /v1/roles/{role_id}
```

#### Update Role
```
PATCH /v1/roles/{role_id}
```

#### Delete Role
```
DELETE /v1/roles/{role_id}
```

### Health

#### Health Check
```
GET /v1/health
```

Response:
```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP"
    }
  }
}
```

## Data Types

### Priority
- `HIGH` (1)
- `MEDIUM` (2)
- `LOW` (3)

### Status
- `TODO`
- `IN_PROGRESS`
- `DEFERRED`
- `BLOCKED`
- `DONE`

### User Type (for assignments)
- `user`
- `team`

### Role Scope
- `GLOBAL`
- `TEAM`

## Error Response Format

```json
{
  "statusCode": integer,
  "message": "string",
  "errors": [
    {
      "source": { "parameter": "string" } | null,
      "title": "string | null",
      "detail": "string | null"
    }
  ],
  "authenticated": boolean | null
}
```
