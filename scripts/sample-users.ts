/**
 * Script to sample users from Firestore and analyze available fields
 * Run with: npx ts-node --transpile-only scripts/sample-users.ts
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIRESTORE_CONFIG;
  if (!serviceAccountJson) {
    throw new Error('FIRESTORE_CONFIG environment variable is not set');
  }

  // Handle newlines in private key
  let sanitizedJson = serviceAccountJson;
  let inString = false;
  let escaped = false;
  let result = '';
  for (const char of sanitizedJson) {
    if (escaped) { result += char; escaped = false; continue; }
    if (char === '\\') { escaped = true; result += char; continue; }
    if (char === '"') { inString = !inString; result += char; continue; }
    if (inString && char === '\n') { result += '\\n'; }
    else if (inString && char === '\r') { result += '\\r'; }
    else { result += char; }
  }

  const serviceAccount = JSON.parse(result) as ServiceAccount;
  return initializeApp({ credential: cert(serviceAccount) });
}

const app = getFirebaseAdmin();
const db = getFirestore(app);

async function sampleUsers() {
  console.log('Sampling users from Firestore...\n');

  const snapshot = await db.collection('users').limit(10).get();

  console.log(`Found ${snapshot.size} users\n`);

  // Collect all fields across all users
  const fieldCounts: Record<string, number> = {};
  const fieldSamples: Record<string, any[]> = {};

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    Object.entries(data).forEach(([key, value]) => {
      fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      if (!fieldSamples[key]) fieldSamples[key] = [];
      if (fieldSamples[key].length < 3 && value !== undefined && value !== null && value !== '') {
        fieldSamples[key].push(value);
      }
    });
  });

  // Sort by frequency
  const sortedFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log('Fields available (sorted by frequency):');
  console.log('='.repeat(80));

  sortedFields.forEach(([field, count]) => {
    const samples = fieldSamples[field]
      ?.map(s => typeof s === 'object' ? JSON.stringify(s).slice(0, 50) : String(s).slice(0, 50))
      .join(' | ');
    console.log(`${field} (${count}/${snapshot.size})`);
    console.log(`  Samples: ${samples}`);
  });

  // Suggest columns for the table
  console.log('\n' + '='.repeat(80));
  console.log('SUGGESTED COLUMNS FOR MEMBERS TABLE:');
  console.log('='.repeat(80));
  const suggested = [
    'picture.url - Profile photo',
    'username - Username',
    'first_name + last_name - Full name',
    'github_id - GitHub',
    'designation - Role/Title',
    'company_name - Company',
    'status - Status',
    'roles.admin/super_user - Admin badge',
    'created_at - Member since',
  ];
  suggested.forEach(s => console.log(`  - ${s}`));
}

sampleUsers().catch(console.error);
