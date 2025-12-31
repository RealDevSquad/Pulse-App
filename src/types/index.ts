import type { Timestamp } from 'firebase-admin/firestore';

// =============================================================================
// Firestore Document Types
// These types represent the exact shape of documents in Firestore collections
// =============================================================================

export namespace Firestore {
  /**
   * User role flags
   */
  export interface UserRoles {
    /** Is a Real Dev Squad member */
    member: boolean;
    /** Has admin privileges */
    admin: boolean;
    /** Has super user privileges */
    super_user: boolean;
    /** Is present in Discord server */
    in_discord: boolean;
    /** Account is archived/inactive */
    archived: boolean;
    /** Is a developer */
    developer?: boolean;
    /** Is a designer */
    designer?: boolean;
  }

  /**
   * Cloudinary profile picture
   */
  export interface UserPicture {
    /** Full Cloudinary URL */
    url: string;
    /** Cloudinary public ID for transformations */
    publicId: string;
  }

  /**
   * User document from `users` collection
   * @collection users
   * @example Document ID: "XAF7rSUvk4p0d098qWYS"
   */
  export interface User {
    /** Firestore document ID */
    id: string;
    /** Unique username (e.g., "ankush") */
    username: string;
    /** First name */
    first_name: string;
    /** Last name */
    last_name: string;
    /** Email address */
    email?: string;
    /** Phone with country code (e.g., "+919873998335") */
    phone?: string;
    /** Current status (e.g., "idle", "active", "ooo") */
    status: string;
    /** Job title (e.g., "SDE") */
    designation?: string;
    /** Company short name */
    company?: string;
    /** Full company name */
    company_name?: string;
    /** Years of experience as string */
    yoe?: string;
    /** Personal website URL */
    website?: string;
    /** RDS identity profile URL */
    profileURL?: string;

    // GitHub
    /** GitHub username */
    github_id: string;
    /** GitHub numeric user ID */
    github_user_id?: string;
    /** GitHub display name */
    github_display_name?: string;
    /** GitHub account creation timestamp (ms since epoch) */
    github_created_at?: number;

    // Social Media
    /** Twitter/X username */
    twitter_id?: string;
    /** LinkedIn username */
    linkedin_id?: string;
    /** Instagram username */
    instagram_id?: string;
    /** Discord user ID */
    discordId?: string;
    /** Discord server join date (ISO string) */
    discordJoinedAt?: string;

    // Profile
    /** Cloudinary profile picture */
    picture?: UserPicture;
    /** User role flags */
    roles: UserRoles;

    // Metadata
    /** Account creation timestamp (ms since epoch) */
    created_at: number;
    /** Last update timestamp (ms since epoch) */
    updated_at: number;
    /** Whether user profile is incomplete */
    incompleteUserDetails?: boolean;
    /** Email subscription status */
    isSubscribed?: boolean;
    /** Internal chaincode identifier */
    chaincode?: string;
  }

  /**
   * OOO (Out of Office) request from `requests` collection
   * @collection requests (where type === "OOO")
   */
  export interface OOORequest {
    id: string;
    /** User who requested OOO */
    requestedBy: string;
    /** Start date (ms since epoch) */
    from: number;
    /** End date (ms since epoch) */
    until: number;
    /** Request type */
    type: 'OOO';
    /** Reason for OOO */
    reason: string;
    /** Optional comment */
    comment: string | null;
    /** Request status */
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    /** User who last modified the request */
    lastModifiedBy: string | null;
    /** Creation timestamp (ms since epoch) */
    createdAt: number;
    /** Last update timestamp (ms since epoch) */
    updatedAt: number;
  }

  /**
   * User status from `usersStatus` collection
   * @collection usersStatus
   */
  export interface UserStatus {
    id: string;
    userId: string;
    currentStatus: {
      state: 'OOO' | 'ONBOARDING' | 'ACTIVE' | 'IDLE' | string;
      from?: number;
      until?: number | string;
      message?: string;
      updatedAt?: number;
    };
    futureStatus?: Record<string, unknown>;
    monthlyHours?: {
      committed: number;
    };
    lastOooUntil?: number | null;
  }

  /**
   * Task document from `tasks` collection
   * @collection tasks
   */
  export interface Task {
    id: string;
    title: string;
    /** Task type (e.g., "feature", "bug") */
    type?: string;
    /** Task priority */
    priority?: string;
    /** Task status */
    status: 'ASSIGNED' | 'IN_PROGRESS' | 'BLOCKED' | 'NEEDS_REVIEW' | 'COMPLETED' | 'BACKLOG' | 'TODO' | 'VERIFIED' | 'MERGED' | 'SANITY_CHECK' | 'DONE';
    /** Percent completed (0-100) */
    percentCompleted?: number;
    /** User ID of assignee */
    assignee?: string;
    /** User ID of creator */
    createdBy?: string;
    /** Creation timestamp (seconds since epoch) */
    createdAt?: number;
    /** Last update timestamp (seconds since epoch) */
    updatedAt?: number;
    /** Alternative last update timestamp (ms since epoch) */
    updated_at?: number;
    /** Start timestamp (seconds since epoch) */
    startedOn?: number;
    /** End/due timestamp (seconds since epoch) */
    endsOn?: number;
    /** GitHub issue info */
    github?: {
      issue?: {
        id?: number;
        url?: string;
        html_url?: string;
        status?: string;
        assignee?: string;
      };
    };
  }

