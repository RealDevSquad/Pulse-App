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

### Extension Request Object

```json
{
  "id": "string",
  "taskId": "string",
  "assignee": "userId",
  "oldEndsOn": "epoch",
  "newEndsOn": "epoch",
  "reason": "string",
  "status": "PENDING | APPROVED | DENIED"
}
```

---

## OOO (Out of Office) API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/requests?type=OOO` | Get OOO requests |

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
