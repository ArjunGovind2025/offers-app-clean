import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function BillingHistory() {
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const API_BASE_URL = "https://us-central1-offers-5e23d.cloudfunctions.net";

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setBillingLoading(true);
        const response = await fetch(`${API_BASE_URL}/getPurchaseHistory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid }),
        });
        const data = await response.json();
        if (data.success) setPurchaseHistory(data.purchases || []);
        setBillingLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-2xl mx-auto my-8 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-bold mb-4">Billing History (Credits Purchased)</h2>
      {billingLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : purchaseHistory.length === 0 ? (
        <p className="text-gray-500">No purchases yet.</p>
      ) : (
        <ul>
          {purchaseHistory.map(p => (
            <li key={p.id} className="mb-2 border-b pb-2">
              <div className="font-semibold">${p.amount.toFixed(2)} {p.currency.toUpperCase()}</div>
              <div className="text-xs text-gray-500">Date: {new Date(p.created).toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">Status: {p.status}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 