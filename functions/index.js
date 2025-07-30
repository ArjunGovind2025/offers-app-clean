const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const admin = require("./firebaseAdmin");

const db = admin.firestore();

// Use environment variable for Stripe key
let stripeSecretKey;
let stripe;

try {
  stripeSecretKey = functions.config().stripe.secret_key;
  stripe = new Stripe(stripeSecretKey);
} catch (error) {
  console.error("Failed to initialize Stripe:", error);
  // Fallback for development
  stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  stripe = new Stripe(stripeSecretKey);
}

// Use this CORS middleware:
const corsMiddleware = cors({ origin: true });

/** -------------------------
 *  Create Payout Function
 * ------------------------ */
const createPayoutApp = express();

// 1) Handle all OPTIONS preflight requests
createPayoutApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
createPayoutApp.use(corsMiddleware);

// 3) Parse JSON
createPayoutApp.use(express.json());

createPayoutApp.post("/", async (req, res) => {
  const { amount, userId } = req.body;

  if (!amount || !userId) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid request parameters." });
  }

  try {
    const userStripeAccountId = await getUserStripeAccount(userId);
    if (!userStripeAccountId) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to create Stripe account." });
    }

    // Check account capabilities
    const account = await stripe.accounts.retrieve(userStripeAccountId);
    const hasTransfers = account.capabilities?.transfers === "active";
    
    if (!hasTransfers) {
      // Generate onboarding link
      const baseUrl = `http://localhost:3000`;
      
      const accountLink = await stripe.accountLinks.create({
        account: userStripeAccountId,
        refresh_url: `${baseUrl}/profile?onboarding=failed`,
        return_url: `${baseUrl}/profile?onboarding=complete`,
        type: "account_onboarding",
      });
      
      return res.status(200).json({
        success: false,
        onboardingRequired: true,
        accountLink: accountLink.url,
        error: "Account capabilities not active. Please complete onboarding."
      });
    }

    // Create the transfer to the connected account:
    try {
      const payout = await stripe.transfers.create({
        amount: Math.floor(amount * 100),
        currency: "usd",
        destination: userStripeAccountId,
      });

      // Reset user credit and add payout to history
      const userRef = db.collection("users").doc(userId);
      const payoutRecord = {
        id: payout.id,
        amount: amount,
        amountCents: payout.amount,
        currency: payout.currency,
        status: 'pending',
        created: new Date().toISOString(),
        stripeCreated: new Date(payout.created * 1000).toISOString(),
        destination: userStripeAccountId
      };

      await userRef.update({ 
        credit: 0,
        lastPayoutStatus: 'pending',
        lastPayoutAmount: amount,
        lastPayoutDate: new Date().toISOString()
      });

      // Add to payout history subcollection
      await userRef.collection('payoutHistory').doc(payout.id).set(payoutRecord);

      res.status(200).json({ 
        success: true, 
        payout,
        payoutRecord
      });
    } catch (transferError) {
      console.error("Transfer error:", transferError.message);
      
      // If transfer fails, force re-onboarding
      const baseUrl = `http://localhost:3000`;
      
      const accountLink = await stripe.accountLinks.create({
        account: userStripeAccountId,
        refresh_url: `${baseUrl}/profile?onboarding=failed`,
        return_url: `${baseUrl}/profile?onboarding=complete`,
        type: "account_onboarding",
      });
      
      return res.status(200).json({
        success: false,
        onboardingRequired: true,
        accountLink: accountLink.url,
        error: `Transfer failed: ${transferError.message}`
      });
    }
  } catch (error) {
    console.error("Error creating payout:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** -------------------------
 *  Create Checkout Session
 * ------------------------ */
const createCheckoutSessionApp = express();

// 1) Handle all OPTIONS preflight requests
createCheckoutSessionApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
createCheckoutSessionApp.use(corsMiddleware);

// 3) Parse JSON
createCheckoutSessionApp.use(express.json());

createCheckoutSessionApp.post("/", async (req, res) => {
  const { userId, planId } = req.body;

  if (!userId || !planId) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid request parameters." });
  }

  try {
    // Get user from Firestore
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    let stripeCustomerId = userDoc.exists ? userDoc.data()?.stripeCustomerId : null;

    // If user has no Stripe customer ID, create one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ metadata: { userId } });
      stripeCustomerId = customer.id;
      await userRef.update({ stripeCustomerId });
    }

    // Create Stripe Checkout Session for one-time payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{ price: planId, quantity: 1 }],
      customer: stripeCustomerId,
      success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
      cancel_url: `http://localhost:3000/cancel`,
      metadata: {
        userId: userId,
        planId: planId
      }
    });

    res.status(200).json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** -------------------------
 *  Verify Session Function
 * ------------------------ */
const verifySessionApp = express();

// 1) Handle all OPTIONS preflight requests
verifySessionApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
verifySessionApp.use(corsMiddleware);

// 3) Parse JSON
verifySessionApp.use(express.json());

verifySessionApp.post("/", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, error: "Session ID is required." });
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      res.status(200).json({ success: true, session });
    } else {
      res.status(400).json({ 
        success: false, 
        error: "Payment not completed or session invalid." 
      });
    }
  } catch (error) {
    console.error("Error verifying session:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** -------------------------
 *  Helper Functions
 * ------------------------ */
async function createStripeAccount(userId) {
  try {
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: { 
        transfers: { requested: true }
      },
    });

    const userRef = db.collection("users").doc(userId);
    await userRef.update({ stripeAccountId: account.id });

    return account.id;
  } catch (error) {
    console.error("Error creating Stripe account:", error);
    return null;
  }
}

