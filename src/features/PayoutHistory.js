import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function PayoutHistory() {
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        const payoutHistoryRef = collection(db, "users", user.uid, "payoutHistory");
        const q = query(payoutHistoryRef, orderBy("created", "desc"));
        const querySnapshot = await getDocs(q);
        const history = [];
        querySnapshot.forEach((doc) => {
          history.push({ id: doc.id, ...doc.data() });
        });
        setPayoutHistory(history);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-2xl mx-auto my-8 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-bold mb-4">Payout History (Earnings)</h2>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : payoutHistory.length === 0 ? (
        <p className="text-gray-500">No payouts yet.</p>
      ) : (
        <ul>
          {payoutHistory.map(p => (
            <li key={p.id} className="mb-2 border-b pb-2">
              <div className="font-semibold">${p.amount.toFixed(2)} {p.currency?.toUpperCase() || "USD"}</div>
              <div className="text-xs text-gray-500">Date: {new Date(p.created).toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">Status: {p.status}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 