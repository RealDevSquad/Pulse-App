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

getFirebaseAdmin();
const db = getFirestore();

async function inspectLogs() {
  console.log('Fetching 500 logs for deep analysis...\n');
  
  const snapshot = await db
    .collection('logs')
    .orderBy('timestamp', 'desc')
    .limit(500)
    .get();

  console.log(`Fetched ${snapshot.size} logs\n`);

  // Detailed analysis
  const typeCount = new Map<string, number>();
  const subTypeCount = new Map<string, number>();
  const statusChanges = new Map<string, number>(); // Track status transitions
  const uniqueUsers = new Set<string>();
  const uniqueTasks = new Set<string>();
  const dailyActivity = new Map<string, number>();
  const taskUpdateFields = new Map<string, number>(); // What fields are being updated
  const extensionRequestReasons = new Map<string, number>();
  
  // For org health metrics
  let taskStatusUpdates = 0;
  let progressUpdates = 0;
  let extensionRequests = 0;
  let profileUpdates = 0;
  let taskRequests = 0;
  let rejections = 0;
  let approvals = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const type = data.type || 'unknown';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
    
    // Track users
    if (data.meta?.userId) uniqueUsers.add(data.meta.userId);
    if (data.meta?.taskId) uniqueTasks.add(data.meta.taskId);
    
    // Track daily activity
    if (data.timestamp?._seconds) {
      const date = new Date(data.timestamp._seconds * 1000).toISOString().split('T')[0];
      dailyActivity.set(date, (dailyActivity.get(date) || 0) + 1);
    }
    
    // Analyze by type
    switch (type) {
      case 'task':
        taskStatusUpdates++;
        if (data.body?.subType) {
          subTypeCount.set(`task:${data.body.subType}`, (subTypeCount.get(`task:${data.body.subType}`) || 0) + 1);
        }
        // Track what's being updated
        if (data.body?.new) {
          for (const field of Object.keys(data.body.new)) {
            taskUpdateFields.set(field, (taskUpdateFields.get(field) || 0) + 1);
          }
          // Track status changes
          if (data.body.new.status) {
            statusChanges.set(data.body.new.status, (statusChanges.get(data.body.new.status) || 0) + 1);
          }
        }
        break;
      case 'taskRequests':
        taskRequests++;
        if (data.body?.status === 'APPROVED') approvals++;
        if (data.meta?.subAction) {
          subTypeCount.set(`taskRequests:${data.meta.subAction}`, (subTypeCount.get(`taskRequests:${data.meta.subAction}`) || 0) + 1);
        }
        break;
      case 'extensionRequests':
        extensionRequests++;
        break;
      case 'USER_DETAILS_UPDATED':
        profileUpdates++;
        // Track what profile fields are updated
        if (data.body) {
          for (const field of Object.keys(data.body)) {
            subTypeCount.set(`profile:${field}`, (subTypeCount.get(`profile:${field}`) || 0) + 1);
          }
        }
        break;
      case 'REQUEST_REJECTED':
        rejections++;
        break;
      case 'REQUEST_APPROVED':
        approvals++;
        break;
    }
  }

  console.log('=== LOG TYPES (sorted by frequency) ===');
  const sortedTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    const pct = ((count / snapshot.size) * 100).toFixed(1);
    console.log(`  ${type}: ${count} (${pct}%)`);
  }

  console.log('\n=== SUBTYPES & DETAILS ===');
  const sortedSubTypes = Array.from(subTypeCount.entries()).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedSubTypes) {
    console.log(`  ${key}: ${count}`);
  }

  console.log('\n=== TASK STATUS CHANGES ===');
  const sortedStatuses = Array.from(statusChanges.entries()).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sortedStatuses) {
    console.log(`  → ${status}: ${count}`);
  }

  console.log('\n=== TASK UPDATE FIELDS ===');
  const sortedFields = Array.from(taskUpdateFields.entries()).sort((a, b) => b[1] - a[1]);
  for (const [field, count] of sortedFields) {
    console.log(`  ${field}: ${count}`);
  }

  console.log('\n=== ORG HEALTH METRICS (from 500 logs) ===');
  console.log(`  Unique active users: ${uniqueUsers.size}`);
  console.log(`  Unique tasks touched: ${uniqueTasks.size}`);
  console.log(`  Task status updates: ${taskStatusUpdates}`);
  console.log(`  Task requests: ${taskRequests}`);
  console.log(`  Extension requests: ${extensionRequests}`);
  console.log(`  Profile updates: ${profileUpdates}`);
  console.log(`  Approvals: ${approvals}`);
  console.log(`  Rejections: ${rejections}`);

  console.log('\n=== DAILY ACTIVITY (last 7 days) ===');
  const sortedDays = Array.from(dailyActivity.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  for (const [date, count] of sortedDays) {
    console.log(`  ${date}: ${count} events`);
  }

  // Sample interesting logs
  console.log('\n=== SAMPLE: Task Status Changes ===');
  let sampleCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.type === 'task' && data.body?.new?.status) {
      const ts = data.timestamp?._seconds ? new Date(data.timestamp._seconds * 1000).toISOString() : 'N/A';
      console.log(`  [${ts}] Task ${data.meta?.taskId} → ${data.body.new.status} by @${data.meta?.username}`);
      sampleCount++;
      if (sampleCount >= 5) break;
    }
  }

  console.log('\n=== SAMPLE: Extension Requests ===');
  sampleCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.type === 'extensionRequests') {
      const ts = data.timestamp?._seconds ? new Date(data.timestamp._seconds * 1000).toISOString() : 'N/A';
      const oldEnd = data.body?.oldEndsOn ? new Date(data.body.oldEndsOn * 1000).toISOString().split('T')[0] : 'N/A';
      const newEnd = data.body?.newEndsOn ? new Date(data.body.newEndsOn * 1000).toISOString().split('T')[0] : 'N/A';
      console.log(`  [${ts}] Task ${data.meta?.taskId}: ${oldEnd} → ${newEnd}`);
      sampleCount++;
      if (sampleCount >= 5) break;
    }
  }

  console.log('\n=== SAMPLE: Task Requests ===');
  sampleCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.type === 'taskRequests') {
      const ts = data.timestamp?._seconds ? new Date(data.timestamp._seconds * 1000).toISOString() : 'N/A';
      const action = data.meta?.action || 'unknown';
      const subAction = data.meta?.subAction || '';
      console.log(`  [${ts}] ${action}${subAction ? ':' + subAction : ''} - Status: ${data.body?.status}`);
      if (data.body?.taskTitle) console.log(`    Title: ${data.body.taskTitle.slice(0, 60)}...`);
      sampleCount++;
      if (sampleCount >= 5) break;
    }
  }

  // Analyze member productivity patterns
  console.log('\n=== MEMBER PRODUCTIVITY ANALYSIS ===');
  const memberActivity = new Map<string, { tasks: number; progress: number; extensions: number; username: string }>();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = data.meta?.userId;
    const username = data.meta?.username || 'unknown';
    if (!userId) continue;
    
    if (!memberActivity.has(userId)) {
      memberActivity.set(userId, { tasks: 0, progress: 0, extensions: 0, username });
    }
    const member = memberActivity.get(userId)!;
    if (data.meta?.username) member.username = data.meta.username;
    
    switch (data.type) {
      case 'task':
        member.tasks++;
        if (data.body?.new?.percentCompleted) member.progress++;
        break;
      case 'extensionRequests':
        member.extensions++;
        break;
    }
  }

  // Sort by activity
  const sortedMembers = Array.from(memberActivity.entries())
    .filter(([_, m]) => m.tasks > 0 || m.extensions > 0)
    .sort((a, b) => (b[1].tasks + b[1].progress) - (a[1].tasks + a[1].progress))
    .slice(0, 10);

  console.log('  Top 10 active members (in this sample):');
  for (const [userId, stats] of sortedMembers) {
    console.log(`    @${stats.username}: ${stats.tasks} task updates, ${stats.progress} progress updates, ${stats.extensions} extension requests`);
  }

  // Look for potential health indicators
  console.log('\n=== POTENTIAL HEALTH INDICATORS ===');
  
  // Members with many extension requests (might be struggling)
  const highExtensions = Array.from(memberActivity.entries())
    .filter(([_, m]) => m.extensions >= 2)
    .sort((a, b) => b[1].extensions - a[1].extensions);
  
  if (highExtensions.length > 0) {
    console.log('  Members with multiple extension requests:');
    for (const [_, stats] of highExtensions) {
      console.log(`    @${stats.username}: ${stats.extensions} extensions`);
    }
  }

  // Task completion rate
  const completedCount = statusChanges.get('COMPLETED') || 0;
  const doneCount = statusChanges.get('DONE') || 0;
  const inProgressCount = statusChanges.get('IN_PROGRESS') || 0;
  const blockedCount = statusChanges.get('BLOCKED') || 0;
  
  console.log('\n  Task flow in this sample:');
  console.log(`    Started (IN_PROGRESS): ${inProgressCount}`);
  console.log(`    Completed (COMPLETED/DONE): ${completedCount + doneCount}`);
  console.log(`    Blocked: ${blockedCount}`);
  console.log(`    Completion rate: ${((completedCount + doneCount) / Math.max(inProgressCount, 1) * 100).toFixed(1)}%`);
}

inspectLogs().catch(console.error);
