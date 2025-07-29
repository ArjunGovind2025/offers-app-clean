import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // Or use a service account key file
    databaseURL: "https://offers-5e23d.firebaseio.com", // Replace with your Firebase database URL
  });
}

const db = admin.firestore();

export { admin, db };
