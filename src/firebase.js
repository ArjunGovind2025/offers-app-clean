
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Import Firestore if needed\
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Import auth
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions"; // Import functions



// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the initialized Firebase app
export default app;

// Optionally, export Firestore if you're using it
export const db = getFirestore(app);
export const auth = getAuth(app); // Corrected Firebase auth initialization
export const storage = getStorage(app);
export const functions = getFunctions(app); // Export functions

// Export the Google Auth provider
export const googleProvider = new GoogleAuthProvider();


