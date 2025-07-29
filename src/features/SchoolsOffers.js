/* eslint-disable */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; // For accessing ":id" from URL
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "/Users/arjungovind/Desktop/offersjscopy/my-app/src/ui/table"; // Adjust the path to match your project

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  increment,
  writeBatch,
  Timestamp,
  arrayUnion
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import firebaseApp from "../firebase"; // Adjust path as needed
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "/Users/arjungovind/Desktop/offersjscopy/my-app/src/ui/pagination"; // Adjust the path to match your project

import md5 from "md5";

// Number of items (offers) per page
const ITEMS_PER_PAGE = 5;

// Global lock to prevent duplicate credit transfers
const transferLocks = new Set();

export default function SchoolPage() {
  const { id } = useParams(); // React Router hook to get ":id"
  const navigate = useNavigate();
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [limitHit, setLimitHit] = useState(false); // State for search limit

  // Auth and user-tier logic
  const [user, setUser] = useState(null);
  const [userTier, setUserTier] = useState(null);

  // Credit system state  
  const [userCredits, setUserCredits] = useState(0);
  const [creditsDeducted, setCreditsDeducted] = useState(0);
  const [hasViewedBefore, setHasViewedBefore] = useState(false);
  const [viewedPages, setViewedPages] = useState(new Set()); // Track which pages have been viewed/paid for
  const [totalCreditsUsedThisSession, setTotalCreditsUsedThisSession] = useState(0);
  const [hasChargedInitialPage, setHasChargedInitialPage] = useState(false);

  // SAI is a numeric or null value
  const [SAI, setSAI] = useState(null);

  // Firestore, Auth
  const db = getFirestore(firebaseApp);
  const auth = getAuth(firebaseApp);

  // We'll store the random seed (whether from Firestore or a temporary fallback)
  const [userSchoolSeed, setUserSchoolSeed] = useState(null);

  // -----------------------
  // 1) Handle Auth Changes
  // -----------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch user tier and credits
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserTier(userData.access || "Free");
          setUserCredits(userData.searchCredit || 0);
        } else {
          setUserTier("Free");
          setUserCredits(0);
        }
      } else {
        setUser(null);
        setUserTier(null);
        setUserCredits(0);
      }
    });

    return () => unsubscribe();
  }, [auth, db]);

  // ----------------------------------
  // 2) Fetch School Data and Seed Logic
  // ----------------------------------
  useEffect(() => {
    async function fetchSchoolAndSeed() {
      try {
        setLoading(true);

        // Fetch the School Document
        const schoolDocRef = doc(db, "offerLetters", id);
        const schoolDocSnap = await getDoc(schoolDocRef);

        if (!schoolDocSnap.exists()) {
          console.error("No document found for the selected school.");
          setSchoolData(null);
          setLoading(false);
          return;
        }

        const schoolObj = schoolDocSnap.data();
        console.log(`[School Data] Fetched schoolDoc for ID = ${id}`, schoolObj);

        // If user is logged in, do the "myColleges" seed logic
        if (user) {
          console.log(`[Seed Logic] User is logged in: ${user.uid}`);
          const userRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userRef);

          if (!userDocSnap.exists()) {
            // If user doc doesn't exist, just show the data in locked form
            console.error("User document not found for the current user.");
            setSchoolData(schoolObj);
            setLoading(false);
            return;
          }

          const userData = userDocSnap.data() || {};
          const myColleges = userData.myColleges || [];

          // Look for existing entry
          let existingEntry = myColleges.find(
            (item) => item.schoolId === id
          );

          // If no entry, generate a seed and push it into myColleges
          let seed = "";
          const batch = writeBatch(db); // Initialize a batch
          if (!existingEntry) {
            const currentSearches = userData?.searches || 0;
            const maxSearches = userData?.max_searches || 0;
            if (currentSearches >= maxSearches) {
              console.log(`[Search Limit] User ${user.uid} has reached the search limit of ${maxSearches}`);
              setLimitHit(true); // Update state to indicate search limit reached
              // Still create a seed for the user to maintain consistency, but don't track this search
              seed = Math.random().toString(36).substring(2, 15);
              const schoolName = schoolObj.school_name;
              existingEntry = { schoolId: id, seed, name: schoolName };
              console.log(`[Seed Logic] Created seed for search-limited user ${user.uid}: ${seed}`);
            } else {
              // Only create new entry and increment searches if under limit
              seed = Math.random().toString(36).substring(2, 15);
              const schoolName = schoolObj.school_name; // Get the school name
              existingEntry = { schoolId: id, seed, name: schoolName };
              myColleges.push(existingEntry);

              batch.update(userRef, { myColleges });
              batch.update(userRef, { searches: increment(1) }); // Increment searches
              await batch.commit();

              console.log(`[Seed Logic] Created new seed for user ${user.uid}: ${seed}`);
            }
          } else {
            // Use the existing seed
            seed = existingEntry.seed;
            console.log(`[Seed Logic] Using existing seed for user ${user.uid}: ${seed}`);
          }
          setUserSchoolSeed(seed);

          // Sort offers with this seed
          if (schoolObj.offers && schoolObj.offers.length > 0) {
            console.log(`[Seed Logic] Offer count before filtering: ${schoolObj.offers.length}`);
            
            // Filter to only show approved offers (status === 'approved' or no status field)
            const approvedOffers = schoolObj.offers.filter(offer => 
              !offer.status || offer.status === 'approved'
            );
            console.log(`[Seed Logic] Approved offer count: ${approvedOffers.length}`);
            
            const sortedOffers = [...approvedOffers];

            // [DEBUG] Show the first 2 offers before sorting
            console.log("[Seed Logic] First 2 approved offers BEFORE sorting:", sortedOffers.slice(0, 2));

            sortedOffers.sort((a, b) => {
              const hashA = seededHash(String(a.uid ?? a.offer_id ?? ""), seed);
              const hashB = seededHash(String(b.uid ?? b.offer_id ?? ""), seed);
              return hashA - hashB;
            });

            console.log("[Seed Logic] Approved offers sorted with user-specific seed.");
            console.log("[Seed Logic] First 2 approved offers AFTER sorting:", sortedOffers.slice(0, 2));
            const finalOrder = sortedOffers.map((offer) => offer.uid ?? offer.offer_id ?? "unknown");
            console.log("[Seed Logic] Final approved offer ordering:", finalOrder);

            schoolObj.offers = sortedOffers;
          }
        } else {
          // If user is NOT logged in:
          console.log("[Seed Logic] No user logged in => using guest seed");
          const guestSeed = Math.random().toString(36).substring(2, 15);
          setUserSchoolSeed(guestSeed);
          console.log(`[Seed Logic] Guest seed: ${guestSeed}`);

          if (schoolObj.offers && schoolObj.offers.length > 0) {
            console.log(`[Seed Logic] Offer count before filtering: ${schoolObj.offers.length}`);
            
            // Filter to only show approved offers (status === 'approved' or no status field)
            const approvedOffers = schoolObj.offers.filter(offer => 
              !offer.status || offer.status === 'approved'
            );
            console.log(`[Seed Logic] Approved offer count: ${approvedOffers.length}`);
            
            const sortedOffers = [...approvedOffers];

            console.log("[Seed Logic] First 2 approved offers BEFORE sorting:", sortedOffers.slice(0, 2));

            sortedOffers.sort((a, b) => {
              const hashA = seededHash(a.uid || a.id || "", guestSeed);
              const hashB = seededHash(b.uid || b.id || "", guestSeed);
              return hashA - hashB;
            });

            console.log("[Seed Logic] Approved offers sorted with guest seed.");
            console.log("[Seed Logic] First 2 approved offers AFTER sorting:", sortedOffers.slice(0, 2));
            const finalOrder = sortedOffers.map((offr) => offr.uid || offr.id || "unknown");
            console.log("[Seed Logic] Final approved offer ordering:", finalOrder);

            schoolObj.offers = sortedOffers;
          }
        }

        // Extract top-level SAI if present
        if (schoolObj.efc_or_sai) {
          console.log(`[SAI] Using top-level efc_or_sai: ${schoolObj.efc_or_sai}`);
          setSAI(schoolObj.efc_or_sai);
        } else if (schoolObj.efc_brackets) {
          console.log("[SAI] Found efc_brackets, searching for true bracket...");
          let foundSAI = false;
          for (const [bracket, value] of Object.entries(schoolObj.efc_brackets)) {
            if (value === true) {
              if (bracket.startsWith("above_")) {
                const min = parseInt(bracket.replace(/[^0-9]/g, ""), 10);
                setSAI(min + 10000);
              } else {
                const [min, max] = bracket
                  .split("_")
                  .map((v) => parseInt(v.replace(/[^0-9]/g, ""), 10));
                setSAI((min + max) / 2);
              }
              foundSAI = true;
              break;
            }
          }
          if (!foundSAI) {
            console.error("[SAI] No true value found in efc_brackets.");
          }
        }

        setSchoolData(schoolObj);
      } catch (error) {
        console.error("Error fetching school data or user seed:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSchoolAndSeed();
  }, [id, db, user]);

  // ----------------------------------
  // 3) Handle Credit Deduction for Viewing Offers
  // ----------------------------------
  useEffect(() => {
    if (!loading && user && schoolData && schoolData.offers) {
      checkSchoolViewStatus();
    }
  }, [loading, user, schoolData]);

  // Handle first page initialization after view status is determined
  useEffect(() => {
    if (!loading && user && schoolData && (hasViewedBefore === true || hasViewedBefore === false)) {
      // View status has been determined, now handle first page
      if (hasViewedBefore) {
        // Return visitor - free access, just set the page
        setCurrentPage(1);
        console.log(`[Credit System] Return visitor - loading page 1 for free`);
      } else {
        // First-time visitor - charge for first page
        console.log(`[Credit System] First-time visitor - will charge for page 1`);
        handlePageNavigation(1);
      }
    }
  }, [loading, user, schoolData, hasViewedBefore]);

  // Simple credit calculation for pagination
  const getCreditsForPage = (pageNumber) => {
    if (!schoolData?.offers) return 0;
    
    const startIndex = (pageNumber - 1) * ITEMS_PER_PAGE;
    const offersOnThisPage = schoolData.offers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    if (pageNumber === 1) {
      // First page: charge 5 credits regardless of actual offer count (unless school has ≤5 total)
      return Math.min(5, schoolData.offers.length);
    } else {
      // Subsequent pages: charge exact number of offers on that page
      return offersOnThisPage.length;
    }
  };

  const checkSchoolViewStatus = async () => {
    if (!schoolData || !schoolData.offers || !user) {
      return;
    }

    // Get fresh user data to check viewing history
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    const freshUserData = userDoc.data();
    const freshCredits = freshUserData?.searchCredit || 0;

    // Check if user has viewed this school before (simple school-level check)
    const viewedOffers = freshUserData?.viewedOffers || {};
    const schoolKey = `school_${id}`;
    const hasViewedThisSchool = viewedOffers[schoolKey] || false;
    
    setUserCredits(freshCredits);
    setHasViewedBefore(hasViewedThisSchool);
    setCreditsDeducted(0);
    
    console.log(`[Credit System] ${hasViewedThisSchool ? 'Return visitor' : 'First-time visitor'} to school ${id}`);
    console.log(`[Credit System] School has ${schoolData.offers.length} total offers`);
  };

  const handlePageNavigation = async (newPage) => {
    if (!user) {
      setCurrentPage(newPage);
      return;
    }

    // Return visitors get free access
    if (hasViewedBefore) {
      setCurrentPage(newPage);
      console.log(`[Credit System] Return visitor - free navigation to page ${newPage}`);
      return;
    }

    // Check if this page has already been paid for in this session
    if (viewedPages.has(newPage)) {
      setCurrentPage(newPage);
      console.log(`[Credit System] Page ${newPage} already paid for in this session`);
      return;
    }

    // Calculate credits needed for this page
    const creditsNeeded = getCreditsForPage(newPage);
    
    // Get fresh user credits
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    const freshUserData = userDoc.data();
    const freshCredits = freshUserData?.searchCredit || 0;

    console.log(`[Credit System] Page ${newPage} requires ${creditsNeeded} credits. User has ${freshCredits} credits.`);

    if (freshCredits >= creditsNeeded) {
      try {
        // Deduct credits
        await updateDoc(userRef, {
          searchCredit: freshCredits - creditsNeeded
        });

        // Update local state
        setUserCredits(freshCredits - creditsNeeded);
        setTotalCreditsUsedThisSession(prev => prev + creditsNeeded);
        setViewedPages(prev => new Set(prev).add(newPage));
        setCurrentPage(newPage);

        // Mark school as viewed for future free access
        await updateDoc(userRef, {
          [`viewedOffers.school_${id}`]: true
        });

        console.log(`[Credit System] Paid ${creditsNeeded} credits for page ${newPage}. Credits remaining: ${freshCredits - creditsNeeded}`);
        
        // Transfer credits to offer owners and mark offers as viewed
        const startIndex = (newPage - 1) * ITEMS_PER_PAGE;
        const offersOnThisPage = schoolData.offers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        transferCreditsToOfferOwners(creditsNeeded, offersOnThisPage, newPage);
        markOffersAsViewed(offersOnThisPage);
      } catch (error) {
        console.error("Error deducting credits for page:", error);
      }
    } else {
      console.log(`[Credit System] Insufficient credits. Need: ${creditsNeeded}, Have: ${freshCredits}`);
    }
  };

  const markOffersAsViewed = async (offersOnPage) => {
    if (!user || !offersOnPage.length) {
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const schoolKey = `school_${id}`;
      
      // Simply mark the school as viewed for free access (no granular offer tracking needed)
      await updateDoc(userRef, {
        [`viewedOffers.${schoolKey}`]: true
      });

      console.log(`[Offer Tracking] Marked school ${id} as viewed for free access`);
    } catch (error) {
      console.error("Error marking school as viewed:", error);
    }
  };

  const transferCreditsToOfferOwners = async (creditsToDistribute, offersOnPage, pageNumber) => {
    if (!schoolData || !schoolData.offers || !offersOnPage.length || !user) {
      return;
    }

    const viewerUid = user.uid;
    
    // Create a unique key for this specific transfer to prevent duplicates
    const transferKey = `${id}_${pageNumber}_${viewerUid}`;
    
    // Check if this transfer is already in progress
    if (transferLocks.has(transferKey)) {
      console.log(`[CreditTransfer] 🔒 Transfer already in progress for key: ${transferKey}, aborting duplicate`);
      return;
    }
    
    // Lock this transfer
    transferLocks.add(transferKey);
    console.log(`[CreditTransfer] 🔓 Acquired lock for transfer key: ${transferKey}`);

    try {
      // Debug: Check what UIDs are available in offers
      console.log(`[CreditTransfer] Analyzing ${offersOnPage.length} offers on page ${pageNumber}`);
      console.log(`[CreditTransfer] Viewer UID: ${viewerUid}`);
      offersOnPage.forEach((offer, index) => {
        console.log(`[CreditTransfer] Offer ${index}: uid=${offer.uid}, offer_id=${offer.offer_id}, matches_viewer=${offer.uid === viewerUid}`);
      });

      // Get unique UIDs from the specific offers on this page
      const currentPageUids = [
        ...new Set(offersOnPage.map((offer) => offer.uid).filter(Boolean)),
      ];

      console.log(`[CreditTransfer] Found ${currentPageUids.length} unique valid UIDs: ${currentPageUids}`);

      if (currentPageUids.length === 0) {
        console.warn(`[CreditTransfer] ⚠️ No valid UIDs found in offers - no credits will be distributed`);
        transferLocks.delete(transferKey);
        return;
      }

      // Filter out self-views and users who have already been credited for this specific view
      const eligibleUids = [];

      console.log(`[CreditTransfer] Checking ${currentPageUids.length} unique UIDs for eligibility...`);

      for (const offerOwnerUid of currentPageUids) {
        // Triple check to prevent self-crediting
        if (offerOwnerUid === viewerUid || offerOwnerUid === user.uid) {
          console.log(`[CreditTransfer] Skipping self-view for UID: ${offerOwnerUid} (viewer: ${viewerUid}, user: ${user.uid})`);
          continue;
        }
        
        // Additional check for empty or invalid UIDs
        if (!offerOwnerUid || offerOwnerUid.trim() === '') {
          console.log(`[CreditTransfer] Skipping invalid/empty UID: ${offerOwnerUid}`);
          continue;
        }

        console.log(`[CreditTransfer] Checking eligibility for UID: ${offerOwnerUid}`);

        try {
          const userRef = doc(db, "users", offerOwnerUid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            console.error(`[CreditTransfer] ❌ User document not found for UID: ${offerOwnerUid}`);
            continue;
          }

          const userData = userDoc.data();
          const viewTracker = userData?.offerViews || {};
          const currentCredits = userData?.credit || 0;

          console.log(`[CreditTransfer] User ${offerOwnerUid} current credit balance: ${currentCredits}`);

          // Check if this specific viewer has already caused this offer owner to be credited
          // Use a more specific key: offerId_viewerUid format
          const offerSpecificKey = `${offerOwnerUid}_${viewerUid}`;
          if (viewTracker[offerSpecificKey]) {
            console.log(`[CreditTransfer] Already credited for offer owner ${offerOwnerUid} being viewed by ${viewerUid}`);
            continue;
          }

          console.log(`[CreditTransfer] ✅ User ${offerOwnerUid} is eligible for credits`);
          eligibleUids.push(offerOwnerUid);
        } catch (error) {
          console.error(`[CreditTransfer] Error checking eligibility for UID ${offerOwnerUid}:`, error);
        }
      }

      if (eligibleUids.length === 0) {
        console.log(`[CreditTransfer] No eligible offer owners to credit for page ${pageNumber}`);
        transferLocks.delete(transferKey);
        return;
      }

      // Give each offer owner 0.1 credits (fixed amount)
      const creditPerOwner = 0.1;

      console.log(`[CreditTransfer] Giving 0.1 credits to each of ${eligibleUids.length} offer owners`);

      // Double-check eligibility one more time before batch operation
      const finalEligibleUids = [];
      for (const offerOwnerUid of eligibleUids) {
        const userRef = doc(db, "users", offerOwnerUid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const viewTracker = userData?.offerViews || {};
          const offerSpecificKey = `${offerOwnerUid}_${viewerUid}`;
          if (!viewTracker[offerSpecificKey]) {
            finalEligibleUids.push(offerOwnerUid);
          } else {
            console.log(`[CreditTransfer] 🚫 Final check: User ${offerOwnerUid} already credited for being viewed by ${viewerUid}`);
          }
        }
      }

      if (finalEligibleUids.length === 0) {
        console.log(`[CreditTransfer] No users left after final eligibility check`);
        transferLocks.delete(transferKey);
        return;
      }

      // Use batch operation for consistency
      const batch = writeBatch(db);

      console.log(`[CreditTransfer] Preparing batch operation for ${finalEligibleUids.length} users`);
      
      for (const offerOwnerUid of finalEligibleUids) {
        const userRef = doc(db, "users", offerOwnerUid);
        const offerSpecificKey = `${offerOwnerUid}_${viewerUid}`;
        console.log(`[CreditTransfer] Adding 0.1 credits to user ${offerOwnerUid}`);
        batch.update(userRef, {
          credit: increment(0.10), // Use more precise decimal
          [`offerViews.${offerSpecificKey}`]: true // Track this specific viewer-offer owner relationship
        });
      }

      console.log(`[CreditTransfer] Committing batch operation...`);
      await batch.commit();
      console.log(`[CreditTransfer] ✅ Batch committed successfully! Gave 0.1 credits to each of ${finalEligibleUids.length} offer owners`);
      
      // Release the lock after successful completion
      transferLocks.delete(transferKey);
      console.log(`[CreditTransfer] 🔓 Released lock for transfer key: ${transferKey}`);

      // Verify credits were actually added (for debugging)
      setTimeout(async () => {
        console.log(`[CreditTransfer] Verifying credit updates...`);
        for (const offerOwnerUid of finalEligibleUids) {
          try {
            const userRef = doc(db, "users", offerOwnerUid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const newCredits = userData?.credit || 0;
              const roundedCredits = Math.round(newCredits * 10) / 10; // Round to 1 decimal place
              console.log(`[CreditTransfer] 🔍 User ${offerOwnerUid} credit balance after update: ${roundedCredits}`);
            }
          } catch (error) {
            console.error(`[CreditTransfer] Error verifying credits for ${offerOwnerUid}:`, error);
          }
        }
      }, 1000);
    } catch (error) {
      console.error("Error transferring credits to offer owners:", error);
      // Release the lock on error
      transferLocks.delete(transferKey);
      console.log(`[CreditTransfer] 🔓 Released lock on error for transfer key: ${transferKey}`);
    }
  };

  // No longer need school-level tracking since we now track individual offers
  // Individual offers are marked as viewed in markOffersAsViewed() when user navigates to pages

  // ----------------------------------
  // Helper: Convert an offer to an SAI
  // ----------------------------------
  function getSAIForOffer(offer) {
    if (offer.efc_or_sai) {
      return offer.efc_or_sai;
    }

    if (offer.efc_brackets) {
      for (const [bracketKey, value] of Object.entries(offer.efc_brackets)) {
        if (value === true) {
          if (bracketKey.startsWith("above_")) {
            const min = parseInt(bracketKey.replace(/[^0-9]/g, ""), 10);
            if (!isNaN(min)) {
              return min + 10000;
            }
          } else if (bracketKey.startsWith("under_")) {
            const max = parseInt(bracketKey.replace(/[^0-9]/g, ""), 10);
            if (!isNaN(max)) {
              return max / 2;
            }
          } else if (bracketKey.includes("_")) {
            const [minStr, maxStr] = bracketKey.split("_");
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);
            if (!isNaN(min) && !isNaN(max)) {
              return (min + max) / 2;
            }
          }
        }
      }
    }

    return "N/A";
  }

  // ----------------------------------
  // Helper: Deterministic "random" sort
  // ----------------------------------
  function seededHash(offerId, seed) {
    const hash = md5(offerId + seed);
    return parseInt(hash.slice(0, 8), 16);
  }

  // ----------------------------------
  // Pagination Logic
  // ----------------------------------
  const totalOffers = schoolData?.offers?.length || 0;
  const totalPages = Math.ceil(totalOffers / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  
  // All offers are available, but user pays per page for first-time visits
  const availableOffers = schoolData?.offers || [];
  const currentOffers = availableOffers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  
  // Check if current page requires payment
  const currentPageRequiresPayment = user && !hasViewedBefore && !viewedPages.has(currentPage);

  // ----------------------------------
  // Rendering
  // ----------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!schoolData || !schoolData.offers || totalOffers === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No offers found for the selected school.</p>
      </div>
    );
  }

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

  // Component to show credit cost for pagination
  const PaginationCreditLabel = ({ pageNumber }) => {
    const creditsNeeded = getCreditsForPage(pageNumber);
    return <span className="ml-1 text-xs text-orange-500">({creditsNeeded} C)</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white font-sans text-gray-900">
      
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-extrabold mb-4">
          {capitalizeFirstLetter(schoolData.school_name)} Offers
        </h1>

        {/* Credit Information */}
        {user && (
          <div className="mb-6 max-w-4xl w-full">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                      Credits Available: <span className="text-blue-600 font-bold">{userCredits}</span>
                    </span>
                  </div>
                  {totalCreditsUsedThisSession > 0 && !hasViewedBefore && (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">
                        Credits Used This Session: <span className="text-green-600 font-bold">{totalCreditsUsedThisSession}</span>
                      </span>
                    </div>
                  )}
                  {hasViewedBefore && (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">
                        <span className="text-blue-600 font-bold">Free Return Visit</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} ({currentOffers.length} offers on this page)
                  </div>
                  <div className="text-sm text-gray-600">
                    Total: {totalOffers} offers available
                  </div>
                  {hasViewedBefore && (
                    <div className="text-xs text-green-600 font-medium">
                      ✓ Return visit - no charge
                    </div>
                  )}
                  {!hasViewedBefore && (
                    <div className="text-xs text-blue-600 font-medium">
                      {getCreditsForPage(currentPage)} credits for this page
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Table Container */}
        <div className="w-full max-w-6xl bg-white shadow-lg">
          <Table>
            <TableCaption className="text-gray-500">
              Financial and Academic Offers for {capitalizeFirstLetter(schoolData.school_name)}
            </TableCaption>

            <TableHeader>
              <TableRow>
                <TableHead className="p-4 text-left">Verified</TableHead>
                <TableHead className="p-4 text-left">School</TableHead>
                <TableHead className="p-4 text-left">Cost of Attendance</TableHead>
                <TableHead className="p-4 text-left">Financial Aid</TableHead>
                <TableHead className="p-4 text-left">Merit Aid</TableHead>
                <TableHead className="p-4 text-left">Other Aid</TableHead>
                <TableHead className="p-4 text-left">Test Score</TableHead>
                <TableHead className="p-4 text-left">GPA</TableHead>
                <TableHead className="p-4 text-left">SAI</TableHead>
                <TableHead className="p-4 text-left">State</TableHead>
                <TableHead className="p-4 text-left">Type of Admission</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* Only show offers if user is logged in AND (has viewed before OR has paid for this page OR has enough credits) */}
              {user && (hasViewedBefore || viewedPages.has(currentPage) || userCredits >= getCreditsForPage(currentPage)) ? (
                currentOffers.map((offer, index) => (
                  <TableRow
                    key={index}
                    className="hover:bg-green-50 transition-colors cursor-pointer"
                  >
                    <TableCell className="p-4">
                      <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      {capitalizeFirstLetter(schoolData.school_name)}
                    </TableCell>
                    <TableCell className="p-4">
                      ${formatNumber(offer.cost_of_attendance)}
                    </TableCell>
                    <TableCell className="p-4">
                      $
                      {formatNumber(
                        offer.financial_aid + (offer.need_based_grant_aid || 0)
                      )}
                    </TableCell>
                    <TableCell className="p-4">
                      ${formatNumber(offer.merit_aid)}
                    </TableCell>
                    <TableCell className="p-4">
                      $
                      {formatNumber(
                        offer.other_aid || offer.other_private_scholarships
                      )}
                    </TableCell>
                    <TableCell className="p-4">
                      {offer.composite_sat
                        ? `SAT: ${formatNumber(offer.composite_sat, true)}`
                        : `ACT: ${formatNumber(offer.composite_act, true)}`}
                    </TableCell>
                    <TableCell className="p-4">{offer.gpa}</TableCell>
                    <TableCell className="p-4">
                      {(() => {
                        const saiValue = getSAIForOffer(offer);
                        return saiValue !== null ? formatNumber(saiValue) : "N/A";
                      })()}
                    </TableCell>
                    <TableCell className="p-4">
                      {offer.state_of_residence}
                    </TableCell>
                    <TableCell className="p-4">{offer.admission_type}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="p-4 text-center text-gray-400 italic" colSpan={11}>
                    {!user ? "Log in to view offers" : `You need ${getCreditsForPage(currentPage)} credits to view this page. You have ${userCredits} credits remaining.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationPrevious
              onClick={() => {
                const newPage = Math.max(currentPage - 1, 1);
                if (newPage !== currentPage) {
                  handlePageNavigation(newPage);
                }
              }}
            />
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              
              return (
                <PaginationItem key={index}>
                  <PaginationLink
                    isActive={currentPage === pageNumber}
                    onClick={() => {
                      if (pageNumber !== currentPage) {
                        handlePageNavigation(pageNumber);
                      }
                    }}
                  >
                    {pageNumber}
                    {!hasViewedBefore && !viewedPages.has(pageNumber) && pageNumber !== currentPage && (
                      <PaginationCreditLabel pageNumber={pageNumber} />
                    )}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationNext
              onClick={() => {
                const newPage = Math.min(currentPage + 1, totalPages);
                if (newPage !== currentPage) {
                  handlePageNavigation(newPage);
                }
              }}
            />
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
