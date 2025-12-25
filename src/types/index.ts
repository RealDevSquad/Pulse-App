import type { Timestamp } from 'firebase-admin/firestore';

export interface User {
  id: string;
  githubId: string;
  username: string;
  role: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: Timestamp;
}

export interface OOORecord {
  id: string;
  userId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  reason?: string;
  createdAt: Timestamp;
}

export interface Task {
  id: string;
  externalId?: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'UNDER_REVIEW' | 'COMPLETED';
  assigneeId: string;
  lastUpdated: Timestamp;
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  content: string;
  createdAt: Timestamp;
}

export type TaskStatus = Task['status'];
export type UserRole = User['role'];
