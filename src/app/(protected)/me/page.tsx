import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function MePage() {
  const session = await getSession();
  
  // Session is guaranteed by layout, but TypeScript doesn't know that
  if (!session?.userId) {
    redirect('/login');
  }
  
  // Redirect to the logged-in user's member page
  redirect(`/member/${session.userId}`);
}
