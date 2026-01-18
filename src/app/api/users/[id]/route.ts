import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { isRootUser, isAdminUser } from '@/lib/users';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ id }, isRoot, isAdmin] = await Promise.all([
    params,
    isRootUser(session.userId),
    isAdminUser(session.userId),
  ]);

  // Must be at least an admin
  if (!isRoot && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const userDoc = await db.collection('users').doc(id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Return consistent response format for both root and admin users.
    // Root users get full data (including sensitive fields like email, phone, tokens)
    // because they need it for administrative operations and debugging.
    // Admin users only get display fields needed for UI components (autocomplete, avatars).
    const user = isRoot
      ? { id: userDoc.id, ...userData }
      : {
          id: userDoc.id,
          username: userData?.username,
          first_name: userData?.first_name,
          last_name: userData?.last_name,
          picture: userData?.picture,
        };

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
