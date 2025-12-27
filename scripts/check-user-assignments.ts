/**
 * Script to check task assignments for a specific user
 * Two sources:
 * 1. Task request approvals (type='taskRequests' with status='APPROVED' and approvedTo=userId)
 * 2. Superuser direct assignments (type='task' with body.new.assignee=userId)
 * 
 * Run with: pnpm exec tsx scripts/check-user-assignments.ts
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

const USER_ID = 'nQejNoqDSdnDoxm4rTuE';

async function checkUserAssignments() {
  console.log(`Checking task assignments for user: ${USER_ID}\n`);
  console.log('='.repeat(60));

  // Get user info first
  const userDoc = await db.collection('users').doc(USER_ID).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    console.log(`User: ${userData?.first_name} ${userData?.last_name} (@${userData?.username})`);
  }
  console.log('='.repeat(60));

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  // Source 1: Task request approvals where user is approvedTo
  console.log('\n📋 SOURCE 1: Task Request Approvals (approvedTo = userId)\n');
  
  const taskRequestsSnapshot = await db.collection('logs')
    .where('meta.userId', '==', USER_ID)
    .where('timestamp', '>=', threeYearsAgo)
    .orderBy('timestamp', 'desc')
    .get();

  let approvalCount = 0;
  const approvals: Array<{
    id: string;
    date: string;
    taskTitle: string;
    status: string;
  }> = [];

  for (const doc of taskRequestsSnapshot.docs) {
    const data = doc.data();
    if (data.type === 'taskRequests') {
      const status = data.body?.status;
      const approvedTo = data.body?.approvedTo;
      
      if ((status === 'APPROVED' || data.meta?.subAction === 'approve') && approvedTo === USER_ID) {
        approvalCount++;
        const timestamp = data.timestamp?._seconds ? data.timestamp._seconds * 1000 : 0;
        approvals.push({
          id: doc.id,
          date: new Date(timestamp).toISOString().split('T')[0],
          taskTitle: data.body?.taskTitle || data.meta?.taskTitle || '(unknown)',
          status: status || 'APPROVED',
        });
      }
    }
  }

  console.log(`Found ${approvalCount} task request approval(s):`);
  if (approvals.length > 0) {
    console.table(approvals.slice(0, 20)); // Show first 20
    if (approvals.length > 20) {
      console.log(`... and ${approvals.length - 20} more`);
    }
  }

  // Source 2: Superuser direct assignments (body.new.assignee = userId)
  console.log('\n👤 SOURCE 2: Superuser Direct Assignments (body.new.assignee = userId)\n');
  
  let superuserAssignmentCount = 0;
  const superuserAssignments: Array<{
    id: string;
    date: string;
    taskTitle: string;
    assignedBy: string;
  }> = [];

  try {
    // Try the indexed query first
    const assignmentSnapshot = await db.collection('logs')
      .where('type', '==', 'task')
      .where('body.new.assignee', '==', USER_ID)
      .where('timestamp', '>=', threeYearsAgo)
      .orderBy('timestamp', 'desc')
      .get();

    for (const doc of assignmentSnapshot.docs) {
      const data = doc.data();
      const timestamp = data.timestamp?._seconds ? data.timestamp._seconds * 1000 : 0;
      superuserAssignments.push({
        id: doc.id,
        date: new Date(timestamp).toISOString().split('T')[0],
        taskTitle: data.body?.taskTitle || data.meta?.taskTitle || '(unknown)',
        assignedBy: data.meta?.username || data.meta?.userId || '(unknown)',
      });
    }
    superuserAssignmentCount = superuserAssignments.length;

  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    if (err.code === '9' || err.message?.includes('index')) {
      console.log('⚠️  Index not yet created. Falling back to client-side filtering...\n');
      
      // Fallback: fetch recent task logs and filter client-side
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const allTaskLogs = await db.collection('logs')
        .where('type', '==', 'task')
        .where('timestamp', '>=', thirtyDaysAgo)
        .orderBy('timestamp', 'desc')
        .limit(2000)
        .get();
      
      for (const doc of allTaskLogs.docs) {
        const data = doc.data();
        if (data.body?.new?.assignee === USER_ID) {
          const timestamp = data.timestamp?._seconds ? data.timestamp._seconds * 1000 : 0;
          superuserAssignments.push({
            id: doc.id,
            date: new Date(timestamp).toISOString().split('T')[0],
            taskTitle: data.body?.taskTitle || data.meta?.taskTitle || '(unknown)',
            assignedBy: data.meta?.username || data.meta?.userId || '(unknown)',
          });
        }
      }
      superuserAssignmentCount = superuserAssignments.length;
      console.log(`(Searched ${allTaskLogs.size} task logs from last 30 days)`);
    } else {
      throw error;
    }
  }

  console.log(`Found ${superuserAssignmentCount} superuser assignment(s):`);
  if (superuserAssignments.length > 0) {
    console.table(superuserAssignments.slice(0, 20));
    if (superuserAssignments.length > 20) {
      console.log(`... and ${superuserAssignments.length - 20} more`);
    }
  }

  // Check current tasks assigned to this user
  console.log('\n📌 CURRENT TASKS (where assignee = userId)\n');
  
  const tasksSnapshot = await db.collection('tasks')
    .where('assignee', '==', USER_ID)
    .get();
  
  console.log(`Found ${tasksSnapshot.size} task(s) currently assigned to this user:`);
  if (tasksSnapshot.size > 0) {
    const tasks = tasksSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt ? new Date(data.createdAt * 1000).toISOString().split('T')[0] : 'N/A';
      return {
        id: doc.id,
        title: (data.title || '(no title)').substring(0, 40),
        status: data.status,
        createdAt,
      };
    });
    console.table(tasks.slice(0, 10));
    
      // Check logs for the first task (without ordering to avoid index)
    if (tasksSnapshot.docs.length > 0) {
      const taskId = tasksSnapshot.docs[0].id;
      const taskData = tasksSnapshot.docs[0].data();
      
      console.log(`\n🔍 Task details for: ${taskId}\n`);
      console.log(`  Title: ${taskData.title}`);
      console.log(`  Assignee: ${taskData.assignee}`);
      console.log(`  CreatedBy: ${taskData.createdBy || 'N/A'}`);
      console.log(`  CreatedAt: ${taskData.createdAt ? new Date(taskData.createdAt * 1000).toISOString() : 'N/A'}`);
      
      console.log(`\n🔍 Checking ALL logs for task: ${taskId}\n`);
      
      const taskLogs = await db.collection('logs')
        .where('meta.taskId', '==', taskId)
        .limit(50)
        .get();
      
      // Sort client-side
      const sortedLogs = taskLogs.docs
        .map(doc => ({ doc, timestamp: doc.data().timestamp?._seconds || 0 }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`Found ${taskLogs.size} log(s) for this task:`);
      for (const { doc } of sortedLogs) {
        const data = doc.data();
        const timestamp = data.timestamp?._seconds ? new Date(data.timestamp._seconds * 1000).toISOString() : 'N/A';
        const newAssignee = data.body?.new?.assignee;
        const newStatus = data.body?.new?.status;
        const approvedTo = data.body?.approvedTo;
        console.log(`  ${timestamp} | type: ${data.type} | by: ${data.meta?.username || 'N/A'} | newAssignee: ${newAssignee || '-'} | approvedTo: ${approvedTo || '-'} | newStatus: ${newStatus || '-'}`);
      }
      
      // Check if there's a taskRequest for this task
      console.log(`\n🔍 Checking taskRequests for this task...\n`);
      const taskRequestLogs = await db.collection('logs')
        .where('type', '==', 'taskRequests')
        .where('body.taskId', '==', taskId)
        .limit(20)
        .get();
      
      console.log(`Found ${taskRequestLogs.size} taskRequest log(s):`);
      for (const doc of taskRequestLogs.docs) {
        const data = doc.data();
        const timestamp = data.timestamp?._seconds ? new Date(data.timestamp._seconds * 1000).toISOString() : 'N/A';
        console.log(`  ${timestamp} | status: ${data.body?.status} | requestedBy: ${data.body?.requestedBy || 'N/A'} | approvedTo: ${data.body?.approvedTo || '-'}`);
      }
    }
  }

  // Check all logs for this user
  console.log('\n📊 ALL LOGS (where meta.userId = userId, last 30 days)\n');
  
  const allUserLogs = await db.collection('logs')
    .where('meta.userId', '==', USER_ID)
    .where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .orderBy('timestamp', 'desc')
    .get();
  
  const logTypes = new Map<string, number>();
  for (const doc of allUserLogs.docs) {
    const type = doc.data().type || 'unknown';
    logTypes.set(type, (logTypes.get(type) || 0) + 1);
  }
  
  console.log(`Found ${allUserLogs.size} log(s) by this user:`);
  console.log('Log types:', Object.fromEntries(logTypes));

  // Check if ANY logs have body.new.assignee set (to verify data exists)
  console.log('\n🔬 DEBUGGING: Checking if ANY logs have body.new.assignee set...\n');
  
  const thirtyDaysAgo2 = new Date();
  thirtyDaysAgo2.setDate(thirtyDaysAgo2.getDate() - 30);
  
  const recentTaskLogs = await db.collection('logs')
    .where('type', '==', 'task')
    .where('timestamp', '>=', thirtyDaysAgo2)
    .limit(500)
    .get();
  
  let logsWithAssignee = 0;
  const assigneeExamples: Array<{ id: string; assignee: string; by: string }> = [];
  
  for (const doc of recentTaskLogs.docs) {
    const data = doc.data();
    if (data.body?.new?.assignee) {
      logsWithAssignee++;
      if (assigneeExamples.length < 5) {
        assigneeExamples.push({
          id: doc.id,
          assignee: data.body.new.assignee,
          by: data.meta?.username || 'N/A',
        });
      }
    }
  }
  
  console.log(`Out of ${recentTaskLogs.size} task logs, ${logsWithAssignee} have body.new.assignee set`);
  if (assigneeExamples.length > 0) {
    console.log('Examples:');
    console.table(assigneeExamples);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Task Request Approvals: ${approvalCount}`);
  console.log(`Superuser Assignments:  ${superuserAssignmentCount}`);
  console.log(`─`.repeat(30));
  console.log(`Total Tasks Assigned:   ${approvalCount + superuserAssignmentCount}`);
}

checkUserAssignments().catch(console.error);
