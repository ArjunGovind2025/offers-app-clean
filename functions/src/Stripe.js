import express, { Request, Response } from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "/Users/arjungovind/Desktop/offer3/my-app/app/firebase";
import path from "path";
const functions = require("firebase-functions");

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const router = express.Router();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing Stripe Secret Key in environment variables.");
}

const stripe = new Stripe(stripeSecretKey);

/** Create a new Stripe account with transfers capability */
async function createStripeAccount(userId) {
  try {
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }, // Add card payments capability
      },
      business_type: 'individual', // Specify business type for faster approval
    });

    // Save the Stripe account ID to Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { stripeAccountId: account.id });

    console.log(`Stripe account created for user ${userId}: ${account.id}`, {
      capabilities: account.capabilities
    });
    return account.id;
  } catch (error) {
    console.error("Error creating Stripe account:", error);
    return null;
  }
}

/** Retrieve user's Stripe account from Firestore or create one */
async function getUserStripeAccount(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.error(`User with ID ${userId} not found.`);
      return null;
    }

    const userData = userDoc.data();
    if (userData?.stripeAccountId) {
      return userData.stripeAccountId;
    }

    // Create a new Stripe account if not found
    console.log(`Creating Stripe account for user ${userId}`);
    const newStripeAccountId = await createStripeAccount(userId);

    return newStripeAccountId;
  } catch (error) {
    console.error(`Error fetching or creating Stripe account for userId ${userId}:`, error);
    return null;
  }
}

/** Check if the Stripe account has the required capabilities */
async function checkAccountCapabilities(stripeAccountId) {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const hasTransfers = account.capabilities?.transfers === "active";
    const hasCryptoTransfers = account.capabilities?.crypto_transfers === "active";
    
    console.log(`Account ${stripeAccountId} full details:`, {
      id: account.id,
      type: account.type,
      business_type: account.business_type,
      capabilities: account.capabilities,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted
    });
    
    const hasRequiredCapability = hasTransfers || hasCryptoTransfers;
    
    if (!hasRequiredCapability) {
      console.log(`Account ${stripeAccountId} missing required capabilities. Current status:`, {
        transfers: account.capabilities?.transfers,
        crypto_transfers: account.capabilities?.crypto_transfers,
        details_submitted: account.details_submitted,
        requirements: account.requirements
      });
    }
    
    return hasRequiredCapability;
  } catch (error) {
    console.error("Error checking Stripe account capabilities:", error);
    return false;
  }
}

