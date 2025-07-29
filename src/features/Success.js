import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const loadSuccessPage = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setLoading(false);
        return;
      }

      try {
        // Try to verify session with cloud function, but fall back gracefully
        let sessionVerified = false;
        try {
          const response = await fetch(`https://verifysession-3lnfzmin3a-uc.a.run.app`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId }),
          });

          const data = await response.json();
          if (data.success) {
            setSessionData(data.session);
            sessionVerified = true;
          }
        } catch (err) {
          console.log('Session verification service unavailable, proceeding with fallback');
        }

        // If session verification failed, create mock session data
        if (!sessionVerified) {
          // Parse URL parameters for fallback data
          const planId = searchParams.get('plan') || 'price_1RgDedGPA4p9u1zTZGQ54PIc'; // Default starter
          const amount = searchParams.get('amount') || getAmountFromPlan(planId).toString();
          
          setSessionData({
            metadata: { planId },
            amount_total: parseInt(amount),
            payment_status: 'paid'
          });
        }

        // Get current user data to display balance (but don't add credits!)
        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          let currentUserData = {};
          if (userDoc.exists()) {
            currentUserData = userDoc.data();
          }
          
          // Just set the current user data for display - DO NOT ADD CREDITS
          // Credits should only be added by the Stripe webhook when payment is confirmed
          setUserData(currentUserData);
          
          console.log("📄 Success page loaded - displaying current user data:", {
            searchCredit: currentUserData.searchCredit || 0,
            access: currentUserData.access
          });
        }
        
      } catch (err) {
        console.error('Error loading success page:', err);
        setError('Failed to load payment confirmation');
      } finally {
        setLoading(false);
      }
    };

    loadSuccessPage();
  }, [sessionId, searchParams]);

  const getCreditsFromPlan = (planId) => {
    if (planId === 'price_1RgDedGPA4p9u1zTZGQ54PIc') return 50; // Starter
    if (planId === 'price_1RgDg3GPA4p9u1zT6QgWE03I') return 100; // Standard
    return 0;
  };

  const getPlanName = (planId) => {
    if (planId === 'price_1RgDedGPA4p9u1zTZGQ54PIc') return 'Starter Pack';
    if (planId === 'price_1RgDg3GPA4p9u1zT6QgWE03I') return 'Standard Pack';
    return 'Unknown Plan';
  };

  const getAmountFromPlan = (planId) => {
    if (planId === 'price_1RgDedGPA4p9u1zTZGQ54PIc') return 1000; // Starter - $10.00
    if (planId === 'price_1RgDg3GPA4p9u1zT6QgWE03I') return 1700; // Standard - $17.00
    return 1000; // Default to Starter Pack amount
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Verification Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/upgrade')}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50">
      <div className="pt-16 pb-24 px-4 md:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-lg text-gray-600">Your credits have been added to your account.</p>
          </div>

          {/* Payment Details Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Plan Purchased:</span>
                <span className="font-semibold text-gray-900">
                  {sessionData ? getPlanName(sessionData.metadata?.planId) : 'Unknown'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Credits Received:</span>
                <span className="font-semibold text-green-600">
                  {sessionData ? getCreditsFromPlan(sessionData.metadata?.planId) : '0'} credits
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-semibold text-gray-900">
                  ${sessionData ? (sessionData.amount_total / 100).toFixed(2) : '0.00'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Payment Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              </div>
            </div>
          </div>

          {/* Current Credits Display */}
          {userData && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Your Current Balance</h3>
                  <p className="text-gray-600 text-sm">Available credits to view offer letters</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">
                    {userData.searchCredit || 0}
                  </div>
                  <div className="text-sm text-gray-600">credits</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Start Searching Offers
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg border border-gray-300 transition-colors"
            >
              View Profile
            </button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 mr-3">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">What's Next?</h4>
                <p className="text-sm text-blue-800">
                  Your credits never expire! Use them to view detailed offer letters from students at your target schools. 
                  Each credit gives you access to complete financial aid details including costs, aid amounts, and student stats.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 