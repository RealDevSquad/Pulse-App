import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
const envPath = resolve(__dirname, '../.env.local');
let envContent: string;
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch {
  console.error('.env.local file not found');
  process.exit(1);
}

// Parse environment variables (handles multiline values in quotes)
function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  // Match KEY="value" or KEY='value' or KEY=value, handling multiline quoted values
  const regex = /^([A-Z_][A-Z0-9_]*)=("[\s\S]*?"|'[\s\S]*?'|[^\n]*)/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    let value = match[2];

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Convert escaped newlines to actual newlines
    value = value.replace(/\\n/g, '\n');

    env[key] = value;
  }

  return env;
}

const env = parseEnv(envContent);

console.log('=== Dev Token Check ===\n');

// Check DEV_ONLY_JWT_TOKEN
const devToken = env['DEV_ONLY_JWT_TOKEN'];
if (devToken) {
  console.log('✅ DEV_ONLY_JWT_TOKEN is set');
  console.log(`   Value: "${devToken}"`);
} else {
  console.log('❌ DEV_ONLY_JWT_TOKEN is NOT set');
}

// Check JWT_AUTH_COOKIE_NAME
const cookieName = env['JWT_AUTH_COOKIE_NAME'];
if (cookieName) {
  console.log(`✅ JWT_AUTH_COOKIE_NAME is set: "${cookieName}"`);
} else {
  console.log('⚠️  JWT_AUTH_COOKIE_NAME not set (will default to "rds-session")');
}

// Check JWT_PUBLIC_KEY
const publicKey = env['JWT_PUBLIC_KEY'];
if (publicKey) {
  console.log('✅ JWT_PUBLIC_KEY is set');
  console.log(`   Length: ${publicKey.length} characters`);
  if (publicKey.includes('BEGIN PUBLIC KEY')) {
    console.log('   Type: RSA Public Key (PEM format)');
  }
} else {
  console.log('❌ JWT_PUBLIC_KEY is NOT set');
}

// Check NODE_ENV
console.log(`\n📍 NODE_ENV would be: "${process.env.NODE_ENV || 'undefined (defaults to development in Next.js dev)'}"`);

// Try to decode JWT (without verification)
if (devToken && devToken.includes('.')) {
  console.log('\n=== JWT Decode ===\n');
  try {
    const parts = devToken.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      console.log('Header:', JSON.stringify(header, null, 2));
      console.log('Payload:', JSON.stringify(payload, null, 2));

      // Check expiration
      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        if (expDate > now) {
          console.log(`\n✅ Token expires: ${expDate.toISOString()} (valid)`);
        } else {
          console.log(`\n❌ Token EXPIRED: ${expDate.toISOString()}`);
        }
      }
    }
  } catch (e) {
    console.log('Failed to decode JWT:', e);
  }
}

// Try verification with jose
console.log('\n=== JWT Verification ===\n');
if (devToken && publicKey) {
  try {
    const { jwtVerify, importSPKI } = await import('jose');
    const { createPublicKey } = await import('crypto');

    // Convert RSA PUBLIC KEY (PKCS#1) to SPKI format if needed
    let spkiKey = publicKey;
    if (publicKey.includes('RSA PUBLIC KEY')) {
      console.log('Converting RSA PUBLIC KEY (PKCS#1) to SPKI format...');
      const keyObject = createPublicKey({
        key: publicKey,
        format: 'pem',
      });
      spkiKey = keyObject.export({ type: 'spki', format: 'pem' }) as string;
      console.log('Converted successfully');
    }

    const key = await importSPKI(spkiKey, 'RS256');
    console.log('Using PUBLIC key for verification (RS256)');

    const { payload } = await jwtVerify(devToken, key);
    console.log('✅ Token verified successfully!');
    console.log('Payload:', JSON.stringify(payload, null, 2));
  } catch (e: unknown) {
    const error = e as Error;
    console.log('❌ Token verification failed:', error.message);
  }
} else if (!publicKey) {
  console.log('❌ Cannot verify - JWT_PUBLIC_KEY not set');
}

console.log('\n=== Summary ===\n');

if (devToken && publicKey) {
  console.log('✅ Dev token verified successfully!\n');

  // Check if key needs to be reformatted for Next.js
  if (publicKey.includes('\n') && !envContent.includes('JWT_PUBLIC_KEY="-----BEGIN')) {
    console.log('⚠️  JWT_PUBLIC_KEY is multiline. For Next.js, use single line with \\n:');
    const singleLine = publicKey.replace(/\n/g, '\\n');
    console.log(`\nJWT_PUBLIC_KEY="${singleLine}"\n`);
  }

  console.log('Restart the dev server: pnpm dev');
} else if (!devToken) {
  console.log('Add DEV_ONLY_JWT_TOKEN to .env.local');
} else if (!publicKey) {
  console.log('Add JWT_PUBLIC_KEY to .env.local');
}

process.exit(0);
