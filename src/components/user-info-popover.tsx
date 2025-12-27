'use client';

import { useState, useRef } from 'react';
import { Info, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface UserInfoPopoverProps {
  userId: string;
}

export function UserInfoPopover({ userId }: UserInfoPopoverProps) {
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUserData = async () => {
    if (userData || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data = await response.json();
      setUserData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
    fetchUserData();
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="inline-flex items-center justify-center rounded-full p-1 hover:bg-muted transition-colors"
          aria-label="View user details"
        >
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-h-96 overflow-auto"
        align="start"
        onMouseEnter={() => timeoutRef.current && clearTimeout(timeoutRef.current)}
        onMouseLeave={handleMouseLeave}
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive py-4 text-center">
            {error}
          </div>
        )}
        {userData && !loading && (
          <pre className="text-xs whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(userData, null, 2)}
          </pre>
        )}
      </PopoverContent>
    </Popover>
  );
}
