'use client';

import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, MoreVertical, EyeOff, Eye } from 'lucide-react';
import Link from 'next/link';
import type { IdleUser } from './availability-panel';

interface AvailabilityUserCardProps {
  user: IdleUser;
  isAssigning?: boolean;
  assignedTaskTitle?: string;
  isHidden?: boolean;
  onToggleHide?: (userId: string, hide: boolean) => void;
}

export function AvailabilityUserCard({
  user,
  isAssigning,
  assignedTaskTitle,
  isHidden,
  onToggleHide,
}: AvailabilityUserCardProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `user-${user.id}`,
    data: {
      type: 'user',
      user,
    },
  });

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || '?';

  return (
    <Card
      ref={setNodeRef}
      className={`transition-all ${
        isOver
          ? 'ring-2 ring-primary bg-primary/5 scale-[1.02]'
          : 'hover:shadow-md'
      } ${isAssigning ? 'opacity-50 pointer-events-none' : ''} ${isHidden ? 'opacity-60 bg-muted/50' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/member/${user.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
              <AvatarImage
                src={user.picture?.url}
                alt={`${user.first_name} ${user.last_name}`}
              />
              <AvatarFallback>
                {initials || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
          </Link>
          <Link
            href={`/member/${user.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 group"
          >
            <p className="font-medium text-sm truncate group-hover:text-primary group-hover:underline transition-colors">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{user.username}
            </p>
          </Link>
          {isAssigning ? (
            <Badge variant="secondary" className="shrink-0">
              Assigning...
            </Badge>
          ) : assignedTaskTitle ? (
            <Badge variant="default" className="shrink-0 max-w-32 truncate">
              Assigned
            </Badge>
          ) : isHidden ? (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              Hidden
            </Badge>
          ) : user.isOnboarding ? (
            <Badge
              variant="outline"
              className={`shrink-0 ${isOver ? 'bg-primary text-primary-foreground' : 'border-amber-500 text-amber-600'}`}
            >
              {isOver ? 'Drop here' : 'Onboarding'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={`shrink-0 ${isOver ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {isOver ? 'Drop here' : 'Idle'}
            </Badge>
          )}

          {/* Three dots menu */}
          {onToggleHide && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHide(user.id, !isHidden);
                  }}
                >
                  {isHidden ? (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show user
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide user
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
