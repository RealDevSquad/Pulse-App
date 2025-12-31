import { NextRequest, NextResponse } from 'next/server';
import { getSearchSuggestions } from '@/lib/users-cache';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';

  try {
    const suggestions = await getSearchSuggestions(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
