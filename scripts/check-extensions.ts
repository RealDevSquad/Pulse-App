/**
 * Script to check extension requests for a user
 * Run with: pnpm exec tsx scripts/check-extensions.ts
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

const USERNAME = 'ankush';

async function checkExtensions() {
  console.log(`Checking extension requests for: ${USERNAME}\n`);
  console.log('='.repeat(60));

  // First find the user
  const usersSnapshot = await db.collection('users')
    .where('username', '==', USERNAME)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.log('User not found');
    return;
  }

  const userId = usersSnapshot.docs[0].id;
  const userData = usersSnapshot.docs[0].data();
  console.log(`User: ${userData.first_name} ${userData.last_name} (${userId})`);
  console.log('='.repeat(60));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Check extension request logs where user is the actor
  console.log('\n📋 Extension Request Logs (meta.userId = userId, last 30 days)\n');
  
  const extLogsSnapshot = await db.collection('logs')
    .where('type', '==', 'extensionRequests')
    .where('meta.userId', '==', userId)
    .where('timestamp', '>=', thirtyDaysAgo)
    .limit(50)
    .get();

  console.log(`Found ${extLogsSnapshot.size} extension request log(s) by this user:`);
  
  for (const doc of extLogsSnapshot.docs) {
    const data = doc.data();
    const timestamp = data.timestamp?._seconds ? new Date(data.timestamp._seconds * 1000).toISOString() : 'N/A';
    console.log(`\n  ID: ${doc.id}`);
    console.log(`  Timestamp: ${timestamp}`);
    console.log(`  Task: ${data.body?.taskTitle || data.meta?.taskTitle || 'N/A'}`);
    console.log(`  Status: ${data.body?.status || 'N/A'}`);
    console.log(`  meta.userId: ${data.meta?.userId}`);
    console.log(`  meta.username: ${data.meta?.username}`);
  }

  // Also check ALL extension logs in last 30 days to see who's counted
  console.log('\n\n📊 ALL Extension Request Logs (last 30 days)\n');
  
  const allExtLogsSnapshot = await db.collection('logs')
    .where('type', '==', 'extensionRequests')
    .where('timestamp', '>=', thirtyDaysAgo)
    .limit(100)
    .get();

  const userExtCounts = new Map<string, { username: string; count: number }>();
  
  for (const doc of allExtLogsSnapshot.docs) {
    const data = doc.data();
    const metaUserId = data.meta?.userId;
    const metaUsername = data.meta?.username || 'unknown';
    
    if (metaUserId) {
      const current = userExtCounts.get(metaUserId) || { username: metaUsername, count: 0 };
      current.count++;
      if (metaUsername !== 'unknown') current.username = metaUsername;
      userExtCounts.set(metaUserId, current);
    }
  }

  console.log(`Total extension logs: ${allExtLogsSnapshot.size}`);
  console.log('\nBy user (meta.userId):');
  
  const sorted = Array.from(userExtCounts.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  for (const [uid, info] of sorted) {
    const marker = uid === userId ? ' <-- ankush' : '';
    console.log(`  ${info.username} (${uid}): ${info.count} extensions${marker}`);
  }

  // Check if there are extension logs where ankush approved/rejected (as superuser)
  console.log('\n\n🔍 Checking extension log structure for ankush...\n');
  
  const sampleLogs = await db.collection('logs')
    .where('type', '==', 'extensionRequests')
    .limit(10)
    .get();

  console.log('Sample extension log structures:');
  for (const doc of sampleLogs.docs.slice(0, 3)) {
    const data = doc.data();
    console.log(`\n  Log ID: ${doc.id}`);
    console.log(`  meta:`, JSON.stringify(data.meta, null, 4));
    console.log(`  body:`, JSON.stringify(data.body, null, 4));
  }
}

checkExtensions().catch(console.error);
