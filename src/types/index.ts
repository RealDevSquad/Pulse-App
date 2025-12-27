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