async function getUserStripeAccount(userId) {
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data();
  if (userData?.stripeAccountId) return userData.stripeAccountId;
  return await createStripeAccount(userId);
}

/** -------------------------
 *  Export Cloud Functions
 * ------------------------ */
exports.createPayout = functions.https.onRequest(createPayoutApp);
exports.createCheckoutSession = functions.https.onRequest(createCheckoutSessionApp);
exports.verifySession = functions.https.onRequest(verifySessionApp);

// Import and export the analyzeOfferLetter function
const { analyzeOfferLetter } = require("./analyzeOffers");
exports.analyzeOfferLetter = analyzeOfferLetter;

// Import and export the v1 webhook handler
const webhookHandlerV1 = require("./webhook-v1");
exports.stripeWebhook = webhookHandlerV1;

/** -------------------------
 *  Purchase History Function
 * ------------------------ */
/** -------------------------
 *  Get Purchase History Function
 * ------------------------ */
const getPurchaseHistoryApp = express();

// 1) Handle all OPTIONS preflight requests
getPurchaseHistoryApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
getPurchaseHistoryApp.use(corsMiddleware);

// 3) Parse JSON
getPurchaseHistoryApp.use(express.json());

// Add a health check endpoint first
getPurchaseHistoryApp.get("/", (req, res) => {
  res.status(200).json({ status: "healthy", message: "getPurchaseHistory function is running" });
});

