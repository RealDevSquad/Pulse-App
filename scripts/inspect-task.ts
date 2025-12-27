/**
 * Script to inspect all logs and updates for a specific task
 * Run with: pnpm exec tsx scripts/inspect-task.ts
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

const TASK_ID = 'qtqRto3byDpurFEtzt8Z';

async function inspectTask() {
  console.log(`Inspecting task: ${TASK_ID}\n`);
  console.log('='.repeat(80));

  // Get the task document
  const taskDoc = await db.collection('tasks').doc(TASK_ID).get();
  
  if (!taskDoc.exists) {
    console.log('Task not found!');
    return;
  }

  const taskData = taskDoc.data()!;
  console.log('\n📋 TASK DOCUMENT\n');
  console.log(`  Title: ${taskData.title}`);
  console.log(`  Status: ${taskData.status}`);
  console.log(`  Assignee: ${taskData.assignee}`);
  console.log(`  CreatedBy: ${taskData.createdBy || 'N/A'}`);
  console.log(`  CreatedAt: ${taskData.createdAt ? new Date(taskData.createdAt * 1000).toISOString() : 'N/A'}`);
  console.log(`  UpdatedAt: ${taskData.updatedAt ? new Date(taskData.updatedAt * 1000).toISOString() : 'N/A'}`);
  console.log(`  StartedOn: ${taskData.startedOn ? new Date(taskData.startedOn * 1000).toISOString() : 'N/A'}`);
  console.log(`  EndsOn: ${taskData.endsOn ? new Date(taskData.endsOn * 1000).toISOString() : 'N/A'}`);

  // Get assignee info
  if (taskData.assignee) {
    const assigneeDoc = await db.collection('users').doc(taskData.assignee).get();
    if (assigneeDoc.exists) {
      const assigneeData = assigneeDoc.data()!;
      console.log(`  Assignee Name: ${assigneeData.first_name} ${assigneeData.last_name} (@${assigneeData.username})`);
    }
  }

  // Get all logs for this task
  console.log('\n' + '='.repeat(80));
  console.log('\n📜 ALL LOGS FOR THIS TASK\n');

  const logsSnapshot = await db.collection('logs')
    .where('meta.taskId', '==', TASK_ID)
    .limit(100)
    .get();

  // Sort by timestamp
  const logs = logsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => {
      const aTs = a.timestamp?._seconds || 0;
      const bTs = b.timestamp?._seconds || 0;
      return aTs - bTs;
    });

  console.log(`Found ${logs.length} log(s):\n`);

  for (const log of logs as any[]) {
    const timestamp = log.timestamp?._seconds 
      ? new Date(log.timestamp._seconds * 1000).toISOString() 
      : 'N/A';
    
    console.log(`─`.repeat(80));
    console.log(`  Timestamp: ${timestamp}`);
    console.log(`  Type: ${log.type}`);
    console.log(`  Log ID: ${log.id}`);
    console.log(`  meta.userId: ${log.meta?.userId || 'N/A'}`);
    console.log(`  meta.username: ${log.meta?.username || 'N/A'}`);
    
    if (log.body) {
      console.log(`  body:`);
      if (log.body.new) {
        console.log(`    new.status: ${log.body.new.status || '-'}`);
        console.log(`    new.assignee: ${log.body.new.assignee || '-'}`);
        console.log(`    new.percentCompleted: ${log.body.new.percentCompleted ?? '-'}`);
        console.log(`    new.endsOn: ${log.body.new.endsOn ? new Date(log.body.new.endsOn * 1000).toISOString() : '-'}`);
      }
      if (log.body.old) {
        console.log(`    old.status: ${log.body.old.status || '-'}`);
        console.log(`    old.assignee: ${log.body.old.assignee || '-'}`);
      }
      if (log.body.status) {
        console.log(`    status: ${log.body.status}`);
      }
      if (log.body.approvedTo) {
        console.log(`    approvedTo: ${log.body.approvedTo}`);
      }
      if (log.body.requestedBy) {
        console.log(`    requestedBy: ${log.body.requestedBy}`);
      }
    }
    console.log('');
  }

  // Check for task requests related to this task
  console.log('='.repeat(80));
  console.log('\n📝 TASK REQUESTS FOR THIS TASK\n');

  const taskRequestsSnapshot = await db.collection('logs')
    .where('type', '==', 'taskRequests')
    .where('body.taskId', '==', TASK_ID)
    .limit(50)
    .get();

  const taskRequests = taskRequestsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => {
      const aTs = a.timestamp?._seconds || 0;
      const bTs = b.timestamp?._seconds || 0;
      return aTs - bTs;
    });

  console.log(`Found ${taskRequests.length} task request log(s):\n`);

  for (const req of taskRequests as any[]) {
    const timestamp = req.timestamp?._seconds 
      ? new Date(req.timestamp._seconds * 1000).toISOString() 
      : 'N/A';
    
    console.log(`─`.repeat(80));
    console.log(`  Timestamp: ${timestamp}`);
    console.log(`  Log ID: ${req.id}`);
    console.log(`  meta.userId: ${req.meta?.userId || 'N/A'}`);
    console.log(`  meta.username: ${req.meta?.username || 'N/A'}`);
    console.log(`  body.status: ${req.body?.status || 'N/A'}`);
    console.log(`  body.requestedBy: ${req.body?.requestedBy || 'N/A'}`);
    console.log(`  body.approvedTo: ${req.body?.approvedTo || 'N/A'}`);
    console.log('');
  }

  // Summary
  console.log('='.repeat(80));
  console.log('\n📊 SUMMARY\n');
  
  // Find first IN_PROGRESS status change
  const firstInProgress = (logs as any[]).find(l => l.body?.new?.status === 'IN_PROGRESS');
  if (firstInProgress) {
    const ts = firstInProgress.timestamp?._seconds 
      ? new Date(firstInProgress.timestamp._seconds * 1000).toISOString() 
      : 'N/A';
    console.log(`  First IN_PROGRESS: ${ts} by ${firstInProgress.meta?.username || 'N/A'}`);
  }

  // Find assignment events
  const assignmentLogs = (logs as any[]).filter(l => l.body?.new?.assignee);
  if (assignmentLogs.length > 0) {
    console.log(`  Assignment changes:`);
    for (const al of assignmentLogs) {
      const ts = al.timestamp?._seconds 
        ? new Date(al.timestamp._seconds * 1000).toISOString() 
        : 'N/A';
      console.log(`    ${ts}: assigned to ${al.body.new.assignee} by ${al.meta?.username || 'N/A'}`);
    }
  } else {
    console.log(`  No assignment changes found in logs`);
  }

  // Find approved task requests
  const approvedRequests = (taskRequests as any[]).filter(r => r.body?.status === 'APPROVED');
  if (approvedRequests.length > 0) {
    console.log(`  Approved task requests:`);
    for (const ar of approvedRequests) {
      const ts = ar.timestamp?._seconds 
        ? new Date(ar.timestamp._seconds * 1000).toISOString() 
        : 'N/A';
      console.log(`    ${ts}: approved to ${ar.body.approvedTo} by ${ar.meta?.username || 'N/A'}`);
    }
  }
}

inspectTask().catch(console.error);
