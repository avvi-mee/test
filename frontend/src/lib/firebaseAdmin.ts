import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let _adminApp: App | null = null;

function ensureAdminApp(): App {
  if (!_adminApp) {
    if (getApps().length > 0) {
      _adminApp = getApps()[0];
    } else {
      // Primary: full service account JSON (JSON.parse handles newlines automatically)
      const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (jsonEnv) {
        const serviceAccount = JSON.parse(jsonEnv);
        _adminApp = initializeApp({ credential: cert(serviceAccount), storageBucket });
      } else {
        // Fallback: individual env vars (strip wrapping quotes if present)
        _adminApp = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY
              ?.replace(/^"|"$/g, "")
              .replace(/\\n/g, "\n"),
          }),
          storageBucket,
        });
      }
    }
  }
  return _adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(ensureAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(ensureAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(ensureAdminApp());
}
