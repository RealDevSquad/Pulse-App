'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapse, StaggerContainer, StaggerItem, HoverLift } from '@/components/ui/motion';
import type { FutureStatusEntry } from '@/lib/ooo-cache';

interface FutureStatusSectionProps {
  entries: FutureStatusEntry[];
}

function getInitials(firstName?: string, lastName?: string, username?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '??';
}

function formatDate(timestamp: number, from?: number): string {
  // If until is ~1 year from start, treat as indefinite
  if (from && timestamp - from >= 364 * 24 * 60 * 60 * 1000) {
    return 'Indefinite';
  }
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return 'Started';
  } else if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Tomorrow';
  } else if (days < 7) {
    return `In ${days} days`;
  } else if (days < 30) {
    return `In ${Math.ceil(days / 7)} weeks`;
  } else {
    return `In ${Math.ceil(days / 30)} months`;
  }
}

function getStateBadge(state: string) {
  switch (state.toUpperCase()) {
    case 'OOO':
      return { label: 'OOO', className: 'border-orange-500 text-orange-600 bg-transparent' };
    case 'ONBOARDING':
      return { label: 'Onboarding', className: 'border-blue-500 text-blue-600 bg-transparent' };
    case 'IDLE':
      return { label: 'Idle', className: 'border-gray-500 text-gray-600 bg-transparent' };
    case 'ACTIVE':
      return { label: 'Active', className: 'border-green-500 text-green-600 bg-transparent' };
    default:
      return { label: state, className: 'border-gray-500 text-gray-600 bg-transparent' };
  }
}

export function FutureStatusSection({ entries }: FutureStatusSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Scheduled Status Changes
          <Badge variant="secondary" className="ml-2">
            {entries.length}
          </Badge>
          <ChevronDown
            className={`h-5 w-5 ml-auto text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </CardTitle>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <CardContent>
          <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => {
              const stateBadge = getStateBadge(entry.state);
              const startsIn = formatRelativeDate(entry.from);

              return (
                <StaggerItem key={entry.id}>
                  <HoverLift lift={2} scale={1.01}>
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <Link href={`/member/${entry.userId}`}>
                        <Avatar className="h-10 w-10 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
                          <AvatarImage src={entry.user?.picture?.url} alt={entry.user?.username} />
                          <AvatarFallback className="text-xs">
                            {getInitials(entry.user?.first_name, entry.user?.last_name, entry.user?.username)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link 
                            href={`/member/${entry.userId}`}
                            className="font-medium truncate hover:text-primary hover:underline transition-colors"
                          >
                            {entry.user?.first_name} {entry.user?.last_name}
                          </Link>
                          <Badge variant="outline" className={stateBadge.className}>
                            {stateBadge.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(entry.from)} - {formatDate(entry.until, entry.from)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Starts: <span className="font-medium text-foreground">{startsIn}</span>
                          </span>
                        </div>
                        {entry.message && (
                          <p className="text-xs text-muted-foreground truncate" title={entry.message}>
                            {entry.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </HoverLift>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </CardContent>
      </Collapse>
    </Card>
  );
}
