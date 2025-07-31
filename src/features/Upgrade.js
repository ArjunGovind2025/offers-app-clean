import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { auth } from "../firebase";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

export default function UpgradePlans() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const API_BASE_URL = "https://us-central1-offers-5e23d.cloudfunctions.net";

  const plans = [
    { 
      id: "price_1RgDedGPA4p9u1zTZGQ54PIc",
      name: "Starter Pack", 
      price: "$10", 
      period: "one-time",
      features: [
        "50 credits to view offer letters",
        "Complete financial aid breakdown",

      ],
      description: "Perfect for starting",
      credits: "50",
      color: "blue"
    },
    { 
      id: "price_1RgDg3GPA4p9u1zT6QgWE03I",
      name: "Standard Pack", 
      price: "$17", 
      period: "one-time",
      features: [
        "100 credits to view offer letters",
        "Complete financial aid breakdown",

      ],
      description: "Best value",
      credits: "100",
      color: "purple"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
      
      {/* Header Section */}
      <div className="relative pt-6 pb-2 px-4 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 leading-tight">
            Unlock
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Transparency</span>
          </h1>
          
          <p className="text-sm text-gray-600 mb-3 max-w-2xl mx-auto">
          We return payments to the students who share their offers to help support and sustain this ecosystem of transparency and access.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            <div className="text-center">
              <div className="text-base font-bold text-blue-600">2k+</div>
              <div className="text-xs text-gray-600">Offers</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-purple-600">1k+</div>
              <div className="text-xs text-gray-600">Schools</div>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Section */}
      <div className="relative pb-8 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-4">
            {plans.map((plan) => (
              <div key={plan.id} className="relative group">

                <div 
                  className={`relative bg-white rounded-2xl p-6 h-full border-2 transition-all duration-300 hover:scale-102 cursor-pointer
                    border-gray-200 shadow-lg hover:shadow-xl hover:border-blue-300
                    ${selectedPlan === plan.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
                  `}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {/* Gradient Background */}
                  <div className={`absolute inset-0 rounded-2xl opacity-5 bg-gradient-to-br from-blue-400 to-indigo-400`}></div>

                  <div className="relative">
                    {/* Plan Header */}
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      
                      {/* Price */}
                      <div className="mb-3">
                        <div className="text-center mb-1">
                          <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                        </div>
                        <div className="text-xs text-gray-500">{plan.period}</div>
                      </div>
                    </div>

                    {/* Credits Display */}
                    <div className="mb-4">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-center">
                        <div className="flex items-center justify-center mb-2">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mb-1">{plan.credits}</div>
                        <div className="text-gray-700 font-semibold text-sm">Credits</div>
                        <div className="text-xs text-gray-600">View {plan.credits} offer letters</div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2 text-center text-sm">What's Included:</h4>
                      <div className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center text-xs text-gray-700">
                            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                              <svg className="w-2 h-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={loading}
                      className={`w-full py-3 px-4 text-white font-semibold rounded-lg text-sm
                        transition-all duration-300 transform hover:scale-105 shadow-md
                        ${loading ? "opacity-60 cursor-not-allowed" : "hover:shadow-lg"}
                        bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                      `}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span>Get {plan.credits} Credits</span>
                          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Why Choose Our Platform?</h3>
              <p className="text-sm text-gray-600">
                Join thousands of students making informed decisions
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 text-sm">One-Time Purchase</h4>
                <p className="text-xs text-gray-600">No recurring fees</p>
              </div>
              
              <div className="text-center group">
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 text-sm">Never Expires</h4>
                <p className="text-xs text-gray-600">Use anytime</p>
              </div>
              
              <div className="text-center group">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 text-sm">Complete Details</h4>
                <p className="text-xs text-gray-600">Full breakdown</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className="mt-8 max-w-md mx-auto">
            <div className={`p-4 rounded-xl text-center font-medium shadow-lg ${
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
