'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, EyeOff, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MemberHideMenuProps {
  userId: string;
  isHidden: boolean;
  username?: string;
}

export function MemberHideMenu({ userId, isHidden, username }: MemberHideMenuProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleHide = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    try {
      const response = await fetch('/api/members/hidden-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: isHidden ? 'show' : 'hide',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update hidden status');
      }

      // Refresh the page to reflect the change
      router.refresh();
    } catch (error) {
      console.error('Error toggling hide status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleToggleHide} disabled={isLoading}>
          {isHidden ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Show {username ? `@${username}` : 'user'}
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide {username ? `@${username}` : 'user'}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
