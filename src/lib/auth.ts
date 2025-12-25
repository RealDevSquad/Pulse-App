import { jwtVerify, importSPKI } from 'jose';
import { cookies } from 'next/headers';
import { createPublicKey } from 'crypto';

export interface JWTPayload {
  userId: string;
  username?: string;
  role?: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';
  exp: number;
  iat: number;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const publicKeyPem = process.env.JWT_PUBLIC_KEY;

  if (!publicKeyPem) {
    throw new Error('JWT_PUBLIC_KEY environment variable is not set');
  }

  try {
    // Handle both RSA PUBLIC KEY and PUBLIC KEY formats
    // Convert RSA PUBLIC KEY (PKCS#1) to SPKI format if needed
    let spkiKey = publicKeyPem;
    if (publicKeyPem.includes('RSA PUBLIC KEY')) {
      const keyObject = createPublicKey({
        key: publicKeyPem,
        format: 'pem',
      });
      spkiKey = keyObject.export({ type: 'spki', format: 'pem' }) as string;
    }

    const key = await importSPKI(spkiKey, 'RS256');
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const cookieName = process.env.JWT_AUTH_COOKIE_NAME || 'rds-session';
  const devToken = process.env.NODE_ENV === 'development' ? process.env.DEV_ONLY_JWT_TOKEN : undefined;
  const token = cookieStore.get(cookieName)?.value || devToken;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireAuth();

  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }

  return session;
}
