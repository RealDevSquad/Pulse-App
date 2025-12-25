import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(__dirname, '../.env.local');
let envContent: string;
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch {
  console.error('.env.local file not found');
  process.exit(1);
}

// Parse FIRESTORE_CONFIG from .env.local
const match =
  envContent.match(/FIRESTORE_CONFIG=(['"]?)(.+?)\1(?:\n|$)/s) ||
  envContent.match(/FIRESTORE_CONFIG=(.+)/);

if (!match) {
  console.error('FIRESTORE_CONFIG not found in .env.local');
  process.exit(1);
}

interface FirestoreConfig extends ServiceAccount {
  project_id: string;
  client_email: string;
}

const configStr = match[2] || match[1];
let serviceAccount: FirestoreConfig;
try {
  serviceAccount = JSON.parse(configStr) as FirestoreConfig;
} catch {
  console.error('Failed to parse FIRESTORE_CONFIG as JSON');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function testConnection(): Promise<void> {
  console.log('Testing Firestore connection...\n');
  console.log(`Project: ${serviceAccount.project_id}`);
  console.log(`Service Account: ${serviceAccount.client_email}\n`);

  try {
    // Test write
    const testDoc = db.collection('_connection_test').doc('test');
    await testDoc.set({
      timestamp: new Date().toISOString(),
      message: 'Connection test successful',
    });
    console.log('Write test: PASSED');

    // Test read
    const snapshot = await testDoc.get();
    if (snapshot.exists) {
      console.log('Read test: PASSED');
      console.log('Data:', snapshot.data());
    }

    // Cleanup
    await testDoc.delete();
    console.log('Cleanup: PASSED');

    console.log('\nFirestore connection is working!');
    process.exit(0);
  } catch (error) {
    console.error('\nConnection failed:', (error as Error).message);
    process.exit(1);
  }
}

testConnection();
