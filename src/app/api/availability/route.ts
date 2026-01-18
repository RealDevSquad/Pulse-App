import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const RDS_API_BASE = 'https://api.realdevsquad.com';

export async function GET() {
  const cookieStore = await cookies();
  const cookieName = process.env.JWT_AUTH_COOKIE_NAME || 'rds-session';
  const sessionCookie = cookieStore.get(cookieName)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all tasks, idle users, and onboarding users in parallel
    // Note: status-nextjs fetches all tasks then filters client-side
    const [tasksRes, idleUsersRes, onboardingUsersRes] = await Promise.all([
      fetch(`${RDS_API_BASE}/tasks?size=100`, {
        headers: { Cookie: `${cookieName}=${sessionCookie}` },
      }),
      fetch(`${RDS_API_BASE}/users/search?state=IDLE`, {
        headers: { Cookie: `${cookieName}=${sessionCookie}` },
      }),
      fetch(`${RDS_API_BASE}/users/search?state=ONBOARDING`, {
        headers: { Cookie: `${cookieName}=${sessionCookie}` },
      }),
    ]);

    if (!tasksRes.ok || !idleUsersRes.ok) {
      console.error('[availability API] Failed to fetch:', {
        tasks: tasksRes.status,
        idleUsers: idleUsersRes.status,
        onboardingUsers: onboardingUsersRes.status,
      });
      return NextResponse.json(
        { error: 'Failed to fetch availability data' },
        { status: 500 }
      );
    }

    const [tasksData, idleUsersData, onboardingUsersData] = await Promise.all([
      tasksRes.json(),
      idleUsersRes.json(),
      onboardingUsersRes.ok ? onboardingUsersRes.json() : { users: [] },
    ]);

    // Filter for BACKLOG feature tasks (different from status-nextjs which uses AVAILABLE)
    const tasks = (tasksData.tasks || []).filter(
      (task: { status?: string; type?: string }) => {
        const status = task.status?.toUpperCase();
        const type = task.type?.toLowerCase();
        return status === 'BACKLOG' && type === 'feature';
      }
    );

    // Mark idle users
    const idleUsers = (idleUsersData.users || []).map((user: Record<string, unknown>) => ({
      ...user,
      isOnboarding: false,
    }));

    // Mark onboarding users
    const onboardingUsers = (onboardingUsersData.users || []).map((user: Record<string, unknown>) => ({
      ...user,
      isOnboarding: true,
    }));

    // Combine all users
    const users = [...idleUsers, ...onboardingUsers];

    return NextResponse.json({ tasks, users });
  } catch (error) {
    console.error('[availability API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability data' },
      { status: 500 }
    );
  }
}
