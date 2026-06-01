import { cert, getApps, initializeApp } from "firebase-admin/app";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const firebaseAdminApp =
  getApps()[0] ??
  (projectId && clientEmail && privateKey
    ? initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
    : initializeApp(projectId ? { projectId } : undefined));