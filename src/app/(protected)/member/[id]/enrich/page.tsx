import { getSession } from '@/lib/auth';
import { isAdminUser } from '@/lib/users';
import { db } from '@/lib/firebase-admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MemberEnrichmentForm } from '@/components/member-enrichment-form';
import { MemberEnrichmentHistory } from '@/components/member-enrichment-history';
import type { User } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function EnrichMemberPage({ params }: PageProps) {
  const [session, { id }] = await Promise.all([getSession(), params]);

  // Check admin (super_user) access
  if (!session?.userId || !(await isAdminUser(session.userId))) {
    redirect('/');
  }

  // Fetch user data
  const userDoc = await db.collection('users').doc(id).get();

  if (!userDoc.exists) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">404 - Member Not Found</h1>
        <p className="text-muted-foreground">The member you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild>
          <Link href="/members">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Members
          </Link>
        </Button>
      </div>
    );
  }

  const user = { id: userDoc.id, ...userDoc.data() } as User;
  const memberName = `${user.first_name} ${user.last_name}`.trim() || user.username;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/member/${id}`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Link>
      </Button>

      {/* Header with member info */}
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
          <AvatarImage src={user.picture?.url} alt={user.username} />
          <AvatarFallback className="text-lg">
            {getInitials(user.first_name, user.last_name, user.username)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Enrich Member Profile</h1>
          <p className="text-muted-foreground">
            {memberName} <span className="text-sm">@{user.username}</span>
          </p>
        </div>
      </div>

      {/* Enrichment Form */}
      <MemberEnrichmentForm targetUserId={id} memberName={memberName} />

      {/* Enrichment History */}
      <MemberEnrichmentHistory targetUserId={id} />
    </div>
  );
}
