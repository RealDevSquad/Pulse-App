/**
 * Script to inspect the actual schema of a user document in Firestore
 * Run with: npx ts-node --transpile-only scripts/inspect-user-schema.ts
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
      // Remove surrounding quotes if present
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

  const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

const app = getFirebaseAdmin();
const db = getFirestore(app);

const USER_ID = 'XAF7rSUvk4p0d098qWYS';

async function inspectUserSchema() {
  console.log(`Fetching user document: ${USER_ID}\n`);

  try {
    const userDoc = await db.collection('users').doc(USER_ID).get();

    if (!userDoc.exists) {
      console.log('User document not found');
      return;
    }

    const data = userDoc.data();
    console.log('User Document Schema:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(50));

    console.log('\nField Types:');
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        const type = value?.constructor?.name || typeof value;
        console.log(`  ${key}: ${type}`);
      }
    }
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}

inspectUserSchema();
