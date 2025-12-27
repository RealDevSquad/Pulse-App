/**
 * Script to inspect the tasks collection in Firestore
 * Run with: npx ts-node --transpile-only scripts/inspect-tasks.ts
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

  const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

const app = getFirebaseAdmin();
const db = getFirestore(app);

async function inspectTasks() {
  console.log('Listing all collections...\n');

  const collections = await db.listCollections();
  console.log('Available collections:');
  for (const col of collections) {
    console.log(`  - ${col.id}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Checking tasks collection...\n');

  try {
    const tasksSnapshot = await db.collection('tasks').limit(3).get();

    if (tasksSnapshot.empty) {
      console.log('No documents found in tasks collection');
      return;
    }

    console.log(`Found ${tasksSnapshot.size} task documents (showing up to 3):\n`);

    for (const doc of tasksSnapshot.docs) {
      console.log(`Document ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log('-'.repeat(50));
    }

    // Show field types from first doc
    const firstDoc = tasksSnapshot.docs[0].data();
    console.log('\nField Types (from first document):');
    for (const [key, value] of Object.entries(firstDoc)) {
      const type = value?.constructor?.name || typeof value;
      console.log(`  ${key}: ${type}`);
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
  }
}

inspectTasks();
