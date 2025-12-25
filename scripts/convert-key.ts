import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createPublicKey } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');

// Parse multiline env value
const regex = /JWT_PUBLIC_KEY=("[\s\S]*?"|'[\s\S]*?'|[^\n]*)/m;
const match = envContent.match(regex);

if (!match) {
  console.error('JWT_PUBLIC_KEY not found in .env.local');
  process.exit(1);
}

let publicKey = match[1];
if ((publicKey.startsWith('"') && publicKey.endsWith('"')) ||
    (publicKey.startsWith("'") && publicKey.endsWith("'"))) {
  publicKey = publicKey.slice(1, -1);
}
publicKey = publicKey.replace(/\\n/g, '\n');

console.log('=== Original Key ===\n');
console.log(publicKey);
console.log('\n=== Key Info ===\n');

if (publicKey.includes('RSA PUBLIC KEY')) {
  console.log('Format: PKCS#1 (RSA PUBLIC KEY)');
  console.log('Converting to SPKI format...\n');

  const keyObject = createPublicKey({
    key: publicKey,
    format: 'pem',
  });

  const spkiKey = keyObject.export({ type: 'spki', format: 'pem' }) as string;

  console.log('=== Converted SPKI Key ===\n');
  console.log(spkiKey);

  // Single line version for .env
  const singleLine = spkiKey.replace(/\n/g, '\\n');
  console.log('\n=== For .env.local (single line) ===\n');
  console.log(`JWT_PUBLIC_KEY="${singleLine}"`);
} else if (publicKey.includes('BEGIN PUBLIC KEY')) {
  console.log('Format: SPKI (PUBLIC KEY) - already correct format!');
} else {
  console.log('Format: Unknown');
}
