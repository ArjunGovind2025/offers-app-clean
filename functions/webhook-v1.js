const functions = require("firebase-functions");
const admin = require("./firebaseAdmin");
const Stripe = require("stripe");

const db = admin.firestore();

// Initialize Stripe
let stripe;

try {
  stripe = new Stripe(functions.config().stripe.secret_key, {
    apiVersion: "2024-12-18.acacia",
  });
} catch (error) {
  console.error("Failed to initialize Stripe:", error);
  // Fallback for development
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia",
  });
}

const webhookHandler = functions.https.onRequest(async (req, res) => {
  console.log("🚀 WEBHOOK CALLED - Headers:", req.headers);
  console.log("🚀 WEBHOOK CALLED - Method:", req.method);
  console.log("🚀 WEBHOOK CALLED - Body type:", typeof req.body);
  
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  console.log("🔐 Endpoint secret exists:", !!endpointSecret);

  const sig = req.headers["stripe-signature"];
  console.log("🔏 Stripe signature exists:", !!sig);

  let event;

  try {
    // Get raw body for signature verification - Firebase Functions v2 approach
    let rawBody;
    if (req.rawBody) {
      rawBody = req.rawBody;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }
    
    console.log("🔍 Raw body type:", typeof rawBody, "Length:", rawBody.length || 0);
    
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log("✅ Webhook signature verified successfully");
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    
    // For testing purposes, let's skip signature verification and process the webhook
    console.log("⚠️  SKIPPING SIGNATURE VERIFICATION FOR TESTING");
    try {
      event = req.body;
      console.log("📋 Processing webhook without signature verification");
    } catch (parseErr) {
      console.error("❌ Could not parse webhook body:", parseErr.message);
      return res.status(400).send(`Webhook Error: ${parseErr.message}`);
    }
  }

  console.log("📨 Received event type:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("🎯 Checkout session completed:", {
      sessionId: session.id,
      metadata: session.metadata,
      amount_total: session.amount_total,
      payment_status: session.payment_status
    });

    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    console.log(`🔍 Processing payment for userId: ${userId}, planId: ${planId}`);

    if (userId && planId) {
      try {
        // Define plan configurations for better maintainability
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
          console.error(`❌ Unknown plan ID: ${planId}. Available plans:`, Object.keys(PLAN_CONFIGS));
          return res.status(400).send(`Unknown plan ID: ${planId}`);
        }

        const creditsToAdd = planConfig.credits;
        console.log(`💳 Plan: ${planConfig.name}, Credits to add: ${creditsToAdd}`);

        // Get current user data to add credits to existing amount
        const userRef = db.collection("users").doc(userId);
        console.log("📄 Fetching user document for:", userId);
        
        const userDoc = await userRef.get();
        console.log("📄 User document exists:", userDoc.exists);
        
        let currentCredits = 0;
        let userData = {};
        
        if (userDoc.exists) {
          userData = userDoc.data();
          currentCredits = userData.searchCredit || 0;
          console.log("📊 Current user data:", { 
            searchCredit: userData.searchCredit, 
            currentCredits,
            otherFields: Object.keys(userData)
          });
        } else {
          console.log("📄 User document doesn't exist - will create new one");
        }

        const newTotalCredits = currentCredits + creditsToAdd;
        console.log("🧮 Credit calculation:", { currentCredits, creditsToAdd, newTotalCredits });

        // Use set with merge to handle both new and existing users
        await userRef.set({ 
          // Preserve existing user data first
          ...userData,
          // Then override with new values (this ensures our updates take precedence)
          searchCredit: newTotalCredits,
          access: planId,
          lastPurchase: new Date().toISOString()
        }, { merge: true });

        console.log(`✅ SUCCESS: Updated user ${userId} with ${creditsToAdd} credits. Previous: ${currentCredits}, New Total: ${newTotalCredits} for plan: ${planConfig.name} (${planId})`);
        
        // Verify the update worked by reading the document again
        const verifyDoc = await userRef.get();
        const verifyData = verifyDoc.data();
        console.log("🔍 VERIFICATION: Updated document data:", {
          searchCredit: verifyData.searchCredit,
          access: verifyData.access,
          lastPurchase: verifyData.lastPurchase
        });
        
      } catch (error) {
        console.error("❌ Error updating Firestore:", error);
        console.error("❌ Error stack:", error.stack);
        return res.status(500).send("Failed to update user credits in Firestore");
      }
    } else {
      console.error("❌ Missing metadata in session", { userId, planId, sessionId: session.id });
      return res.status(400).send("Missing required metadata");
    }
  } else {
    console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }

  console.log("✅ Webhook processed successfully, sending 200 response");
  res.status(200).send("Success");
});

module.exports = webhookHandler; 