// functions/firebaseAdmin.js

const admin = require("firebase-admin");

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

module.exports = admin;
