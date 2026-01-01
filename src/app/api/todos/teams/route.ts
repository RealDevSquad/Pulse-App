import { NextResponse } from 'next/server';
import { MOCK_TEAMS } from '@/lib/mock/todos';

/**
 * Local API route for teams - returns mock data in development.
 * 
 * Production endpoint: https://services.realdevsquad.com/todo/v1/teams
 * 
 * This mock route allows developers to work on the Teams feature
 * without needing production authentication.
 */
export async function GET() {
  // Add a small delay to simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 100));

  return NextResponse.json({
    teams: MOCK_TEAMS,
    total: MOCK_TEAMS.length,
  });
}
