import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, importSPKI, errors as joseErrors } from 'jose';

/**
 * JWT verification result
 */
type VerifyResult = 
  | { valid: true }
  | { valid: false; reason: 'expired' | 'invalid' | 'malformed' | 'config_error' };

/**
 * Verify JWT token and return structured result
 */
async function verifyToken(token: string): Promise<VerifyResult> {
  const publicKeyPem = process.env.JWT_PUBLIC_KEY;

  if (!publicKeyPem) {
    console.error('JWT_PUBLIC_KEY not set');
    return { valid: false, reason: 'config_error' };
  }

  try {
    // Key must be in SPKI format (-----BEGIN PUBLIC KEY-----)
    // Use scripts/convert-key.ts to convert RSA PUBLIC KEY to SPKI
    const key = await importSPKI(publicKeyPem, 'RS256');
    await jwtVerify(token, key);
    return { valid: true };
  } catch (e) {
    // Handle specific JWT errors
    if (e instanceof joseErrors.JWTExpired) {
      // Token has expired - user needs to re-login
      console.info('JWT expired for request');
      return { valid: false, reason: 'expired' };
    }
    
    if (e instanceof joseErrors.JWTClaimValidationFailed) {
      // Token claims validation failed (nbf, iat, etc.)
      console.warn('JWT claim validation failed:', e.claim, e.reason);
      return { valid: false, reason: 'invalid' };
    }
    
    if (e instanceof joseErrors.JWSSignatureVerificationFailed) {
      // Signature doesn't match - token was tampered with or wrong key
      console.warn('JWT signature verification failed');
      return { valid: false, reason: 'invalid' };
    }
    
    if (e instanceof joseErrors.JWTInvalid) {
      // Token format is invalid
      console.warn('JWT format invalid:', e.message);
      return { valid: false, reason: 'malformed' };
    }

    // Unknown error - log full details
    console.error('Token verification failed with unexpected error:', e);
    return { valid: false, reason: 'invalid' };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/health'];
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
    return NextResponse.json({ error: 'Unauthorized', code: 'NO_TOKEN' }, { status: 401 });
  }

  const result = await verifyToken(token);

  if (!result.valid) {
    // For browser requests, redirect to login
    if (!pathname.startsWith('/api/')) {
      const loginUrl = new URL('/login', request.url);
      
      // Add reason as query param so login page can show appropriate message
      if (result.reason === 'expired') {
        loginUrl.searchParams.set('reason', 'session_expired');
      }
      
      return NextResponse.redirect(loginUrl);
    }
    
    // For API requests, return appropriate error
    const errorMessages: Record<string, { message: string; code: string }> = {
      expired: { message: 'Session expired. Please login again.', code: 'TOKEN_EXPIRED' },
      invalid: { message: 'Invalid token', code: 'TOKEN_INVALID' },
      malformed: { message: 'Malformed token', code: 'TOKEN_MALFORMED' },
      config_error: { message: 'Server configuration error', code: 'CONFIG_ERROR' },
    };
    
    const { message, code } = errorMessages[result.reason];
    return NextResponse.json({ error: message, code }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
