'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserMinus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UnassignButtonProps {
  taskId: string;
  variant?: 'icon' | 'full';
}

export function UnassignButton({ taskId, variant = 'icon' }: UnassignButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleUnassign = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/unassign`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to unassign task');
      }

      router.refresh();
    } catch (error) {
      console.error('Error unassigning task:', error);
      alert('Failed to unassign task');
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnassign}
        disabled={isLoading}
        className="text-destructive hover:text-destructive"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <UserMinus className="h-4 w-4 mr-1" />
        )}
        Unassign
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleUnassign}
      disabled={isLoading}
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      title="Unassign task"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <UserMinus className="h-4 w-4" />
      )}
    </Button>
  );
}
