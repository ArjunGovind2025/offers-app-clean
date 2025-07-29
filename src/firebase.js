
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Import Firestore if needed\
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Import auth
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions"; // Import functions



// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEDIWIbuLkLN88WRXdWeorfKAygWax4oc",
  authDomain: "offers-5e23d.firebaseapp.com",
  projectId: "offers-5e23d",
  storageBucket: "offers-5e23d.firebasestorage.app", // Fixed the storageBucket URL
  messagingSenderId: "695731252828",
  appId: "1:695731252828:web:5f1ace19518f97882d0099",
  measurementId: "G-LF4L9FZPB0",
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