getPurchaseHistoryApp.post("/", async (req, res) => {
  try {
    console.log("getPurchaseHistory called with body:", req.body);
    
    const { userId } = req.body;
    if (!userId) {
      console.log("No userId provided");
      return res.status(400).json({ success: false, error: "User ID is required." });
    }

    console.log("Getting user document for userId:", userId);
    
    // Get Stripe customer ID from Firestore
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log("User document not found");
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;
    
    if (!stripeCustomerId) {
      console.log("No Stripe customer ID found");
      return res.status(200).json({ success: true, purchases: [] });
    }

    console.log("Fetching Stripe sessions for customer:", stripeCustomerId);
    
    // Fetch Stripe checkout sessions (purchases)
    const sessions = await stripe.checkout.sessions.list({ 
      customer: stripeCustomerId, 
      limit: 100 
    });
    
    const purchases = sessions.data
      .filter(s => s.payment_status === "paid")
      .map(s => ({
        id: s.id,
        amount: s.amount_total / 100,
        currency: s.currency,
        created: new Date(s.created * 1000).toISOString(),
        planId: s.metadata?.planId,
        status: s.payment_status
      }));

    console.log("Returning purchases:", purchases.length);
    res.status(200).json({ success: true, purchases });
  } catch (error) {
    console.error("Error in getPurchaseHistory:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

exports.getPurchaseHistory = functions.https.onRequest(getPurchaseHistoryApp);

/** -------------------------
 *  Setup Stripe Account Function
 * ------------------------ */
const setupStripeAccountApp = express();

// 1) Handle all OPTIONS preflight requests
setupStripeAccountApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
setupStripeAccountApp.use(corsMiddleware);

// 3) Parse JSON
setupStripeAccountApp.use(express.json());

setupStripeAccountApp.post("/", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: "User ID is required." 
      });
    }
    
    // Get user document from Firestore
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: "User document not found." 
      });
    }

    const userData = userDoc.data();

    // Check if user already has a Stripe account
    if (userData.stripeAccountId) {
      // Check if account is already set up
      try {
        const account = await stripe.accounts.retrieve(userData.stripeAccountId);
        
        // Check if account has required capabilities
        const hasTransfers = account.capabilities?.transfers === 'active';
        
        console.log('🔍 ACCOUNT DIAGNOSIS:', {
          accountId: userData.stripeAccountId,
          email: account.email,
          type: account.type,
          country: account.country,
          business_type: account.business_type,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          capabilities: account.capabilities,
          requirements: account.requirements?.currently_due,
          metadata: account.metadata
        });
        
        if (hasTransfers) {
          return res.status(200).json({
            success: true,
            message: 'Your Stripe account is already set up for payouts!',
            accountId: userData.stripeAccountId,
            accountDetails: {
              email: account.email,
              type: account.type,
              country: account.country,
              charges_enabled: account.charges_enabled,
              payouts_enabled: account.payouts_enabled,
              details_submitted: account.details_submitted
            }
          });
        }
        
        // Account exists but needs onboarding
        // Use dynamic URLs based on environment
        const baseUrl = `http://localhost:3000`;
        
        console.log('🔗 STRIPE REDIRECT URLs (existing account):', {
          baseUrl,
          refresh_url: `${baseUrl}/profile?setup=refresh`,
          return_url: `${baseUrl}/profile?setup=complete`
        });
        
        const accountLink = await stripe.accountLinks.create({
          account: userData.stripeAccountId,
          refresh_url: `${baseUrl}/profile?setup=refresh`,
          return_url: `${baseUrl}/profile?setup=complete`,
          type: 'account_onboarding',
        });

        return res.status(200).json({
          success: false,
          onboardingRequired: true,
          accountLink: accountLink.url,
          message: 'Please complete your Stripe account setup.'
        });
        
      } catch (error) {
        console.error('Error checking existing account:', error);
        // If account doesn't exist, create a new one
      }
    }

    // Create new Stripe connected account
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        transfers: { requested: true }
      },
      metadata: {
        firebase_uid: userId
      }
    });

    // Save the account ID to user document
    await userRef.update({
      stripeAccountId: account.id
    });

    // Create account link for onboarding
    // Use dynamic URLs based on environment
          const baseUrl = `http://localhost:3000`;
    
    console.log('🔗 STRIPE REDIRECT URLs:', {
      baseUrl,
      refresh_url: `${baseUrl}/profile?setup=refresh`,
      return_url: `${baseUrl}/profile?setup=complete`
    });
    
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/profile?setup=refresh`,
      return_url: `${baseUrl}/profile?setup=complete`,
      type: 'account_onboarding',
    });

    res.status(200).json({
      success: false,
      onboardingRequired: true,
      accountLink: accountLink.url,
      accountId: account.id,
      message: 'Stripe account created. Please complete setup.'
    });

  } catch (error) {
    console.error('Error setting up Stripe account:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to set up payment account: ' + error.message 
    });
  }
});

exports.setupStripeAccount = functions.https.onRequest(setupStripeAccountApp);

/** -------------------------
 *  Manage Stripe Account Function
 * ------------------------ */
const manageStripeAccountApp = express();

// 1) Handle all OPTIONS preflight requests
manageStripeAccountApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
manageStripeAccountApp.use(corsMiddleware);

// 3) Parse JSON
manageStripeAccountApp.use(express.json());

manageStripeAccountApp.post("/", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: "User ID is required." 
      });
    }
    
    // Get user document from Firestore
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: "User document not found." 
      });
    }

    const userData = userDoc.data();

    if (!userData.stripeAccountId) {
      return res.status(400).json({ 
        success: false, 
        error: "No Stripe account found. Please set up payments first." 
      });
    }

    // Create account link for managing account details
    const baseUrl = `http://localhost:3000`;
    
    console.log('🔗 MANAGE ACCOUNT URLs:', {
      baseUrl,
      refresh_url: `${baseUrl}/profile?manage=refresh`,
      return_url: `${baseUrl}/profile?manage=complete`
    });
    
    const accountLink = await stripe.accountLinks.create({
      account: userData.stripeAccountId,
      refresh_url: `${baseUrl}/profile?manage=refresh`,
      return_url: `${baseUrl}/profile?manage=complete`,
      type: 'account_onboarding',
    });

    res.status(200).json({
      success: true,
      accountLink: accountLink.url,
      message: 'Redirecting to manage your account details...'
    });

  } catch (error) {
    console.error('Error creating manage account link:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create manage account link: ' + error.message 
    });
  }
});

