/* eslint-disable */

import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs } from "firebase/firestore";

import { db } from "../firebase"; // Update the path based on your Firebase configuration
import Navbar from "../components/Navbar"; // Update the path based on your Navbar component location
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "../ui/pagination";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Number of items (offers) per page
const ITEMS_PER_PAGE = 5;

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const API_BASE_URL = "https://us-central1-offers-5e23d.cloudfunctions.net";

  const [credit, setCredit] = useState(0);
  const [userOffers, setUserOffers] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentSetupStatus, setPaymentSetupStatus] = useState('unknown'); // 'setup', 'pending', 'unknown'
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [showPayoutHistory, setShowPayoutHistory] = useState(false);
  const [lastPayoutStatus, setLastPayoutStatus] = useState(null);
  const [lastPayoutAmount, setLastPayoutAmount] = useState(null);
  const [lastPayoutDate, setLastPayoutDate] = useState(null);
  const [userDetails, setUserDetails] = useState({
    gpa: "",
    testScore: "",
    sai: "",
    state: "",
    activities: "",
  });

  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);

  // Add state for settings dropdown and selected section
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [selectedSettingsSection, setSelectedSettingsSection] = useState(null); // 'billing' | 'payouts' | null

  // Add state for userStatus and pendingMessage
  const [userStatus, setUserStatus] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  
  // Add state for dismissed notifications
  const [dismissedPayoutNotification, setDismissedPayoutNotification] = useState(false);

  // Persist payout notification dismissal in localStorage
  useEffect(() => {
    if (lastPayoutStatus === 'pending' && lastPayoutAmount && lastPayoutDate) {
      const key = `payout_dismissed_${lastPayoutAmount}_${lastPayoutDate}`;
      const dismissed = localStorage.getItem(key);
      setDismissedPayoutNotification(!!dismissed);
    }
  }, [lastPayoutStatus, lastPayoutAmount, lastPayoutDate]);

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("🔍 [Profile] Auth state changed. User:", user ? user.uid : "No user");
      if (user) {
        console.log("🔍 [Profile] User authenticated, fetching data...");
        setCurrentUser(user);
        await fetchUserData(user.uid);
        
        // Check URL parameters for Stripe setup completion
        const urlParams = new URLSearchParams(window.location.search);
        const setupStatus = urlParams.get('setup');
        
        if (setupStatus === 'complete') {
          setMessage("Stripe account setup completed successfully! You can now receive payouts.");
          setPaymentSetupStatus('setup');
          // Clear the URL parameter
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (setupStatus === 'refresh') {
          setMessage("Please complete your Stripe account setup to receive payouts.");
          // Clear the URL parameter
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check URL parameters for manage account completion
        const manageStatus = urlParams.get('manage');
        if (manageStatus === 'complete') {
          setMessage("Account details updated successfully!");
          // Clear the URL parameter
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (manageStatus === 'refresh') {
          setMessage("Please complete updating your account details.");
          // Clear the URL parameter
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        console.error("No user is currently signed in.");
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchPurchaseHistory(currentUser.uid);
    }
  }, [currentUser]);

  const fetchUserData = async (uid) => {
    try {
      console.log("🔍 [Profile] Fetching user data for UID:", uid);
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("🔍 [Profile] User data retrieved:", userData);
        console.log("🔍 [Profile] User offers found:", userData.offers);
        console.log("🔍 [Profile] Offers type:", typeof userData.offers);
        console.log("🔍 [Profile] Is offers an array?", Array.isArray(userData.offers));
        
        // Convert offers object to array if needed
        let offersArray = [];
        if (userData.offers) {
          if (Array.isArray(userData.offers)) {
            offersArray = userData.offers;
            console.log("✅ [Profile] Offers are already an array with length:", offersArray.length);
          } else if (typeof userData.offers === 'object') {
            // Convert object with numeric keys to array
            offersArray = Object.values(userData.offers);
            console.log("🔧 [Profile] CONVERTING OBJECT TO ARRAY");
            console.log("🔧 [Profile] Original object keys:", Object.keys(userData.offers));
            console.log("🔧 [Profile] Converted to array:", offersArray);
            console.log("🔧 [Profile] Array length after conversion:", offersArray.length);
            console.log("🔧 [Profile] First offer:", offersArray[0]);
            
            // Fix the data in Firestore permanently
            try {
              console.log("🔧 [Profile] Fixing Firestore data...");
              await updateDoc(userRef, {
                offers: offersArray
              });
              console.log("✅ [Profile] Successfully fixed offers format in Firestore");
            } catch (error) {
              console.error("❌ [Profile] Failed to fix offers in Firestore:", error);
            }
          }
        } else {
          console.log("⚠️ [Profile] No offers data found");
        }
        
        console.log("🎯 [Profile] FINAL RESULT - offers array:", offersArray);
        console.log("🎯 [Profile] FINAL RESULT - array length:", offersArray.length);
        console.log("🎯 [Profile] FINAL RESULT - is array?", Array.isArray(offersArray));
        
        setCredit(userData.credit || 0);
        setUserOffers(offersArray);
        
        // Verify state was set
        console.log("🎯 [Profile] Called setUserOffers with:", offersArray);
        
        setUserDetails({
          gpa: userData.gpa || "",
          testScore: userData.testScore || "",
          sai: userData.sai || "",
          state: userData.state || "",
          activities: userData.activities || "",
        });
        
        // Check payment setup status
        if (userData.stripeAccountId) {
          setPaymentSetupStatus('setup');
        } else {
          setPaymentSetupStatus('pending');
        }

        // Set last payout status
        setLastPayoutStatus(userData.lastPayoutStatus || null);
        setLastPayoutAmount(userData.lastPayoutAmount || null);
        setLastPayoutDate(userData.lastPayoutDate || null);

        // Set userStatus and pendingMessage
        setUserStatus(userData.userStatus || null);
        setPendingMessage(userData.pendingMessage || null);

        // Fetch payout history
        await fetchPayoutHistory(uid);
      } else {
        console.error("🚨 [Profile] User document not found for UID:", uid);
      }
    } catch (error) {
      console.error("🚨 [Profile] Error fetching user data:", error);
    }
  };

  const handleEditToggle = () => {
    setIsEditing((prev) => !prev);
  };

  const handleSaveDetails = async () => {
    const user = getAuth().currentUser;

    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, userDetails);
        setIsEditing(false);
        setMessage("Details updated successfully!");
      } catch (error) {
        console.error("Error updating user details:", error);
        setMessage("Failed to update details.");
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prevDetails) => ({
      ...prevDetails,
      [name]: value,
    }));
  };

  const handleRemoveOffer = async (offerIndex) => {
    const user = getAuth().currentUser;
    
    if (!user) {
      alert("You must be logged in to remove offers.");
      return;
    }

    // Confirm deletion
    const confirmRemoval = window.confirm(
      "Are you sure you want to remove this rejected offer? This action cannot be undone."
    );
    
    if (!confirmRemoval) return;

    try {
      // Create new offers array without the removed offer
      const updatedOffers = userOffers.filter((_, index) => index !== offerIndex);
      
      // Update Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        offers: updatedOffers
      });
      
      // Update local state
      setUserOffers(updatedOffers);
      
      // Reset pagination if needed
      const totalPages = Math.ceil(updatedOffers.length / ITEMS_PER_PAGE);
      if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
      }
      
      setMessage("Rejected offer removed successfully.");
    } catch (error) {
      console.error("Error removing offer:", error);
      setMessage("Failed to remove offer. Please try again.");
    }
  };

  const fetchPayoutHistory = async (uid) => {
    try {
      const payoutHistoryRef = collection(db, "users", uid, "payoutHistory");
      const q = query(payoutHistoryRef, orderBy("created", "desc"));
      const querySnapshot = await getDocs(q);
      
      const history = [];
      querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      
      setPayoutHistory(history);
    } catch (error) {
      console.error("Error fetching payout history:", error);
    }
  };

  const handleManageAccount = async () => {
    setMessage(null);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setMessage("User not authenticated. Please log in.");
        return;
      }

      setMessage("Redirecting to manage your account...");
      
      const response = await fetch(`${API_BASE_URL}/manageStripeAccount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.accountLink) {
        setMessage("Redirecting to Stripe account management...");
        setTimeout(() => {
          window.location.href = data.accountLink;
        }, 500);
      } else {
        setMessage(`Error: ${data.error || 'Failed to create management link'}`);
      }
    } catch (error) {
      console.error("Error managing account:", error);
      setMessage(`An error occurred: ${error.message}`);
    }
  };

  const handleSetupPayments = async () => {
    console.log("🔥 BUTTON CLICKED - handleSetupPayments called");
    setMessage(null);

    try {
      const user = getAuth().currentUser;
      console.log("🔥 USER CHECK:", user ? `User found: ${user.uid}` : "No user found");
      
      if (!user) {
        console.log("🔥 USER AUTH FAILED - stopping execution");
        setMessage("User not authenticated. Please log in.");
        return;
      }

      console.log("🔥 SETTING MESSAGE - Setting up your payment account...");
      setMessage("Setting up your payment account...");
      
      // Use HTTP endpoint instead of callable function
      console.log("🔥 ABOUT TO CALL FETCH - setupStripeAccount function for user:", user.uid);
      console.log("🔥 FETCH URL:", `${API_BASE_URL}/setupStripeAccount`);
      
      console.log("🔥 MAKING FETCH REQUEST NOW...");
      const response = await fetch(`${API_BASE_URL}/setupStripeAccount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      console.log("🔥 FETCH RESPONSE RECEIVED:", response.status, response.statusText);
      const data = await response.json();
      
      console.log("🔥 PARSED JSON DATA:", data);
      
      if (data.success) {
        console.log("🔍 ACCOUNT DETAILS:", data.accountDetails);
        setMessage(`Your Stripe account is already set up for payouts! Account ID: ${data.accountId}`);
        setPaymentSetupStatus('setup');
      } else if (data.onboardingRequired && data.accountLink) {
        setMessage("Redirecting to Stripe onboarding...");
        console.log("Redirecting to account setup:", data.accountLink);
        
        // Validate the account link before redirecting
        if (data.accountLink && data.accountLink.startsWith('https://')) {
          console.log("Valid account link found, redirecting...");
          // Add a small delay to ensure message is shown
          setTimeout(() => {
            window.location.href = data.accountLink;
          }, 500);
        } else {
          console.error("Invalid account link received:", data.accountLink);
          setMessage("Error: Invalid account setup link received. Please try again.");
        }
      } else {
        const errorMessage = data.message || data.error || 'Unknown error';
        console.log("Setup failed with error:", errorMessage);
        setMessage(`Error setting up payment: ${errorMessage}`);
      }
    } catch (error) {
      console.error("🔥 CATCH BLOCK - Error setting up payment:", error);
      console.error("🔥 CATCH BLOCK - Full error details:", error);
      console.error("🔥 CATCH BLOCK - Error type:", typeof error);
      console.error("🔥 CATCH BLOCK - Error name:", error.name);
      console.error("🔥 CATCH BLOCK - Error message:", error.message);
      console.error("🔥 CATCH BLOCK - Error stack:", error.stack);
      
      // More detailed error message
      if (error.code === 'unauthenticated') {
        setMessage("Authentication failed. Please log out and log back in.");
      } else if (error.code === 'unavailable') {
        setMessage("Service temporarily unavailable. Please try again in a moment.");
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setMessage(`Network error: ${error.message}. Check console for details.`);
      } else {
        setMessage(`An error occurred while setting up your payment account: ${error.message || 'Unknown error'}`);
      }
    }
  };

    // Helper function to force new account creation
  const handleForceNewAccount = async () => {
    setMessage("Clearing existing account and creating a fresh one...");
    
    try {
      const user = getAuth().currentUser;
      if (!user) {
        setMessage("User not authenticated. Please log in.");
        return;
      }

      console.log("Step 1: Clearing existing Stripe account from database...");
      
      // Clear from database first - use FieldValue.delete() to completely remove
      const { deleteField } = await import('firebase/firestore');
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { 
        stripeAccountId: deleteField(),
        stripeCustomerId: deleteField()
      });
      
      console.log("Step 2: Removed Stripe fields from database");
      setPaymentSetupStatus('pending');
      
      // Wait a moment for database propagation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log("Step 3: Creating fresh Stripe account...");
      
      // Use HTTP endpoint to create a fresh account
      const response = await fetch(`${API_BASE_URL}/setupStripeAccount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      const data = await response.json();
      
      console.log("Fresh account setup response:", data);
      
      if (data.onboardingRequired && data.accountLink) {
        setMessage("Fresh account created! Redirecting to Stripe onboarding...");
        console.log("SUCCESS! Redirecting to fresh account link:", data.accountLink);
        window.location.href = data.accountLink;
      } else if (data.success) {
        setMessage("Payment account setup complete!");
        setPaymentSetupStatus('setup');
      } else {
        const errorMessage = data.message || data.error || 'Unknown error';
        console.error("Fresh account creation failed:", errorMessage);
        setMessage(`Failed to create fresh account: ${errorMessage}`);
      }
      
    } catch (error) {
      console.error("Error in force new account:", error);
      setMessage(`Failed to create new account: ${error.message}`);
    }
  };

  // Function to handle onboarding completion for existing accounts
  const handleCompleteOnboarding = async () => {
    setMessage("Redirecting to complete your account setup...");
    
    try {
      const user = getAuth().currentUser;
      if (!user) {
        setMessage("User not authenticated. Please log in.");
        return;
      }

      // Get user's Stripe account ID
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      if (!userData?.stripeAccountId) {
        setMessage("No Stripe account found. Please set up payments first.");
        return;
      }

      console.log("Creating onboarding link for account:", userData.stripeAccountId);

      // Manual onboarding URLs don't work - need to use Force New Account instead
      setMessage("Direct onboarding link failed. Using Force New Account instead...");
      console.log("Manual onboarding not supported, falling back to account recreation");
      
      // Automatically trigger force new account
      setTimeout(async () => {
        await handleForceNewAccount();
      }, 1000);
      
    } catch (error) {
      console.error("Error creating onboarding link:", error);
      setMessage("Failed to create onboarding link. Please try 'Force Create New Account' instead.");
    }
  };

  const handleInitiatePayout = async () => {
    setMessage(null);

    // Check userStatus first
    if (userStatus === 'pending') {
      setMessage("Your account is currently under review. Please wait for approval before initiating payouts.");
      return;
    }

    if (credit <= 0) {
      setMessage("Insufficient credit to initiate payout.");
      return;
    }

    try {
      const user = getAuth().currentUser;
      if (!user) {
        setMessage("User not authenticated. Please log in.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/createPayout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: credit,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("Payout successfully initiated! Payment is pending to your account.");
        setLastPayoutStatus('pending');
        setLastPayoutAmount(credit);
        setLastPayoutDate(new Date().toISOString());
        setCredit(0); // Update credit to 0 since payout was successful
        // Refresh user data to get updated payout history
        await fetchUserData(user.uid);
      } else if (data.onboardingRequired) {
        setMessage("Redirecting to Stripe onboarding...");
        setTimeout(() => {
          window.location.href = data.accountLink;
        }, 1000);
      } else {
        setMessage(`Payout failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error initiating payout:", error);
      setMessage("An error occurred while initiating the payout.");
    }
  };

  const handleDismissPayoutNotification = () => {
    if (lastPayoutStatus === 'pending' && lastPayoutAmount && lastPayoutDate) {
      const key = `payout_dismissed_${lastPayoutAmount}_${lastPayoutDate}`;
      localStorage.setItem(key, '1');
    }
    setDismissedPayoutNotification(true);
  };

  const getSAIForOffer = (offer) => {
    if (offer.efc_or_sai) {
      return offer.efc_or_sai;
    }

    if (offer.efc_brackets) {
      for (const [bracketKey, value] of Object.entries(offer.efc_brackets)) {
        if (value === true) {
          if (bracketKey.startsWith("above_")) {
            const min = parseInt(bracketKey.replace(/[^0-9]/g, ""), 10);
            return min + 10000;
          } else if (bracketKey.startsWith("under_")) {
            const max = parseInt(bracketKey.replace(/[^0-9]/g, ""), 10);
            return max / 2;
          } else if (bracketKey.includes("_")) {
            const [minStr, maxStr] = bracketKey.split("_");
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);
            return (min + max) / 2;
          }
        }
      }
    }

    return "N/A";
  };

  const formatNumber = (value, noComma = false) => {
    if (!value) return "0";
    const num = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(num)) return "0";
    return noComma ? num.toFixed(0) : num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  const capitalizeFirstLetter = (name) => {
    const exceptions = ["of", "and", "for", "the", "at", "in", "on"];
    return name
      .toLowerCase()
      .split(" ")
      .map((word, index) => {
        if (index === 0 || !exceptions.includes(word)) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
      })
      .join(" ");
  };

  const handleSignOut = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      window.location.href = '/'; // Redirect to home page
    } catch (error) {
      console.error("Error signing out:", error);
      setMessage("Failed to sign out. Please try again.");
    }
  };

  const fetchPurchaseHistory = async (uid) => {
    try {
      setBillingLoading(true);
      const response = await fetch(`${API_BASE_URL}/getPurchaseHistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const data = await response.json();
      if (data.success) setPurchaseHistory(data.purchases || []);
    } catch (error) {
      console.error("Error fetching purchase history:", error);
    } finally {
      setBillingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 font-sans">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1"></div>
            <div className="flex-1 text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Profile</h1>
              <p className="text-gray-600">Manage your earnings, details, and offer letters</p>
            </div>
            <div className="flex-1 flex justify-end items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowSettingsDropdown((prev) => !prev)}
                  className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5 text-gray-700" />
                </button>
                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800"
                      onClick={() => { setShowSettingsDropdown(false); navigate('/billing-history'); }}
                    >
                      Billing History
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800"
                      onClick={() => { setShowSettingsDropdown(false); navigate('/payout-history'); }}
                    >
                      Payout History
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Earnings Dashboard */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 shadow-lg border border-white/50">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Earnings Dashboard</span>
            </h2>
            
            {/* User Status Information */}
            {userStatus === 'pending' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-800">Account Under Review</p>
                    <p className="text-xs text-red-700">
                      {pendingMessage || "Your account is currently under review. You cannot initiate payouts until your account is approved."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Setup Information */}
            {paymentSetupStatus === 'pending' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-amber-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-amber-800">Payment setup required</p>
                    <p className="text-xs text-amber-700">You need to set up your Stripe account to receive payments from your uploaded offers.</p>
                  </div>
                </div>
              </div>
            )}
            
            {paymentSetupStatus === 'setup' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-green-800">Payment setup complete</p>
                    <p className="text-xs text-green-700">You're all set to receive payments! Initiate a payout when you have earned credits.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Main Earnings Display */}
            <div className="bg-white rounded-xl p-8 shadow-md mb-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-500">Total Earnings</p>
                  <p className="text-4xl font-bold text-gray-900 transition-all duration-300 hover:text-green-600 hover:scale-105 cursor-default">
                    ${credit.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Pending Payout Status */}
            {lastPayoutStatus === 'pending' && lastPayoutAmount && !dismissedPayoutNotification && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <p className="text-sm font-medium text-yellow-800">Payout Pending</p>
                      <p className="text-xs text-yellow-700">
                        Your ${lastPayoutAmount.toFixed(2)} payout is being processed. Funds typically arrive in 2-7 business days.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDismissPayoutNotification}
                    className="text-yellow-600 hover:text-yellow-800 transition-colors duration-200 p-1"
                    aria-label="Dismiss notification"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* Debug section - only show if there are issues */}
              {message && (message.includes('Error') || message.includes('capability') || message.includes('transfers') || message.includes('incomplete')) && (
                <div className="col-span-full mb-4 space-y-2">
                  <div className="flex justify-center">
                    <button
                      onClick={handleForceNewAccount}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                      🔧 Fix Payment Setup - Create New Account
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 text-center">This will remove your incomplete Stripe account and create a fresh one with proper onboarding</p>
                </div>
              )}
              
              {/* Setup Payments or Manage Account Button */}
              {paymentSetupStatus === 'setup' ? (
                <button
                  onClick={handleManageAccount}
                  className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Manage Account
                </button>
              ) : (
                <button
                  onClick={handleSetupPayments}
                  className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                    <path d="M4 8h12v2H4V8z" />
                  </svg>
                  Set Up Payments
                </button>
              )}
              <button
                onClick={handleInitiatePayout}
                disabled={userStatus === 'pending'}
                className={`px-6 py-4 font-semibold rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center ${
                  userStatus === 'pending'
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-teal-500 text-white hover:shadow-xl transform hover:scale-105'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                {userStatus === 'pending' ? 'Payout Disabled' : 'Initiate Payout'}
              </button>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className="max-w-2xl mx-auto">
            <div className={`p-4 rounded-xl border ${
              // Success messages (green)
              message.includes("successfully") || 
              message.includes("complete") || 
              message.startsWith("Your Stripe account is already set up")
                ? "bg-green-50 border-green-200 text-green-800"
                // Info/Loading messages (blue)  
                : message.includes("Redirecting") || 
                  message.includes("Setting up") ||
                  message.includes("Please complete") ||
                  message.includes("Creating")
                ? "bg-blue-50 border-blue-200 text-blue-800"
                // Error messages (red)
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <div className="flex items-center">
                <svg className={`w-5 h-5 mr-3 ${
                  // Success messages (green checkmark)
                  message.includes("successfully") || 
                  message.includes("complete") || 
                  message.startsWith("Your Stripe account is already set up")
                    ? "text-green-500"
                    // Info/Loading messages (blue info icon)
                    : message.includes("Redirecting") || 
                      message.includes("Setting up") ||
                      message.includes("Please complete") ||
                      message.includes("Creating")
                    ? "text-blue-500"
                    // Error messages (red X)
                    : "text-red-500"
                }`} fill="currentColor" viewBox="0 0 20 20">
                  {/* Success icon (checkmark) */}
                  {message.includes("successfully") || 
                   message.includes("complete") || 
                   message.startsWith("Your Stripe account is already set up") ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  /* Info icon (i in circle) */
                  ) : message.includes("Redirecting") || 
                        message.includes("Setting up") ||
                        message.includes("Please complete") ||
                        message.includes("Creating") ? (
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  /* Error icon (X) */
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  )}
                </svg>
                <p className="font-medium">{message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Billing and Payouts Section */}
        {/* This section is now handled by the dropdown, so it's removed */}

        {/* Payout History Section */}
        {paymentSetupStatus === 'setup' && payoutHistory.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Payout History</h2>
              <button
                onClick={() => setShowPayoutHistory(!showPayoutHistory)}
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-lg transition-all duration-200"
              >
                {showPayoutHistory ? 'Hide History' : 'View History'}
              </button>
            </div>
            
            {showPayoutHistory && (
              <>
                <div className="space-y-3">
                  {payoutHistory.map((payout) => (
                    <div key={payout.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center mb-2">
                            {/* Status Dot and Label - Only for paid/processing */}
                            {payout.status === 'paid' ? (
                              <>
                                <div className="w-3 h-3 rounded-full mr-2 bg-green-500"></div>
                                <span className="text-sm font-medium text-green-800">Completed</span>
                              </>
                            ) : payout.status !== 'pending' ? (
                              <>
                                <div className="w-3 h-3 rounded-full mr-2 bg-gray-500"></div>
                                <span className="text-sm font-medium text-gray-800">Processing</span>
                              </>
                            ) : null}
                          </div>
                          <p className="text-2xl font-bold text-gray-900">${payout.amount.toFixed(2)}</p>
                          <p className="text-sm text-gray-600">
                            Initiated on {new Date(payout.created).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Payout ID</p>
                          <p className="text-xs font-mono text-gray-700">{payout.id}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4 text-xs text-gray-500">
                  Questions? Contact <a href="mailto:pocketly.ai@gmail.com" className="underline text-blue-600">pocketly.ai@gmail.com</a>
                </div>
              </>
            )}
          </div>
        )}

        {/* User Details Section */}
<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-bold text-gray-900">Your Details</h2>
    <button
      onClick={isEditing ? handleSaveDetails : handleEditToggle}
      className={`px-4 py-2 font-medium text-sm rounded-lg transition-all duration-200 ${
        isEditing 
          ? "bg-green-600 hover:bg-green-700 text-white shadow-md" 
          : "bg-[#635BFF] hover:bg-[#4e46d4] text-white shadow-md"
      }`}
    >
      {isEditing ? "Save Changes" : "Edit Details"}
    </button>
  </div>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* GPA Card */}
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center mb-1">
        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
          <span className="text-blue-600 font-semibold text-xs">📊</span>
        </div>
        <label className="text-sm font-semibold text-gray-700">Grade Point Average</label>
      </div>
      {isEditing ? (
        <input
          type="text"
          name="gpa"
          value={userDetails.gpa}
          onChange={handleInputChange}
          placeholder="Enter your GPA"
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      ) : (
        <p className="text-base font-medium text-gray-900 ml-8">{userDetails.gpa || "Not specified"}</p>
      )}
    </div>

    {/* Test Score Card */}
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center mb-1">
        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-2">
          <span className="text-purple-600 font-semibold text-xs">📝</span>
        </div>
        <label className="text-sm font-semibold text-gray-700">Test Score</label>
      </div>
      {isEditing ? (
        <input
          type="text"
          name="testScore"
          value={userDetails.testScore}
          onChange={handleInputChange}
          placeholder="SAT/ACT score"
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
        />
      ) : (
        <p className="text-base font-medium text-gray-900 ml-8">{userDetails.testScore || "Not specified"}</p>
      )}
    </div>

    {/* SAI Card */}
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center mb-1">
        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
          <span className="text-green-600 font-semibold text-xs">💰</span>
        </div>
        <label className="text-sm font-semibold text-gray-700">Student Aid Index</label>
      </div>
      {isEditing ? (
        <input
          type="text"
          name="sai"
          value={userDetails.sai}
          onChange={handleInputChange}
          placeholder="Enter your SAI"
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
        />
      ) : (
        <p className="text-base font-medium text-gray-900 ml-8">{userDetails.sai || "Not specified"}</p>
      )}
    </div>

    {/* State Card */}
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center mb-1">
        <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-2">
          <span className="text-orange-600 font-semibold text-xs">📍</span>
        </div>
        <label className="text-sm font-semibold text-gray-700">State of Residence</label>
      </div>
      {isEditing ? (
        <input
          type="text"
          name="state"
          value={userDetails.state}
          onChange={handleInputChange}
          placeholder="Enter your state"
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
        />
      ) : (
        <p className="text-base font-medium text-gray-900 ml-8">{userDetails.state || "Not specified"}</p>
      )}
    </div>
  </div>

  {/* Activities Section */}
  <div className="mt-5">
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center mb-2">
        <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mr-2">
          <span className="text-indigo-600 font-semibold text-xs">🎯</span>
        </div>
        <label className="text-sm font-semibold text-gray-700">Extracurricular Activities</label>
      </div>
      {isEditing ? (
        <textarea
          name="activities"
          value={userDetails.activities}
          onChange={handleInputChange}
          placeholder="Describe your extracurricular activities, awards, leadership roles, etc."
          rows={3}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none"
        />
      ) : (
        <p className="text-sm text-gray-900 ml-8 leading-relaxed">
          {userDetails.activities || "No activities specified"}
        </p>
      )}
    </div>
  </div>
</div>

  
        {/* Offer Letters Section */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">My Offer Letters</h2>
              <p className="text-gray-600 mt-1">Track your uploaded offer letters and their performance</p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>{userOffers.length} offer{userOffers.length !== 1 ? 's' : ''} uploaded</span>
            </div>
          </div>

          {userOffers.length > 0 ? (
            <div className="space-y-6">
              {/* Table Container */}
              <div className="w-full bg-white shadow-lg rounded-xl overflow-hidden">
                <Table>
                  <TableCaption className="text-gray-500 py-4">
                    Your uploaded offer letters and financial information
                  </TableCaption>

                  <TableHeader>
                    <TableRow>
                      <TableHead className="p-4 text-left font-semibold">Status</TableHead>
                      <TableHead className="p-4 text-left font-semibold">School</TableHead>
                      <TableHead className="p-4 text-left font-semibold">Cost of Attendance</TableHead>
                      <TableHead className="p-4 text-left font-semibold">Financial Aid</TableHead>
                      <TableHead className="p-4 text-left font-semibold">Merit Aid</TableHead>
                      <TableHead className="p-4 text-left font-semibold">Other Aid</TableHead>
                      <TableHead className="p-4 text-left font-semibold">Test Score</TableHead>
                      <TableHead className="p-4 text-left font-semibold">GPA</TableHead>
                      <TableHead className="p-4 text-left font-semibold">SAI</TableHead>
                      <TableHead className="p-4 text-left font-semibold">State</TableHead>
                      <TableHead className="p-4 text-left font-semibold">Admission Type</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {(() => {
                      const totalOffers = userOffers.length;
                      const totalPages = Math.ceil(totalOffers / ITEMS_PER_PAGE);
                      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                      const currentOffers = userOffers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                      
                      return currentOffers.map((offer, index) => (
                        <TableRow
                          key={index}
                          className="hover:bg-blue-50 transition-colors"
                        >
                          <TableCell className="p-4">
                            <div className="flex items-center justify-center space-x-2">
                              {offer.status === 'pending' ? (
                                <div className="flex items-center text-amber-500" title="Pending Review">
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : offer.status === 'rejected' ? (
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center text-red-500" title="Rejected">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <a
                                    href="/rejection-reasons"
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                    title="Learn why your offer was rejected"
                                  >
                                    Why?
                                  </a>
                                  <button
                                    onClick={() => handleRemoveOffer((currentPage - 1) * ITEMS_PER_PAGE + index)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                    title="Remove this rejected offer"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center text-green-500" title="Verified">
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="p-4 font-medium">
                            {capitalizeFirstLetter(offer.school_name || "Unknown School")}
                          </TableCell>
                          <TableCell className="p-4">
                            <span className="font-semibold text-gray-900">
                              ${formatNumber(offer.cost_of_attendance)}
                            </span>
                          </TableCell>
                          <TableCell className="p-4">
                            <span className="font-semibold text-green-600">
                              ${formatNumber(offer.financial_aid + (offer.need_based_grant_aid || 0))}
                            </span>
                          </TableCell>
                          <TableCell className="p-4">
                            <span className="font-semibold text-blue-600">
                              ${formatNumber(offer.merit_aid)}
                            </span>
                          </TableCell>
                          <TableCell className="p-4">
                            <span className="font-semibold text-purple-600">
                              ${formatNumber(offer.other_aid || offer.other_private_scholarships)}
                            </span>
                          </TableCell>
                          <TableCell className="p-4">
                            {offer.composite_sat
                              ? `SAT: ${formatNumber(offer.composite_sat, true)}`
                              : `ACT: ${formatNumber(offer.composite_act, true)}`}
                          </TableCell>
                          <TableCell className="p-4">{offer.gpa || "N/A"}</TableCell>
                          <TableCell className="p-4">
                            {(() => {
                              const saiValue = getSAIForOffer(offer);
                              return saiValue !== null ? formatNumber(saiValue) : "N/A";
                            })()}
                          </TableCell>
                          <TableCell className="p-4">
                            {offer.state_of_residence || "N/A"}
                          </TableCell>
                          <TableCell className="p-4">
                            {offer.admission_type || "Regular Admission"}
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {(() => {
                const totalOffers = userOffers.length;
                const totalPages = Math.ceil(totalOffers / ITEMS_PER_PAGE);
                
                if (totalPages > 1) {
                  return (
                    <Pagination className="flex justify-center">
                      <PaginationContent>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          className={currentPage === 1 ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"}
                        />
                        {Array.from({ length: totalPages }, (_, index) => (
                          <PaginationItem key={index}>
                            <PaginationLink
                              isActive={currentPage === index + 1}
                              onClick={() => setCurrentPage(index + 1)}
                              className="cursor-pointer"
                            >
                              {index + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationNext
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          className={currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"}
                        />
                      </PaginationContent>
                    </Pagination>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6-4h6m2 5l-7 7-7-7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No offer letters yet</h3>
              <p className="text-gray-500 mb-6">Upload your first offer letter to start earning money!</p>
              <button 
                onClick={() => window.location.href = '/offerLetterUpload'}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Upload Offer Letter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}  
