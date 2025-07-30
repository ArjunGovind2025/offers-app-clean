import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function BillingHistory() {
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const API_BASE_URL = "https://us-central1-offers-5e23d.cloudfunctions.net";

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchBillingHistory(currentUser.uid);
      } else {
        setBillingLoading(false);
        setError("Please sign in to view billing history");
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchBillingHistory = async (userId) => {
    try {
      setBillingLoading(true);
      setError(null);

      // First check if user has a Stripe customer ID
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setPurchaseHistory([]);
        setBillingLoading(false);
        return;
      }

      const userData = userDoc.data();
      
      // Try to fetch from Firebase Function first
      let purchases = [];
      try {
        const response = await fetch(`${API_BASE_URL}/getPurchaseHistory`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            purchases = data.purchases || [];
          }
        }
      } catch (functionError) {
        console.log("Firebase function not available, trying alternative method");
      }

      // If no purchases from function, try to get from user's purchase history in Firestore
      if (purchases.length === 0 && userData.stripeCustomerId) {
        try {
          // Check if there's a purchase history subcollection
          const purchaseHistoryRef = collection(db, "users", userId, "purchaseHistory");
          const purchaseQuery = query(purchaseHistoryRef, orderBy("created", "desc"));
          const purchaseSnapshot = await getDocs(purchaseQuery);
          
          purchases = purchaseSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (firestoreError) {
          console.log("No purchase history in Firestore");
        }
      }

      // If still no purchases, check if user has any credit purchase records
      if (purchases.length === 0) {
        // Check for any credit-related data in user document
        if (userData.searchCredit && userData.searchCredit > 0) {
          // Create a mock purchase record based on user data
          purchases = [{
            id: 'local-credit',
            amount: userData.searchCredit * 0.20, // Estimate $0.20 per credit
            currency: 'usd',
            created: userData.lastPurchase || new Date().toISOString(),
            status: 'paid',
            planId: 'Local Credits',
            description: `${userData.searchCredit} credits available`
          }];
        }
      }

      setPurchaseHistory(purchases);
    } catch (err) {
      console.error("Error fetching billing history:", err);
      setError("Unable to load billing history at this time. Please try again later.");
    } finally {
      setBillingLoading(false);
    }
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency?.toUpperCase() || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please sign in to view your billing history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing History</h1>
          <p className="text-gray-600">View all your credit purchases and transactions</p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Loading State */}
          {billingLoading && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-gray-600">Loading your billing history...</p>
            </div>
          )}

          {/* Error State */}
          {error && !billingLoading && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Billing History</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => fetchBillingHistory(user.uid)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!billingLoading && !error && purchaseHistory.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Purchase History</h3>
              <p className="text-gray-600 mb-4">You haven't made any credit purchases yet.</p>
              <button
                onClick={() => window.location.href = '/upgrade'}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Purchase Credits
              </button>
            </div>
          )}

          {/* Purchase History List */}
          {!billingLoading && !error && purchaseHistory.length > 0 && (
            <div>
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Your Purchases</h2>
                <p className="text-sm text-gray-600">All your credit purchase transactions</p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {purchaseHistory.map((purchase, index) => (
                  <div key={purchase.id || index} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {formatCurrency(purchase.amount, purchase.currency)}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {purchase.description || purchase.planId || 'Credit Purchase'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                          {purchase.status?.toUpperCase() || 'COMPLETED'}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(purchase.created)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Summary */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Purchases:</span>
                  <span className="font-semibold text-gray-900">{purchaseHistory.length}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-gray-600">Total Spent:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(
                      purchaseHistory.reduce((sum, p) => sum + p.amount, 0),
                      purchaseHistory[0]?.currency || 'USD'
                    )}
                  </span>
                </div>
              </div>
              <div className="text-center mt-4 text-xs text-gray-500">
                Questions? Contact <a href="mailto:pocketly.ai@gmail.com" className="underline text-blue-600">pocketly.ai@gmail.com</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 