exports.manageStripeAccount = functions.https.onRequest(manageStripeAccountApp);

/** -------------------------
 *  Test Credit Update Function (for debugging)
 * ------------------------ */
const testCreditUpdateApp = express();

// 1) Handle all OPTIONS preflight requests
testCreditUpdateApp.options("*", corsMiddleware);

// 2) Apply CORS to every route
testCreditUpdateApp.use(corsMiddleware);

// 3) Parse JSON
testCreditUpdateApp.use(express.json());

testCreditUpdateApp.post("/", async (req, res) => {
  try {
    const { userId, planId } = req.body;
    
    console.log("🧪 TEST CREDIT UPDATE - userId:", userId, "planId:", planId);
    
    if (!userId || !planId) {
      return res.status(400).json({ 
        success: false, 
        error: "userId and planId are required." 
      });
    }
    
    // Define plan configurations
    const PLAN_CONFIGS = {
      'price_1RgDedGPA4p9u1zTZGQ54PIc': { 
        name: 'Starter Pack', 
        credits: 50 
      },
      'price_1RgDg3GPA4p9u1zT6QgWE03I': { 
        name: 'Standard Pack', 
        credits: 100 
      }
    };

    const planConfig = PLAN_CONFIGS[planId];
    
    if (!planConfig) {
      return res.status(400).json({
        success: false,
        error: `Unknown plan ID: ${planId}. Available plans: ${Object.keys(PLAN_CONFIGS).join(', ')}`
      });
    }

    const creditsToAdd = planConfig.credits;
    console.log(`🧪 Plan: ${planConfig.name}, Credits to add: ${creditsToAdd}`);

    // Get current user data
    const userRef = admin.firestore().collection("users").doc(userId);
    console.log("🧪 Fetching user document for:", userId);
    
    const userDoc = await userRef.get();
    console.log("🧪 User document exists:", userDoc.exists);
    
    let currentCredits = 0;
    let userData = {};
    
    if (userDoc.exists) {
      userData = userDoc.data();
      currentCredits = userData.searchCredit || 0;
      console.log("🧪 Current user data:", { 
        searchCredit: userData.searchCredit, 
        currentCredits,
        otherFields: Object.keys(userData)
      });
    } else {
      console.log("🧪 User document doesn't exist - will create new one");
    }

    const newTotalCredits = currentCredits + creditsToAdd;
    console.log("🧪 Credit calculation:", { currentCredits, creditsToAdd, newTotalCredits });

    // Use set with merge to handle both new and existing users
    console.log("🧪 About to update Firestore...");
    
    const updateData = { 
      searchCredit: newTotalCredits,
      access: planId,
      lastPurchase: new Date().toISOString(),
      testUpdate: true, // Flag to identify test updates
      // Preserve existing user data if any
      ...userData
    };
    
    console.log("🧪 Update data:", updateData);
    
    await userRef.set(updateData, { merge: true });
    
    console.log(`🧪 SUCCESS: Updated user ${userId} with ${creditsToAdd} credits. Previous: ${currentCredits}, New Total: ${newTotalCredits}`);
    
    // Verify the update worked
    const verifyDoc = await userRef.get();
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data();
      console.log("🧪 VERIFICATION: Updated document data:", {
        searchCredit: verifyData.searchCredit,
        access: verifyData.access,
        lastPurchase: verifyData.lastPurchase
      });
      
      return res.status(200).json({
        success: true,
        message: `Successfully added ${creditsToAdd} credits`,
        before: currentCredits,
        after: verifyData.searchCredit,
        plan: planConfig.name
      });
    } else {
      console.error("🧪 VERIFICATION FAILED: Document doesn't exist after update!");
      return res.status(500).json({
        success: false,
        error: "Document doesn't exist after update"
      });
    }
    
  } catch (error) {
    console.error("🧪 Error in test credit update:", error);
    console.error("🧪 Error stack:", error.stack);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to update credits: ' + error.message 
    });
  }
});

exports.testCreditUpdate = functions.https.onRequest(testCreditUpdateApp);
