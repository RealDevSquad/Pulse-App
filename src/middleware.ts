import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, importSPKI } from 'jose';

async function verifyTokenMiddleware(token: string): Promise<boolean> {
  const publicKeyPem = process.env.JWT_PUBLIC_KEY;

  if (!publicKeyPem) {
    console.error('JWT_PUBLIC_KEY not set');
    return false;
  }

  try {
    // Key must be in SPKI format (-----BEGIN PUBLIC KEY-----)
    // Use scripts/convert-key.ts to convert RSA PUBLIC KEY to SPKI
    const key = await importSPKI(publicKeyPem, 'RS256');
    await jwtVerify(token, key);
    return true;
  } catch (e) {
    console.error('Token verification failed:', e);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/api/health'];
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for token in cookie, Authorization header, or dev token
  const cookieName = process.env.JWT_AUTH_COOKIE_NAME || 'rds-session';
  const devToken = process.env.DEV_ONLY_JWT_TOKEN; // Available in dev via .env.local
  const cookieToken = request.cookies.get(cookieName)?.value;
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = cookieToken || authHeader || devToken;

  if (!token) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isValid = await verifyTokenMiddleware(token);

  if (!isValid) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
