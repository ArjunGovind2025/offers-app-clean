import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { loadStripe } from "@stripe/stripe-js";
import { db } from "./firebase";

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

/** Create a new Stripe account with transfers capability */
export const createStripeAccount = async (userId) => {
  try {
    const response = await fetch("/api/stripe/create-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();
    if (data.success) {
      console.log(`Stripe account created for user ${userId}: ${data.accountId}`);
      return data.accountId;
    } else {
      console.error("Error creating Stripe account:", data.error);
      return null;
    }
  } catch (error) {
    console.error("Error creating Stripe account:", error);
    return null;
  }
};

/** Retrieve user's Stripe account from Firestore or create one */
export const getUserStripeAccount = async (userId) => {
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

    console.log(`Creating Stripe account for user ${userId}`);
    return await createStripeAccount(userId);
  } catch (error) {
    console.error("Error fetching or creating Stripe account:", error);
    return null;
  }
};

/** Generate an account onboarding link */
export const createAccountLink = async (stripeAccountId) => {
  try {
    const response = await fetch("/api/stripe/create-account-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stripeAccountId }),
    });

    const data = await response.json();
    if (data.success) {
      return data.accountLink;
    } else {
      console.error("Error creating account link:", data.error);
      return null;
    }
  } catch (error) {
    console.error("Error creating account link:", error);
    return null;
  }
};

/** Handle Stripe Payout */
export const createPayout = async (amount, userId) => {
  try {
    const response = await fetch("/api/stripe/create-payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, userId }),
    });

    const data = await response.json();
    if (data.success) {
      console.log("Payout successful:", data.payout);
      alert("Payout successful! Your credits have been cashed out.");
      return data.payout;
    } else if (data.onboardingRequired) {
      alert("Account setup required. You'll be redirected to complete your Stripe account setup.");
      window.location.href = data.accountLink; // Redirect for onboarding
    } else {
      console.error("Error creating payout:", data.error);
      
      // Handle specific capability errors
      if (data.error.includes("capabilities") || data.error.includes("transfers")) {
        alert("Your payout account needs additional setup. Please contact support or complete Stripe account verification.");
      } else {
        alert(`Payout failed: ${data.error}`);
      }
    }
  } catch (error) {
    console.error("Error creating payout:", error);
    alert("Network error occurred. Please try again later.");
  }
};

/** Create Checkout Session for Subscriptions */
export const createCheckoutSession = async (userId, planId) => {
  try {
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, planId }),
    });

    const data = await response.json();
    if (data.success) {
      const stripe = await stripePromise;
      await stripe.redirectToCheckout({ sessionId: data.sessionId });
    } else {
      console.error("Error creating checkout session:", data.error);
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
  }
};
