import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { auth } from "../firebase";

// Load your Stripe Publishable Key
const stripePromise = loadStripe("pk_test_51QaUzSGPA4p9u1zTx16UgrB59rhKJ3YQxbvDiPwExaKUgZxFUP48gENlIgrfzrORe11HVfy63kuXMm6dvHkRUTvd00s327zhO9");

export default function UpgradePlans() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const API_BASE_URL = "https://us-central1-offers-5e23d.cloudfunctions.net";

  const plans = [
    { 
      id: "price_1RgDedGPA4p9u1zTZGQ54PIc", // Test mode price ID for Starter Pack ($10)
      name: "Starter Pack", 
      price: "$10", 
      period: "one-time",
      features: "50 credits to view offer letters",
      description: "Perfect for exploring the platform",
      credits: "50",
      color: "blue",
      popular: false
    },
    { 
      id: "price_1RgDg3GPA4p9u1zT6QgWE03I", // Test mode price ID for Standard Pack ($17)
      name: "Standard Pack", 
      price: "$17", 
      period: "one-time",
      features: "100 credits to view offer letters",
      description: "Best value for regular users",
      credits: "100",
      color: "purple",
      popular: true
    }
  ];

  const handleUpgrade = async (planId) => {
    setLoading(true);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setMessage("User not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const userId = user.uid;

      // Call your backend endpoint
      const response = await fetch(`${API_BASE_URL}/createCheckoutSession`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, planId }),
      });

      const data = await response.json();

      if (data.success) {
        const stripe = await stripePromise;
        if (stripe) {
          const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (result.error) {
            setMessage(result.error.message || "Error redirecting to checkout.");
          }
        }
      } else {
        setMessage(data.error || "Error creating Stripe session.");
      }
    } catch (error) {
      console.error("Error during checkout:", error);
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getCardStyles = (plan) => {
    if (plan.popular) {
      return "bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 shadow-xl transform scale-105 relative";
    }
    return "bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:scale-102";
  };

  const getButtonStyles = (plan) => {
    if (plan.color === "gradient") {
      return "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700";
    } else if (plan.color === "purple") {
      return "bg-purple-600 hover:bg-purple-700";
    }
    return "bg-blue-600 hover:bg-blue-700";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header Section */}
      <div className="pt-8 pb-6 px-4 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Purchase Credits
          </h1>
          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Buy credits to view offer letters from other students. Each credit allows you to view one complete offer letter with all financial details.
          </p>
        </div>
      </div>

      {/* Plans Section */}
      <div className="pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.id} className="relative">
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                                 <div className={`${getCardStyles(plan)} rounded-2xl p-4 h-full flex flex-col`}>
                   {/* Plan Header */}
                   <div className="text-center mb-4">
                     <h3 className="text-xl font-bold text-gray-900 mb-1">
                       {plan.name}
                     </h3>
                     <p className="text-gray-600 text-sm mb-3">{plan.description}</p>
                     <div className="text-center mb-2">
                       <div className="text-3xl font-bold text-gray-900">{plan.price}</div>
                       <div className="text-sm text-gray-500">{plan.period}</div>
                     </div>
                   </div>

                   {/* Credits Display */}
                   <div className="flex-grow mb-4">
                     <div className={`${plan.color === 'purple' ? 'bg-gradient-to-r from-purple-50 to-blue-50' : 'bg-blue-50'} rounded-lg p-4 text-center mb-3`}>
                       <div className="flex items-center justify-center mb-2">
                         <div className={`w-12 h-12 ${plan.color === 'purple' ? 'bg-purple-500' : 'bg-blue-500'} rounded-full flex items-center justify-center`}>
                           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                           </svg>
                         </div>
                       </div>
                       <div className="text-2xl font-bold text-gray-900 mb-1">{plan.credits}</div>
                       <div className="text-gray-700 font-medium text-sm">Credits</div>
                       <div className="text-xs text-gray-600 mt-1">View {plan.credits} offer letters</div>
                     </div>

                     {/* Benefits - Condensed */}
                     <div className="space-y-2">
                       <div className="flex items-center text-xs text-gray-700">
                         <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                           <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                         </div>
                         <span>Complete offer details</span>
                       </div>
                       <div className="flex items-center text-xs text-gray-700">
                         <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                           <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                         </div>
                         <span>Never expires</span>
                       </div>
                       {plan.popular && (
                         <div className="flex items-center text-xs text-gray-700">
                           <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                             <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                           </div>
                           <span className="font-medium">Best value</span>
                         </div>
                       )}
                     </div>
                   </div>

                                     {/* CTA Button */}
                   <button
                     onClick={() => handleUpgrade(plan.id)}
                     disabled={loading}
                     className={`w-full py-2 px-4 text-white font-semibold rounded-lg text-sm
                       ${getButtonStyles(plan)}
                       transition-all duration-200 transform hover:scale-105 shadow-md
                       ${loading ? "opacity-60 cursor-not-allowed" : ""}
                       ${plan.popular ? "shadow-lg" : ""}
                     `}
                   >
                     {loading ? (
                       <div className="flex items-center justify-center">
                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                         Processing...
                       </div>
                     ) : (
                       `Buy ${plan.credits} Credits`
                     )}
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

                 {/* Trust Indicators */}
         <div className="mt-12 max-w-4xl mx-auto">
           <div className="bg-white rounded-2xl shadow-lg p-6">
             <div className="text-center mb-4">
               <h3 className="text-xl font-bold text-gray-900 mb-2">How Credits Work</h3>
               <p className="text-gray-600">Simple, transparent access to offer letter data</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="text-center">
                 <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                   <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                     <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                   </svg>
                 </div>
                 <h4 className="font-semibold text-gray-900 mb-1">One-Time Purchase</h4>
                 <p className="text-sm text-gray-600">Buy credits once, use anytime</p>
               </div>
               <div className="text-center">
                 <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                   <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                     <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                 </div>
                 <h4 className="font-semibold text-gray-900 mb-1">No Expiration</h4>
                 <p className="text-sm text-gray-600">Credits never expire</p>
               </div>
               <div className="text-center">
                 <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                   <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                   </svg>
                 </div>
                 <h4 className="font-semibold text-gray-900 mb-1">Complete Details</h4>
                 <p className="text-sm text-gray-600">Full financial aid breakdown</p>
               </div>
             </div>
           </div>
         </div>

        {/* Status Message */}
        {message && (
          <div className="mt-8 max-w-md mx-auto">
            <div className={`p-4 rounded-lg text-center font-medium ${
              message.includes("Error") || message.includes("error") 
                ? "bg-red-50 text-red-700 border border-red-200" 
                : "bg-green-50 text-green-700 border border-green-200"
            }`}>
              {message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
