'use client';

import { usePathname } from 'next/navigation';

const PAGE_LABELS: Record<string, string> = {
  '/rds': 'Dashboard',
  '/members': 'Members',
  '/tasks': 'Tasks',
  '/todos': 'Todos',
  '/ooo': 'Out of Office',
  '/availability': 'Availability',
  '/extension-requests': 'Extension Requests',
  '/task-requests': 'Task Requests',
  '/settings': 'Settings',
  '/me': 'My Profile',
};

export function PageBreadcrumb() {
  const pathname = usePathname();

  // Check for exact match first
  if (PAGE_LABELS[pathname]) {
    return <span className="text-sm font-medium text-muted-foreground">{PAGE_LABELS[pathname]}</span>;
  }

  // Check for member detail pages
  if (pathname.startsWith('/member/')) {
    if (pathname.endsWith('/report')) {
      return <span className="text-sm font-medium text-muted-foreground">Member Report</span>;
    }
    if (pathname.endsWith('/enrich')) {
      return <span className="text-sm font-medium text-muted-foreground">Member Enrichment</span>;
    }
    return <span className="text-sm font-medium text-muted-foreground">Member Profile</span>;
  }

  // Check for task detail pages
  if (pathname.startsWith('/task/')) {
    return <span className="text-sm font-medium text-muted-foreground">Task Details</span>;
  }

  return <span className="text-sm font-medium text-muted-foreground">Dashboard</span>;
}