  /**
   * Task update/comment from `taskUpdates` collection
   * @collection taskUpdates
   */
  export interface TaskUpdate {
    id: string;
    taskId: string;
    content: string;
    createdAt: Timestamp;
  }

  /**
   * Progress update from `progresses` collection
   * @collection progresses
   */
  export interface Progress {
    id: string;
    /** Type of progress (e.g., "task") */
    type: string;
    /** Associated task ID */
    taskId: string;
    /** User who submitted the progress */
    userId: string;
    /** Completed work description */
    completed: string;
    /** Planned work description */
    planned: string;
    /** Blockers description */
    blockers: string;
    /** Creation timestamp (ms since epoch) */
    createdAt: number;
    /** Date of the progress (ms since epoch) */
    date: number;
  }
}

// =============================================================================
// Convenience type aliases
// =============================================================================

export type User = Firestore.User;
export type OOORequest = Firestore.OOORequest;
export type UserStatus = Firestore.UserStatus;
export type Task = Firestore.Task;
export type TaskUpdate = Firestore.TaskUpdate;
export type Progress = Firestore.Progress;
export type TaskStatus = Firestore.Task['status'];
export type OOOStatus = Firestore.OOORequest['status'];

// =============================================================================
// TODO API Types (from todo-backend service)
// Base URL: https://services.realdevsquad.com/todo
// =============================================================================

export namespace TodoAPI {
  /** Task priority levels */
  export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
  
  /** Priority as numeric value (1=HIGH, 2=MEDIUM, 3=LOW) */
  export type PriorityNumber = 1 | 2 | 3;

  /** Task status */
  export type Status = 'TODO' | 'IN_PROGRESS' | 'DEFERRED' | 'BLOCKED' | 'DONE';

  /** Assignee type */
  export type UserType = 'user' | 'team';

  /** User info in TODO system */
  export interface TodoUser {
    id: string;
    name: string;
    addedOn?: string | null;
    tasksAssignedCount?: number | null;
  }

  /** Label attached to a task */
  export interface Label {
    id: string;
    name: string;
    color: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    createdBy?: TodoUser | null;
    updatedBy?: TodoUser | null;
  }

  /** Assignee info for a task */
  export interface Assignee {
    id: string;
    name: string;
    relation_type: UserType;
    is_action_taken: boolean;
    is_active: boolean;
  }

  /** Deferred task details */
  export interface DeferredDetails {
    deferredAt: string;
    deferredTill: string;
    deferredBy: TodoUser;
  }

  /** Task from TODO API */
  export interface Todo {
    id: string;
    displayId: string;
    title: string;
    description?: string | null;
    priority?: PriorityNumber | null;
    status?: Status | null;
    assignee?: Assignee | null;
    isAcknowledged?: boolean | null;
    labels: Label[];
    startedAt?: string | null;
    dueAt?: string | null;
    deferredDetails?: DeferredDetails | null;
    in_watchlist?: boolean | null;
    createdAt: string;
    updatedAt?: string | null;
    createdBy: TodoUser;
    updatedBy?: TodoUser | null;
  }

  /** Pagination links */
  export interface Links {
    next?: string | null;
    prev?: string | null;
  }

  /** GET /v1/tasks response */
  export interface GetTodosResponse {
    links?: Links | null;
    error?: object | null;
    tasks: Todo[];
  }

  /** Team info */
  export interface Team {
    id: string;
    name: string;
    description?: string | null;
    poc_id?: string | null;
    invite_code: string;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
    users?: unknown[] | null;
  }

  /** User search result */
  export interface UserSearchResult {
    id: string;
    name: string;
    email_id: string;
    created_at: string;
    updated_at?: string | null;
  }

  /** GET /v1/users response */
  export interface UserSearchResponse {
    users: UserSearchResult[];
    total_count: number;
    page: number;
    limit: number;
  }

  /** Task assignment */
  export interface TaskAssignment {
    id: string;
    task_id: string;
    assignee_id: string;
    user_type: UserType;
    assignee_name: string;
    is_active: boolean;
    created_by: string;
    updated_by?: string | null;
    created_at: string;
    updated_at?: string | null;
  }

  /** Watchlist task */
  export interface WatchlistTask {
    taskId: string;
    displayId: string;
    title: string;
    description?: string | null;
    priority?: number | null;
    status?: string | null;
    isAcknowledged?: boolean | null;
    isDeleted?: boolean | null;
    labels: unknown[];
    dueAt?: string | null;
    createdAt: string;
    createdBy: string;
    watchlistId: string;
  }

  /** GET /v1/watchlist/tasks response */
  export interface GetWatchlistResponse {
    links?: Links | null;
    error?: object | null;
    tasks: WatchlistTask[];
  }
}

// Convenience exports
export type Todo = TodoAPI.Todo;
export type TodoStatus = TodoAPI.Status;
export type TodoPriority = TodoAPI.Priority;
