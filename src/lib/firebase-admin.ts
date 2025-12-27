import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIRESTORE_CONFIG;

  if (!serviceAccountJson) {
    throw new Error('FIRESTORE_CONFIG environment variable is not set');
  }

  // Parse service account JSON
  // The private_key field may contain literal newlines which break JSON.parse
  // We need to escape them, but only inside string values (between quotes)
  let inString = false;
  let escaped = false;
  let result = '';

  for (const char of serviceAccountJson) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && char === '\n') {
      result += '\\n';
    } else if (inString && char === '\r') {
      result += '\\r';
    } else {
      result += char;
    }
  }

  const serviceAccount = JSON.parse(result) as ServiceAccount;

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Initialize Firebase Admin
const app = getFirebaseAdmin();

// Export Firestore instance
export const db = getFirestore(app);