/** Generate an account onboarding link */
async function createAccountLink(stripeAccountId) {
  try {
    const baseUrl = process.env.FRONTEND_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.com' 
        : `http://localhost:3000`);
      
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/profile?setup=refresh`,
      return_url: `${baseUrl}/profile?setup=complete`,
      type: "account_onboarding",
    });

    return accountLink.url;
  } catch (error) {
    console.error("Error creating account link:", error);
    throw error;
  }
}

router.post("/create-payout", async (req, res) => {
  const { amount, userId, setupOnly } = req.body;

  // Add debugging to see what we received
  console.log("=== CREATE PAYOUT REQUEST DEBUG ===");
  console.log("Full request body:", req.body);
  console.log("Extracted values:", { amount, userId, setupOnly });
  console.log("Types:", { 
    amount: typeof amount, 
    userId: typeof userId, 
    setupOnly: typeof setupOnly 
  });
  console.log("Validation check:", {
    amountUndefined: amount === undefined,
    setupOnlyValue: setupOnly,
    setupOnlyTruthy: !!setupOnly,
    userIdExists: !!userId,
    validationPasses: !((amount === undefined && !setupOnly) || !userId)
  });

  if ((amount === undefined && !setupOnly) || !userId) {
    console.log("VALIDATION FAILED - sending 400 error");
    res.status(400).json({ success: false, error: "Invalid request parameters." });
    return;
  }

  console.log("VALIDATION PASSED - proceeding with request");

  try {
    const userStripeAccountId = await getUserStripeAccount(userId);

    if (!userStripeAccountId) {
      console.log(`User ${userId} does not have a connected Stripe account. Creating account and onboarding link.`);
      const stripeAccountId = await createStripeAccount(userId);
      if (!stripeAccountId) {
        res.status(500).json({
          success: false,
          error: "Failed to create a Stripe account. Please try again later.",
        });
        return;
      }

      console.log(`Created new account ${stripeAccountId}, generating onboarding link...`);
      const accountLink = await createAccountLink(stripeAccountId);
      res.status(200).json({
        success: false,
        onboardingRequired: true,
        accountLink,
        message: "New account created. Please complete onboarding to enable transfers."
      });
      return;
    }

    // For existing accounts, check if they've completed onboarding
    console.log(`Checking capabilities for existing account: ${userStripeAccountId}`);
    const hasActiveCapabilities = await checkAccountCapabilities(userStripeAccountId);
    if (!hasActiveCapabilities) {
      console.log(`Account ${userStripeAccountId} needs onboarding completion`);
      const accountLink = await createAccountLink(userStripeAccountId);
      res.status(200).json({
        success: false,
        onboardingRequired: true,
        accountLink,
        message: "Please complete your Stripe account onboarding to enable transfers."
      });
      return;
    }

    console.log(`Account ${userStripeAccountId} has active capabilities, ready for transfers`);;

    // If this is just for setup, don't create an actual payout
    if (setupOnly) {
      res.status(200).json({ 
        success: true, 
        message: "Your Stripe account is already set up for payouts!" 
      });
      return;
    }

    // Only create actual payout if amount > 0 and not setup-only
    if (!amount || amount <= 0) {
      res.status(400).json({ 
        success: false, 
        error: "Invalid payout amount." 
      });
      return;
    }

    try {
      const payout = await stripe.transfers.create({
        amount: Math.floor(amount * 100),
        currency: "usd",
        destination: userStripeAccountId,
      });
      
      console.log(`Payout successful for user ${userId}:`, payout.id);
    } catch (transferError) {
      console.error("Transfer failed:", transferError.message);
      console.error("Full transfer error:", transferError);
      
      // Check if this is a capability error
      if (transferError.message.includes('capabilities') || 
          transferError.message.includes('transfers')) {
        
        // Re-check account capabilities after error
        const account = await stripe.accounts.retrieve(userStripeAccountId);
        console.log("Account details after transfer failure:", {
          capabilities: account.capabilities,
          requirements: account.requirements,
          details_submitted: account.details_submitted
        });
        
        // Force re-onboarding to enable required capabilities
        const accountLink = await createAccountLink(userStripeAccountId);
        res.status(200).json({
          success: false,
          onboardingRequired: true,
          error: "Your Stripe account needs additional capabilities enabled. Please complete the onboarding process.",
          accountLink,
        });
        return;
      }
      
      // For other transfer errors, still try re-onboarding
      const accountLink = await createAccountLink(userStripeAccountId);
      res.status(200).json({
        success: false,
        onboardingRequired: true,
        error: `Transfer failed: ${transferError.message}. Please complete onboarding again.`,
        accountLink,
      });
      return;
    }

     // 1) If successful, reset the user's credit to zero in Firestore:
     const userRef = doc(db, "users", userId);
     await updateDoc(userRef, { credit: 0 });
 

    res.status(200).json({ success: true, payout });
  } catch (error) {
    console.error("Error creating payout:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred.",
    });
  }
});




router.post("/create-checkout-session", async (req, res) => {
  const { userId, planId } = req.body;

  console.log("Received request to create checkout session:");
  console.log("User ID:", userId);
  console.log("Plan:", planId);

  if (!userId || !planId) {
    console.error("Missing required parameters: userId or plan.");
    res.status(400).json({ success: false, error: "Invalid request parameters." });
    return;
  }

  try {
    // Retrieve or create the user's Stripe account
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    let stripeCustomerId = userDoc.exists() ? userDoc.data()?.stripeCustomerId : null;

    if (!stripeCustomerId) {
      console.log("No Stripe customer ID found. Creating a new Stripe customer...");
      const customer = await stripe.customers.create({ metadata: { userId } });
      stripeCustomerId = customer.id;
      await updateDoc(userRef, { stripeCustomerId });
      console.log("New Stripe customer created:", stripeCustomerId);
    } else {
      console.log("Existing Stripe customer ID found:", stripeCustomerId);
    }

    const prices = await stripe.prices.list({ active: true });
    console.log("Available prices:", prices.data.map((p) => p.id));
    

    const priceId = planId;
    if (!priceId) {
      console.error("Invalid plan selected:", planId);
      res.status(400).json({ success: false, error: "Invalid plan selected." });
      return;
    }

    console.log("Using price ID for the plan:", priceId);



    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: planId, // The Stripe price ID
          quantity: 1,
        },
      ],
      customer: stripeCustomerId,
      metadata: {
        userId: req.body.userId, // Pass the userId from the request
        planId: req.body.planId, // Pass the planId from the request
      },
      success_url: `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000')}/cancel`,
    });

    console.log("Checkout session created successfully:", session.id);

    res.status(200).json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred.",
    });
  }
});


export default router;
