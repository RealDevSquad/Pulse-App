import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const match =
  envContent.match(/FIRESTORE_CONFIG=(['"]?)(.+?)\1(?:\n|$)/s) ||
  envContent.match(/FIRESTORE_CONFIG=(.+)/);

if (!match) {
  console.error('FIRESTORE_CONFIG not found in .env.local');
  process.exit(1);
}

const serviceAccount = JSON.parse(match[2] || match[1]) as ServiceAccount;

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function listCollections(): Promise<void> {
  const collections = await db.listCollections();

  if (collections.length === 0) {
    console.log('No collections found in Firestore.');
  } else {
    console.log('Collections:\n');
    for (const col of collections) {
      const snapshot = await col.limit(1).get();
      console.log(`- ${col.id} (${snapshot.size > 0 ? 'has documents' : 'empty'})`);
    }
  }

  process.exit(0);
}

listCollections();
