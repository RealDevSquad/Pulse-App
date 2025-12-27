/**
 * Script to find tasks with ASSIGNED status but no assignee or no title
 * Run with: npx ts-node --transpile-only scripts/find-bad-tasks.ts
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

async function findBadTasks() {
  console.log('Finding tasks with ASSIGNED status but no assignee or no title...\n');

  const snapshot = await db.collection('tasks')
    .where('status', '==', 'ASSIGNED')
    .get();

  console.log(`Total ASSIGNED tasks: ${snapshot.size}\n`);

  const badTasks: Array<{
    id: string;
    title: string;
    assignee: string;
    status: string;
    updatedAt: number | undefined;
    createdAt: number | undefined;
  }> = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.assignee || !data.title) {
      badTasks.push({
        id: doc.id,
        title: data.title || '(no title)',
        assignee: data.assignee || '(no assignee)',
        status: data.status,
        updatedAt: data.updatedAt,
        createdAt: data.createdAt
      });
    }
  });

  if (badTasks.length === 0) {
    console.log('No bad tasks found!');
    return;
  }

  console.log(`Found ${badTasks.length} bad task(s):\n`);
  console.log(JSON.stringify(badTasks, null, 2));
}

findBadTasks().catch(console.error);
