/**
 * Script to debug overdue tasks
 * Run with: pnpm exec tsx scripts/debug-overdue.ts
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

// Status categories (matching tasks-cache.ts)
const ACTIVE_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];
const BLOCKED_STATUSES = ['BLOCKED'];
const REVIEW_STATUSES = ['NEEDS_REVIEW', 'SANITY_CHECK', 'VERIFIED', 'MERGED'];
const ACTIVE_WORK_STATUSES = [...ACTIVE_STATUSES, ...BLOCKED_STATUSES, ...REVIEW_STATUSES];

async function debugOverdue() {
  const now = Math.floor(Date.now() / 1000);
  console.log('Current time (seconds):', now);
  console.log('Current date:', new Date(now * 1000).toISOString());
  console.log('');

  // Get all tasks
  const tasksSnapshot = await db.collection('tasks').get();
  console.log('Total tasks in DB:', tasksSnapshot.size);
  
  let overdueCount = 0;
  let sampleTasks: any[] = [];
  const statusCounts: Record<string, number> = {};

  tasksSnapshot.docs.forEach(doc => {
    const task = doc.data();
    const status = task.status?.toUpperCase();
    const assignee = task.assignee;
    const endsOn = task.endsOn;

    // Check if it would be overdue (with corrected logic)
    if (assignee && ACTIVE_WORK_STATUSES.includes(status) && endsOn) {
      const endsOnSeconds = endsOn > 1e12 ? Math.floor(endsOn / 1000) : endsOn;
      if (endsOnSeconds < now) {
        overdueCount++;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (sampleTasks.length < 10) {
          sampleTasks.push({
            id: doc.id,
            title: task.title?.substring(0, 60),
            status,
            assignee,
            endsOn,
            endsOnSeconds,
            endsOnDate: new Date(endsOnSeconds * 1000).toISOString(),
          });
        }
      }
    }
  });

  console.log('Total overdue tasks (active work only):', overdueCount);
  console.log('By status:', statusCounts);
  console.log('');
  console.log('Sample overdue tasks:');
  sampleTasks.forEach(t => {
    console.log(`- ${t.id}`);
    console.log(`  Title: ${t.title}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Assignee: ${t.assignee}`);
    console.log(`  endsOn raw: ${t.endsOn}`);
    console.log(`  endsOn (seconds): ${t.endsOnSeconds}`);
    console.log(`  endsOn (date): ${t.endsOnDate}`);
    console.log('');
  });

  // Check tasks without endsOn that have assignees
  let noEndsOnCount = 0;
  tasksSnapshot.docs.forEach(doc => {
    const task = doc.data();
    if (task.assignee && !task.endsOn && ACTIVE_WORK_STATUSES.includes(task.status?.toUpperCase())) {
      noEndsOnCount++;
    }
  });
  console.log('Active work tasks with assignee but NO endsOn:', noEndsOnCount);

  // Check different endsOn formats
  console.log('\n--- endsOn format analysis ---');
  let msCount = 0;
  let secCount = 0;
  let nullCount = 0;
  tasksSnapshot.docs.forEach(doc => {
    const task = doc.data();
    if (task.endsOn === null || task.endsOn === undefined) {
      nullCount++;
    } else if (task.endsOn > 1e12) {
      msCount++;
    } else {
      secCount++;
    }
  });
  console.log('endsOn in milliseconds:', msCount);
  console.log('endsOn in seconds:', secCount);
  console.log('endsOn null/undefined:', nullCount);
}

debugOverdue().catch(console.error);
