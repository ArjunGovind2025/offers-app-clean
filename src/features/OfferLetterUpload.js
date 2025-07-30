/* eslint-disable */

import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  doc,
  getDoc,
  arrayUnion,
  writeBatch,
  increment,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth } from "../firebase"; // Adjust based on your Firebase config
import stringSimilarity from "string-similarity";
import { v4 as uuidv4 } from "uuid";

export default function OfferLetterUploadPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [formData, setFormData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [sectionReviews, setSectionReviews] = useState({
    basicInfo: "",
    aidScholarships: "",
    additionalDetails: "",
  });
  const [missingReviews, setMissingReviews] = useState([]);
  const [testOptional, setTestOptional] = useState(false);
  const navigate = useNavigate();

  // Check for pending submission after authentication
  useEffect(() => {
    const pendingSubmission = localStorage.getItem('pendingOfferSubmission');
    if (pendingSubmission && auth.currentUser) {
      try {
        const submissionData = JSON.parse(pendingSubmission);
        // Restore the form data and file
        setFormData(submissionData.formData);
        setSectionReviews(submissionData.sectionReviews);
        setTestOptional(submissionData.testOptional);
        
        // Clear the pending submission
        localStorage.removeItem('pendingOfferSubmission');
        
        // Auto-submit the form
        setTimeout(() => {
          handleSubmitInternal(
            submissionData.formData, 
            submissionData.sectionReviews, 
            submissionData.testOptional,
            submissionData.tempFileUrl,
            submissionData.fileName
          );
        }, 1000);
      } catch (error) {
        console.error('Error restoring pending submission:', error);
        localStorage.removeItem('pendingOfferSubmission');
      }
    }
  }, [auth.currentUser]);

  // Update missing reviews whenever section reviews change
  useEffect(() => {
    const unreviewed = [];
    if (sectionReviews.basicInfo !== "ok" && sectionReviews.basicInfo !== "flag") {
      unreviewed.push("School & Cost Information");
    }
    if (sectionReviews.aidScholarships !== "ok" && sectionReviews.aidScholarships !== "flag") {
      unreviewed.push("Financial Aid & Scholarships");
    }
    if (sectionReviews.additionalDetails !== "ok" && sectionReviews.additionalDetails !== "flag") {
      unreviewed.push("Student Information");
    }
    setMissingReviews(unreviewed);
  }, [sectionReviews]);

  /**
   * These fields will be parsed as numbers in our flattening function.
   */
  const numericFields = [
    "cost_of_attendance",
    "financial_aid",
    "merit_aid",
    "other_aid",
    "federal_money",
    "workstudy",
    "loans",
    "efc_or_sai",
    "composite_act",
    "composite_sat",
    "gpa",
  ];

  useEffect(() => {
    // Only run if a user is logged in
    const fetchUserDoc = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const userData = userSnap.data() || {};

        setFormData((prev) => {
          if (!prev) return prev; // If formData is null, do nothing yet

          // Determine if testScore is SAT or ACT based on value
          let satScore = "";
          let actScore = "";
          
          if (userData.testScore && userData.testScore !== "") {
            const score = parseInt(userData.testScore);
            if (score >= 400 && score <= 1600) {
              // Likely SAT score
              satScore = userData.testScore;
            } else if (score >= 1 && score <= 36) {
              // Likely ACT score
              actScore = userData.testScore;
            }
          }

          return {
            ...prev,
            efc_or_sai: {
              ...prev.efc_or_sai,
              amount:
                userData.sai && userData.sai !== ""
                  ? userData.sai
                  : prev.efc_or_sai?.amount || "",
            },
            composite_sat:
              satScore || prev.composite_sat || "",
            composite_act:
              actScore || prev.composite_act || "",
            gpa:
              userData.gpa && userData.gpa !== "" ? userData.gpa : prev.gpa || "",
            state_of_residence:
              userData.state && userData.state !== ""
                ? userData.state
                : prev.state_of_residence || "",
            activities:
              userData.activities && userData.activities !== ""
                ? userData.activities
                : prev.activities || "",
          };
        });
      } catch (error) {
        console.error("Error fetching user doc for autopopulate:", error);
      }
    };

    fetchUserDoc();
  }, [formData]); // Add formData as dependency to run when form is populated

  /**
   * Handle File Selection (PDF only).
   */
  const handleFileChange = async (event) => {
    if (!event.target.files) return;
    const originalFile = event.target.files[0];
    if (!originalFile) return;

    console.log("DEBUG: File selected:", originalFile);

    // Check if file is a PDF
    if (originalFile.type !== "application/pdf") {
      alert("Please select a PDF file only.");
      return;
    }

    // Set the file
    setFile(originalFile);
  };

  /**
   * Upload the file to our /api/analyze-offer endpoint and init formData
   */
  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file before uploading.");
      return;
    }
    console.log("DEBUG: Uploading file:", file);

    setSubmitted(false);
    console.log("DEBUG: Uploading file:", file);

    setLoading(true);
    setResponse(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const apiResponse = await axios.post("https://analyzeofferletter-3lnfzmin3a-uc.a.run.app", uploadFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("DEBUG: Full API response data: ", apiResponse.data);

      const structuredData = apiResponse.data.structuredData;
      console.log("DEBUG: structuredData from response: ", structuredData);

      setResponse(apiResponse.data);

      let schoolNameObject = { name: "" };
      if (structuredData?.school_name) {
        if (typeof structuredData.school_name === "object") {
          schoolNameObject = {
            name: structuredData.school_name.name || "",
          };
        } else if (typeof structuredData.school_name === "string") {
          schoolNameObject = {
            name: structuredData.school_name,
          };
        }
      }

      console.log("DEBUG: Derived schoolNameObject: ", schoolNameObject);

      setFormData({
        school_name: schoolNameObject,
        cost_of_attendance: {
          amount: structuredData?.cost_of_attendance?.amount || "",
          details: structuredData?.cost_of_attendance?.details || "",
        },
        financial_aid: {
          amount: structuredData?.financial_aid?.amount || "",
          details: structuredData?.financial_aid?.details || "",
        },
        merit_aid: {
          amount: structuredData?.merit_aid?.amount || "",
          details: structuredData?.merit_aid?.details || "",
        },
        other_aid: {
          amount: structuredData?.other_aid?.amount || "",
          details: structuredData?.other_aid?.details || "",
        },
        federal_money: {
          amount: structuredData?.federal_money?.amount || "",
          details: structuredData?.federal_money?.details || "",
        },
        loans: {
          amount: structuredData?.loans?.amount || "",
          details: structuredData?.loans?.details || "",
        },
        workstudy: {
          amount: structuredData?.workstudy?.amount || "",
          details: structuredData?.workstudy?.details || "",
        },
        efc_or_sai: {
          amount: structuredData?.efc_or_sai?.amount || "",
          details: structuredData?.efc_or_sai?.details || "",
        },
        composite_act: structuredData?.composite_act || "",
        composite_sat: structuredData?.composite_sat || "",
        gpa: structuredData?.gpa || "",
        state_of_residence: structuredData?.state_of_residence || "",
        admission_type: structuredData?.admission_type || "",
      });

      console.log("DEBUG: formData after setFormData: ", formData);
    } catch (error) {
      console.error("Error uploading file:", error);
      if (axios.isAxiosError(error) && error.response) {
        setResponse(error.response.data || "An error occurred during analysis.");
      } else {
        alert("There was an error uploading your file. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Use stringSimilarity to find the closest school name from your Firestore
   */
  const findClosestSchool = async (schoolName) => {
    const allDataRef = doc(db, "collegeData", "allData");
    const allDataSnap = await getDoc(allDataRef);

    if (!allDataSnap.exists()) {
      return null;
    }

    const allSchools = allDataSnap.data();
    const schoolNames = Object.values(allSchools).map((school) => school.name);

    const bestMatch = stringSimilarity.findBestMatch(schoolName, schoolNames);
    const closestMatch = bestMatch.bestMatch.target;

    const matchedIpedsId = Object.keys(allSchools).find(
      (key) => allSchools[key].name === closestMatch
    );

    return matchedIpedsId || null;
  };

  /**
   * If subField is provided (e.g. "amount", "details"), update a nested object.
   */
  const handleChange = (field, subField, value) => {
    setFormData((prev) => {
      if (subField) {
        return {
          ...prev,
          [field]: {
            ...prev[field],
            [subField]: value,
          },
        };
      } else {
        return {
          ...prev,
          [field]: value,
        };
      }
    });
  };

  /**
   * Flatten nested objects for Firestore
   */
  const flattenFormData = (data) => {
    const result = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === "school_name") {
        result[key] = value?.name || "";
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const amt = value.amount ?? "";
        const det = value.details ?? "";

        if (numericFields.includes(key)) {
          const strippedValue = String(amt).replace(/,/g, "").trim();
          const parsedValue = parseFloat(strippedValue);
          result[key] = isNaN(parsedValue) ? 0 : parsedValue;
        } else {
          result[key] = amt;
        }

        result[`${key}_details`] = det;
      } else {
        if (numericFields.includes(key)) {
          const strippedValue = String(value || "").replace(/,/g, "").trim();
          const parsedValue = parseFloat(strippedValue);
          result[key] = isNaN(parsedValue) ? 0 : parsedValue;
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  };

  /**
   * Submit to Firestore
   */
  const handleSubmit = async () => {
    console.log("DEBUG: Raw formData before submit:", JSON.stringify(formData, null, 2));
    console.log("DEBUG: Section reviews state:", sectionReviews);

    // Check if user is authenticated
    if (!auth.currentUser) {
      // Upload file to temporary storage first
      if (!file) {
        alert("No file selected. Please upload a file first.");
        return;
      }

      setLoading(true);
      try {
        const storage = getStorage();
        const tempFileRef = ref(storage, `tempOfferLetters/${Date.now()}_${file.name}`);
        
        console.log("DEBUG: Uploading file to temporary storage...");
        await uploadBytes(tempFileRef, file);
        
        console.log("DEBUG: Getting temporary file URL...");
        const tempFileUrl = await getDownloadURL(tempFileRef);
        
        // Store form data and temporary file URL for later submission
        const submissionData = {
          formData,
          sectionReviews,
          testOptional,
          tempFileUrl,
          fileName: file.name,
          timestamp: Date.now()
        };
        localStorage.setItem('pendingOfferSubmission', JSON.stringify(submissionData));
        
        setLoading(false);
        
        // Redirect to sign-in page
        navigate('/auth');
        return;
      } catch (error) {
        console.error("Error uploading file to temporary storage:", error);
        alert("Failed to prepare submission. Please try again.");
        setLoading(false);
        return;
      }
    }

    // If authenticated, proceed with submission
    await handleSubmitInternal(formData, sectionReviews, testOptional);
  };

  /**
   * Internal submit function (called after authentication)
   */
  const handleSubmitInternal = async (dataToSubmit, reviewsToSubmit, testOptionalToSubmit, tempFileUrl = null, fileName = null) => {
    // Validate that all sections have been reviewed (must be either "ok" or "flag")
    const unreviewed = [];
    if (reviewsToSubmit.basicInfo !== "ok" && reviewsToSubmit.basicInfo !== "flag") {
      unreviewed.push("School & Cost Information");
    }
    if (reviewsToSubmit.aidScholarships !== "ok" && reviewsToSubmit.aidScholarships !== "flag") {
      unreviewed.push("Financial Aid & Scholarships");
    }
    if (reviewsToSubmit.additionalDetails !== "ok" && reviewsToSubmit.additionalDetails !== "flag") {
      unreviewed.push("Student Information");
    }

    if (unreviewed.length > 0) {
      setMissingReviews(unreviewed);
      alert(`Please review all sections before submitting. Missing reviews:\n• ${unreviewed.join('\n• ')}`);
      return;
    }

    setMissingReviews([]); // Clear any previous errors

    if (!dataToSubmit || !dataToSubmit.school_name) {
      alert("Missing school name. Cannot submit.");
      return;
    }

    if (!file && !tempFileUrl) {
      alert("No file selected. Please upload a file first.");
      return;
    }

    // Validate test scores or test optional selection
    if (!testOptionalToSubmit && !dataToSubmit?.composite_act && !dataToSubmit?.composite_sat) {
      alert("Please either select 'Test Optional' or provide at least one test score (ACT or SAT).");
      return;
    }

    // Validate admission type is selected
    if (!dataToSubmit?.admission_type) {
      alert("Please select an admission type.");
      return;
    }

    setLoading(true);

    try {
      const schoolName = dataToSubmit?.school_name?.name || "";

      if (!schoolName) {
        alert("No school name found in formData!");
        setLoading(false);
        return;
      }

      const ipedsId = await findClosestSchool(schoolName);

      console.log("DEBUG: Found ipedsId for closest school: ", ipedsId);

      if (!ipedsId) {
        alert("No matching school found!");
        setLoading(false);
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        alert("User not authenticated!");
        setLoading(false);
        return;
      }

      const flattenedData = flattenFormData(dataToSubmit);
      console.log("DEBUG: Flattened data:", JSON.stringify(flattenedData, null, 2));

      const uniqueId = uuidv4();
      let fileUrl;

      if (tempFileUrl) {
        // Use the temporary file URL if available
        fileUrl = tempFileUrl;
      } else {
        // Upload the file normally
        const storage = getStorage();
        const fileRef = ref(storage, `offerLetters/${uniqueId}`);

        console.log("DEBUG: Uploading file to Firebase Storage...");
        await uploadBytes(fileRef, file);

        console.log("DEBUG: Getting file's download URL...");
        fileUrl = await getDownloadURL(fileRef);
      }

      console.log("DEBUG: File uploaded successfully. File URL:", fileUrl);

      const batch = writeBatch(db);
      const currentDate = Timestamp.now();

      // Get sections that are flagged for review
      const flaggedSections = [];
      if (reviewsToSubmit.basicInfo === "flag") flaggedSections.push("basicInfo");
      if (reviewsToSubmit.aidScholarships === "flag") flaggedSections.push("aidScholarships");
      if (reviewsToSubmit.additionalDetails === "flag") flaggedSections.push("additionalDetails");

      const offerData = {
        ...flattenedData,
        test_optional: testOptionalToSubmit,
        schoolId: ipedsId,
        offerId: uniqueId,
        fileUrl: fileUrl,
        date: currentDate,
        sectionReviews: reviewsToSubmit,
        flaggedForReview: flaggedSections.length > 0,
        flaggedSections: flaggedSections,
        status: 'pending', // Always set status to pending
      };

      // Check if user has existing profile data
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      
      // Prepare user profile updates
      const userProfileUpdates = {};
      let hasNewData = false;
      
      // Check if user is entering these details for the first time
      if (dataToSubmit?.efc_or_sai?.amount && (!userData.sai || userData.sai === "")) {
        userProfileUpdates.sai = dataToSubmit.efc_or_sai.amount;
        hasNewData = true;
      }
      
      // Handle test scores - prioritize SAT over ACT if both are present
      if ((dataToSubmit?.composite_sat || dataToSubmit?.composite_act) && (!userData.testScore || userData.testScore === "")) {
        if (dataToSubmit?.composite_sat) {
          userProfileUpdates.testScore = dataToSubmit.composite_sat;
        } else if (dataToSubmit?.composite_act) {
          userProfileUpdates.testScore = dataToSubmit.composite_act;
        }
        hasNewData = true;
      }
      
      if (dataToSubmit?.gpa && (!userData.gpa || userData.gpa === "")) {
        userProfileUpdates.gpa = dataToSubmit.gpa;
        hasNewData = true;
      }
      
      if (dataToSubmit?.state_of_residence && (!userData.state || userData.state === "")) {
        userProfileUpdates.state = dataToSubmit.state_of_residence;
        hasNewData = true;
      }

      // Add offer to user's offers array
      batch.update(userRef, {
        offers: arrayUnion(offerData),
        ...userProfileUpdates, // Include any new profile data
      });

      // Update the school's offer list and timestamp (create if doesn't exist)
      const offerLettersRef = doc(db, "offerLetters", ipedsId);
      batch.set(offerLettersRef, {
        offers: arrayUnion({
          ...offerData,
          uid: user.uid,
        }),
        lastOfferAdded: currentDate, // Track when the latest offer was added
        school_name: dataToSubmit?.school_name?.name || "Unknown School", // Store school name for reference
      }, { merge: true }); // Use merge to create document if it doesn't exist

      // Update the main college data
      const allDataRef = doc(db, "collegeData", "allData");
      const schoolDataPath = `${ipedsId}.offer_count`;
      batch.update(allDataRef, {
        [schoolDataPath]: increment(1),
        [`${ipedsId}.lastOfferAdded`]: currentDate, // Also track in main data
      });

      console.log(`DEBUG: Setting lastOfferAdded timestamp: ${currentDate.toDate().toISOString()} for school ${ipedsId}`);

      await batch.commit();

      // Show success message with profile update info if applicable
      if (hasNewData) {
        alert("Offer data successfully added! Your profile has been updated with the new information you provided.");
      } else {
        alert("Offer data successfully added!");
      }

      setSubmitted(true);
      setFormData(null);
      setResponse(null);
      setFile(null);
      
      // Show success message instead of redirecting
      // navigate('/success');
    } catch (error) {
      console.error("Error submitting offer data:", error);
      alert("Failed to submit the offer data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const shouldShowDetails = (amount) => {
    return amount !== null && amount !== undefined && amount !== "" && amount !== 0;
  };

  const handleSectionReviewChange = (section, value) => {
    console.log("DEBUG: Section review change:", section, "->", value);
    setSectionReviews((prev) => {
      const updated = {
        ...prev,
        [section]: value,
      };
      console.log("DEBUG: Updated section reviews:", updated);
      return updated;
    });
  };

  console.log("DEBUG: Current formData in render: ", formData);
  console.log("DEBUG: formData?.school_name in render: ", formData?.school_name);

  // Add this helper function inside the component
  const isStudentInfoComplete = () => {
    return (
      formData?.efc_or_sai?.amount &&
      (testOptional || formData?.composite_act || formData?.composite_sat) &&
      formData?.gpa &&
      formData?.state_of_residence &&
      formData?.admission_type
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navbar */}

      <div className="relative overflow-hidden min-h-screen flex flex-col items-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
        
        <div className="relative w-full flex flex-col items-center">
        {/* Page Header */}
        <header className="text-center mb-8 max-w-4xl">
          <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full text-xs font-medium text-gray-700 mb-4">
            <svg className="w-3 h-3 mr-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secure • Private • Fast
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            Upload Your{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Offer Letter
            </span>
          </h1>
          <p className="text-base text-gray-600 mb-4 max-w-2xl mx-auto leading-relaxed">
            Upload a PDF of your offer letter.
            Our AI system will analyze it and categorize aid types.
          </p>
          
          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
            <div className="flex items-center justify-center text-xs text-gray-600">
              <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Anonymous
            </div>
            <div className="flex items-center justify-center text-xs text-gray-600">
              <svg className="w-4 h-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              AI-Powered
            </div>
            <div className="flex items-center justify-center text-xs text-gray-600">
              <svg className="w-4 h-4 mr-1 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              Earn Money
            </div>
          </div>
        </header>

                 {/* Enhanced File Upload Card - Hide when form data exists */}
         {!formData && (
         <div className="w-full max-w-xl bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-white/20 mb-6">
           <div className="text-center mb-4">
             <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-3">
               <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
             </div>
             <h3 className="text-lg font-bold text-gray-900 mb-1">Choose Your File</h3>
             <p className="text-gray-600 text-sm">Drag and drop or click to select</p>
           </div>

           {/* Drag and Drop Upload Area */}
           <div className="relative">
             <input
               type="file"
               accept=".pdf"
               onChange={handleFileChange}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
               id="file-upload"
             />
             <label
               htmlFor="file-upload"
               className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                 file
                   ? "border-green-300 bg-green-50"
                   : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
               }`}
             >
               {file ? (
                 <div className="text-center">
                   <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   <p className="text-green-700 font-semibold text-sm">{file.name}</p>
                   <p className="text-green-600 text-xs">
                     {(file.size / 1024 / 1024).toFixed(2)} MB
                   </p>
                 </div>
               ) : (
                 <div className="text-center">
                   <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                   </svg>
                   <p className="text-gray-700 font-medium text-sm">Drop file here</p>
                   <p className="text-gray-500 text-xs">PDF files only (Max 10MB)</p>
                 </div>
               )}
             </label>
           </div>

           {/* Upload Button */}
           <div className="mt-4">
             <button
               onClick={handleUpload}
               disabled={loading || !file}
               className={`w-full py-3 px-4 rounded-xl font-semibold text-base transition-all duration-300 transform ${
                 loading
                   ? "bg-gray-400 cursor-not-allowed"
                   : !file
                   ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                   : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl"
               }`}
             >
               {loading ? (
                 <div className="flex items-center justify-center space-x-2">
                   <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   <span>Analyzing...</span>
                 </div>
               ) : !file ? (
                 "Select a file first"
               ) : (
                 <div className="flex items-center justify-center space-x-2">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                   </svg>
                   <span>Upload and Analyze</span>
                 </div>
               )}
             </button>
           </div>

           {/* Upload Progress/Status */}
           {loading && (
             <div className="mt-4 bg-blue-50 rounded-lg p-3">
               <div className="flex items-center text-blue-700">
                 <svg className="animate-pulse w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                   <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                 </svg>
                 <span className="font-medium text-sm">AI analyzing document...</span>
               </div>
               <div className="mt-2 bg-blue-200 rounded-full h-1.5">
                 <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
               </div>
             </div>
           )}
         </div>
         )}

                 {/* Information Cards */}
   

        {/* If we have formData, show the results */}
        {!submitted && formData && (
          <div className="w-full max-w-6xl mt-12 bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-2xl border border-gray-100">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                Offer Letter Analysis Complete
              </h2>
              <p className="text-gray-600 text-lg">Please review the extracted information and make any necessary corrections</p>
            </div>

            {/* =============================
                SCHOOL & COST SECTION
               (Always Read-Only)
            ============================= */}
            <div className={`bg-white rounded-2xl p-8 shadow-lg mb-8 ${
              missingReviews.includes("School & Cost Information") 
                ? "border-2 border-red-300 bg-red-50" 
                : sectionReviews.basicInfo === "flag"
                ? "border-2 border-yellow-300 bg-yellow-50"
                : sectionReviews.basicInfo === "ok"
                ? "border-2 border-green-300 bg-green-50"
                : "border border-gray-100"
            }`}>
              <div className="flex items-center mb-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                  missingReviews.includes("School & Cost Information")
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : sectionReviews.basicInfo === "flag"
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                    : sectionReviews.basicInfo === "ok"
                    ? "bg-gradient-to-r from-green-500 to-green-600"
                    : "bg-gradient-to-r from-blue-500 to-purple-600"
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800">School & Cost Information</h3>
                  {missingReviews.includes("School & Cost Information") && (
                    <p className="text-red-600 font-medium text-sm mt-1">⚠ Please review this section</p>
                  )}
                  {sectionReviews.basicInfo === "flag" && (
                    <p className="text-yellow-600 font-medium text-sm mt-1">🏁 Flagged for review</p>
                  )}
                  {sectionReviews.basicInfo === "ok" && (
                    <p className="text-green-600 font-medium text-sm mt-1">✓ Review complete</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* School Name */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold text-lg">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    School Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData?.school_name?.name || ""}
                      readOnly
                      className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 text-gray-800 font-medium text-lg shadow-sm"
                    />
                  </div>
                </div>

                {/* Cost of Attendance */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold text-lg">
                    <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Total Cost of Attendance
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 text-lg font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.cost_of_attendance?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-green-50 to-blue-50 text-gray-800 font-medium text-lg shadow-sm"
                    />
                  </div>

                </div>
              </div>

              {/* Review Status */}
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-blue-800 font-semibold text-lg flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Is this information correct?
                  </span>
                  <div className="flex space-x-6">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        className="form-radio text-green-500 h-5 w-5"
                        name="basicInfo"
                        value="ok"
                        checked={sectionReviews.basicInfo === "ok"}
                        onChange={() => handleSectionReviewChange("basicInfo", "ok")}
                      />
                      <span className="ml-3 text-green-700 font-medium">✓ Looks Good</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        className="form-radio text-red-500 h-5 w-5"
                        name="basicInfo"
                        value="flag"
                        checked={sectionReviews.basicInfo === "flag"}
                        onChange={() => handleSectionReviewChange("basicInfo", "flag")}
                      />
                      <span className="ml-3 text-red-700 font-medium">⚠ Flag for Review</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ===============================
                FINANCIAL AID SECTION
               (Details are Editable)
            =============================== */}
            <div className={`bg-white rounded-2xl p-8 shadow-lg mb-8 ${
              missingReviews.includes("Financial Aid & Scholarships") 
                ? "border-2 border-red-300 bg-red-50" 
                : sectionReviews.aidScholarships === "flag"
                ? "border-2 border-yellow-300 bg-yellow-50"
                : sectionReviews.aidScholarships === "ok"
                ? "border-2 border-green-300 bg-green-50"
                : "border border-gray-100"
            }`}>
              <div className="flex items-center mb-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                  missingReviews.includes("Financial Aid & Scholarships")
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : sectionReviews.aidScholarships === "flag"
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                    : sectionReviews.aidScholarships === "ok"
                    ? "bg-gradient-to-r from-green-500 to-green-600"
                    : "bg-gradient-to-r from-green-500 to-teal-600"
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800">Financial Aid & Scholarships</h3>
                  <p className="text-blue-600 font-medium text-sm mt-1">✏️ Details can be edited</p>
                  {missingReviews.includes("Financial Aid & Scholarships") && (
                    <p className="text-red-600 font-medium text-sm mt-1">⚠ Please review this section</p>
                  )}
                  {sectionReviews.aidScholarships === "flag" && (
                    <p className="text-yellow-600 font-medium text-sm mt-1">🏁 Flagged for review</p>
                  )}
                  {sectionReviews.aidScholarships === "ok" && (
                    <p className="text-green-600 font-medium text-sm mt-1">✓ Review complete</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Financial Aid */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                    Financial Aid
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.financial_aid?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 text-gray-800 font-medium shadow-sm"
                    />
                  </div>
                  {shouldShowDetails(formData?.financial_aid?.amount) && (
                    <textarea
                      value={formData?.financial_aid?.details || ""}
                      onChange={(e) => handleChange("financial_aid", "details", e.target.value)}
                      placeholder="Details"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-700 resize-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      rows={2}
                    />
                  )}
                </div>

                {/* Merit Aid */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
                    Merit Aid
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.merit_aid?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 text-gray-800 font-medium shadow-sm"
                    />
                  </div>
                  {shouldShowDetails(formData?.merit_aid?.amount) && (
                    <textarea
                      value={formData?.merit_aid?.details || ""}
                      onChange={(e) => handleChange("merit_aid", "details", e.target.value)}
                      placeholder="Details"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-700 resize-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      rows={2}
                    />
                  )}
                </div>

                {/* Other Aid */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <div className="w-3 h-3 bg-purple-400 rounded-full mr-2"></div>
                    Other Aid
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.other_aid?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 text-gray-800 font-medium shadow-sm"
                    />
                  </div>
                  {shouldShowDetails(formData?.other_aid?.amount) && (
                    <textarea
                      value={formData?.other_aid?.details || ""}
                      onChange={(e) => handleChange("other_aid", "details", e.target.value)}
                      placeholder="Details"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-700 resize-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      rows={2}
                    />
                  )}
                </div>

                {/* Federal Money */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <div className="w-3 h-3 bg-indigo-400 rounded-full mr-2"></div>
                    Federal Aid
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.federal_money?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 text-gray-800 font-medium shadow-sm"
                    />
                  </div>
                  {shouldShowDetails(formData?.federal_money?.amount) && (
                    <textarea
                      value={formData?.federal_money?.details || ""}
                      onChange={(e) => handleChange("federal_money", "details", e.target.value)}
                      placeholder="Details"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-700 resize-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      rows={2}
                    />
                  )}
                </div>

                {/* Loans */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <div className="w-3 h-3 bg-orange-400 rounded-full mr-2"></div>
                    Student Loans
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.loans?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-orange-50 to-red-50 text-gray-800 font-medium shadow-sm"
                    />
                  </div>
                  {shouldShowDetails(formData?.loans?.amount) && (
                    <textarea
                      value={formData?.loans?.details || ""}
                      onChange={(e) => handleChange("loans", "details", e.target.value)}
                      placeholder="Details"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-700 resize-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      rows={2}
                    />
                  )}
                </div>

                {/* Workstudy */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
                    Work Study
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                    <input
                      type="text"
                      value={formData?.workstudy?.amount || ""}
                      readOnly
                      placeholder="Amount"
                      className="w-full pl-8 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 text-gray-800 font-medium shadow-sm"
                    />
                  </div>
                  {shouldShowDetails(formData?.workstudy?.amount) && (
                    <textarea
                      value={formData?.workstudy?.details || ""}
                      onChange={(e) => handleChange("workstudy", "details", e.target.value)}
                      placeholder="Details"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-700 resize-none shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                      rows={2}
                    />
                  )}
                </div>
              </div>

              {/* Review Status */}
              <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-green-800 font-semibold text-lg flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Do the financial aid amounts look correct?
                  </span>
                  <div className="flex space-x-6">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        className="form-radio text-green-500 h-5 w-5"
                        name="aidScholarships"
                        value="ok"
                        checked={sectionReviews.aidScholarships === "ok"}
                        onChange={() => handleSectionReviewChange("aidScholarships", "ok")}
                      />
                      <span className="ml-3 text-green-700 font-medium">✓ Looks Good</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        className="form-radio text-red-500 h-5 w-5"
                        name="aidScholarships"
                        value="flag"
                        checked={sectionReviews.aidScholarships === "flag"}
                        onChange={() => handleSectionReviewChange("aidScholarships", "flag")}
                      />
                      <span className="ml-3 text-red-700 font-medium">⚠ Flag for Review</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ================================
                ADDITIONAL DETAILS SECTION
               (Editable directly)
            ================================ */}
            <div className={`bg-white rounded-2xl p-8 shadow-lg mb-8 ${
              missingReviews.includes("Student Information") 
                ? "border-2 border-red-300 bg-red-50" 
                : sectionReviews.additionalDetails === "flag"
                ? "border-2 border-yellow-300 bg-yellow-50"
                : sectionReviews.additionalDetails === "ok"
                ? "border-2 border-green-300 bg-green-50"
                : "border border-gray-100"
            }`}>
              <div className="flex items-center mb-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                  missingReviews.includes("Student Information")
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : sectionReviews.additionalDetails === "flag"
                    ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                    : sectionReviews.additionalDetails === "ok"
                    ? "bg-gradient-to-r from-green-500 to-green-600"
                    : "bg-gradient-to-r from-purple-500 to-pink-600"
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800">Student Information</h3>
                  {missingReviews.includes("Student Information") && (
                    <p className="text-red-600 font-medium text-sm mt-1">⚠ Please review this section</p>
                  )}
                  {sectionReviews.additionalDetails === "flag" && (
                    <p className="text-yellow-600 font-medium text-sm mt-1">🏁 Flagged for review</p>
                  )}
                  {sectionReviews.additionalDetails === "ok" && (
                    <p className="text-green-600 font-medium text-sm mt-1">✓ Review complete</p>
                  )}
                </div>
                <div className="ml-auto">
                  <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">
                    Editable Fields
                  </span>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* First Row: SAI, Test Scores, GPA */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* SAI/EFC */}
                  <div className="space-y-3">
                    <label className="flex items-center text-gray-700 font-semibold">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Student Aid Index (SAI)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-4 text-gray-500 font-medium">$</span>
                      <input
                        type="text"
                        value={formData?.efc_or_sai?.amount || ""}
                        onChange={(e) => handleChange("efc_or_sai", "amount", e.target.value)}
                        placeholder="Expected Family Contribution"
                        className={`w-full pl-8 pr-4 py-4 border-2 rounded-xl font-medium shadow-sm transition-all ${
                          formData?.efc_or_sai?.amount && auth.currentUser ? 
                            "border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100" : 
                            "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        }`}
                      />
                      {formData?.efc_or_sai?.amount && auth.currentUser && (
                        <div className="absolute right-3 top-4">
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {formData?.efc_or_sai?.amount && auth.currentUser && (
                      <p className="text-xs text-green-600 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Auto-filled from your profile
                      </p>
                    )}

                  </div>

                  {/* Test Scores Section */}
                  <div className="space-y-3">
                    <label className="flex items-center text-gray-700 font-semibold">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Test Scores
                    </label>

                    {!testOptional && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {/* ACT Score */}
                          <div className="space-y-1">
                            <div className="relative">
                              <input
                                type="text"
                                value={formData?.composite_act || ""}
                                onChange={(e) => handleChange("composite_act", undefined, e.target.value)}
                                placeholder="36 max"
                                className={`w-full p-2 border-2 rounded-lg font-medium shadow-sm transition-all text-sm ${
                                  formData?.composite_act && auth.currentUser ? 
                                    "border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100" : 
                                    "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                }`}
                              />
                              {formData?.composite_act && auth.currentUser && (
                                <div className="absolute right-2 top-2">
                                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <label className="text-xs text-gray-600 font-medium">ACT</label>
                          </div>

                          {/* SAT Score */}
                          <div className="space-y-1">
                            <div className="relative">
                              <input
                                type="text"
                                value={formData?.composite_sat || ""}
                                onChange={(e) => handleChange("composite_sat", undefined, e.target.value)}
                                placeholder="1600 max"
                                className={`w-full p-2 border-2 rounded-lg font-medium shadow-sm transition-all text-sm ${
                                  formData?.composite_sat && auth.currentUser ? 
                                    "border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100" : 
                                    "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                }`}
                              />
                              {formData?.composite_sat && auth.currentUser && (
                                <div className="absolute right-2 top-2">
                                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <label className="text-xs text-gray-600 font-medium">SAT</label>
                          </div>
                        </div>
                        {(formData?.composite_act || formData?.composite_sat) && auth.currentUser && (
                          <p className="text-xs text-green-600 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Auto-filled from your profile
                          </p>
                        )}
                      </div>
                    )}

                    {/* Test Optional Checkbox */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="test-optional"
                        checked={testOptional}
                        onChange={(e) => setTestOptional(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="test-optional" className="text-sm text-gray-700">
                        Test Optional (I did not submit test scores)
                      </label>
                    </div>
                  </div>

                  {/* GPA */}
                  <div className="space-y-3">
                    <label className="flex items-center text-gray-700 font-semibold">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      Grade Point Average
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData?.gpa || ""}
                        onChange={(e) => handleChange("gpa", undefined, e.target.value)}
                        placeholder="4.0 scale"
                        className={`w-full p-4 border-2 rounded-xl font-medium shadow-sm transition-all ${
                          formData?.gpa && auth.currentUser ? 
                            "border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100" : 
                            "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        }`}
                      />
                      {formData?.gpa && auth.currentUser && (
                        <div className="absolute right-3 top-4">
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {formData?.gpa && auth.currentUser && (
                      <p className="text-xs text-green-600 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Auto-filled from your profile
                      </p>
                    )}
                  </div>
                </div>

                {/* Second Row: State of Residence, Admission Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* State */}
                  <div className="space-y-3">
                    <label className="flex items-center text-gray-700 font-semibold">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      State of Residence
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData?.state_of_residence || ""}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          if (value.length <= 2) {
                            handleChange("state_of_residence", undefined, value);
                          }
                        }}
                        placeholder="e.g. CA, NY, TX"
                        maxLength={2}
                        className={`w-full p-4 border-2 rounded-xl font-medium shadow-sm transition-all ${
                          formData?.state_of_residence && auth.currentUser ? 
                            "border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100" : 
                            "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        }`}
                      />
                      {formData?.state_of_residence && auth.currentUser && (
                        <div className="absolute right-3 top-4">
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {formData?.state_of_residence && auth.currentUser && (
                      <p className="text-xs text-green-600 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Auto-filled from your profile
                      </p>
                    )}
                  </div>

                  {/* Admission Type */}
                  <div className="space-y-3">
                    <label className="flex items-center text-gray-700 font-semibold">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10m6-10v10m-6 0h6" />
                      </svg>
                      Admission Type *
                    </label>
                    <select
                      value={formData?.admission_type || ""}
                      onChange={(e) => handleChange("admission_type", undefined, e.target.value)}
                      required
                      className={`w-full p-4 border-2 rounded-xl bg-white text-gray-800 font-medium shadow-sm focus:ring-2 focus:ring-blue-100 transition-all appearance-none ${
                        !formData?.admission_type ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      <option value="" disabled>
                        Select Admission Type (Required)
                      </option>
                      <option value="Early Decision">Early Decision</option>
                      <option value="Early Action">Early Action</option>
                      <option value="Regular Decision">Regular Decision</option>
                      <option value="Rolling Admission">Rolling Admission</option>
                      <option value="Deferred Admission">Deferred Admission</option>
                    </select>
                    {!formData?.admission_type && (
                      <p className="text-red-600 text-sm">Please select an admission type</p>
                    )}
                  </div>
                </div>

                {/* Third Row: Activities (Full Width) */}
                <div className="space-y-3">
                  <label className="flex items-center text-gray-700 font-semibold">
                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Activities & Extracurriculars (Optional)
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData?.activities || ""}
                      onChange={(e) => handleChange("activities", undefined, e.target.value)}
                      placeholder="List your activities, clubs, sports, volunteer work, etc. (Auto-filled from your profile if available)"
                      rows={4}
                      className={`w-full p-4 border-2 rounded-xl font-medium shadow-sm transition-all resize-none ${
                        formData?.activities && auth.currentUser ? 
                          "border-green-400 bg-green-50 focus:border-green-500 focus:ring-2 focus:ring-green-100" : 
                          "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      }`}
                    />
                    {formData?.activities && auth.currentUser && (
                      <div className="absolute right-3 top-4">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {formData?.activities && auth.currentUser && (
                    <p className="text-xs text-green-600 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Auto-filled from your profile
                    </p>
                  )}
                </div>
              </div>

              {/* Review Status */}
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <span className="text-purple-800 font-semibold text-lg flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Have you filled in all your information?
                  </span>
                  <div className="flex space-x-6">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        className="form-radio text-green-500 h-5 w-5"
                        name="additionalDetails"
                        value="ok"
                        checked={sectionReviews.additionalDetails === "ok"}
                        onChange={() => handleSectionReviewChange("additionalDetails", "ok")}
                        disabled={!isStudentInfoComplete()}
                      />
                      <span className="ml-3 text-green-700 font-medium">✓ Complete</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        className="form-radio text-red-500 h-5 w-5"
                        name="additionalDetails"
                        value="flag"
                        checked={sectionReviews.additionalDetails === "flag"}
                        onChange={() => handleSectionReviewChange("additionalDetails", "flag")}
                      />
                      <span className="ml-3 text-red-700 font-medium">⚠ Needs Review</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Review Summary */}
            <div className={`bg-white rounded-2xl p-8 shadow-lg border mb-8 ${
              missingReviews.length > 0 ? "border-red-300" : "border-gray-100"
            }`}>
              <div className="text-center space-y-4">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${
                  missingReviews.length > 0 
                    ? "bg-gradient-to-r from-red-500 to-red-600" 
                    : "bg-gradient-to-r from-green-500 to-green-600"
                }`}>
                  {missingReviews.length > 0 ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                
                {missingReviews.length > 0 ? (
                  <div>
                    <h3 className="text-xl font-bold text-red-800 mb-2">Review Required</h3>
                    <p className="text-red-600 mb-4">
                      Please review the following sections before submitting:
                    </p>
                    <ul className="list-disc list-inside text-red-700 space-y-1 mb-4">
                      {missingReviews.map((section, index) => (
                        <li key={index} className="text-sm">{section}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-bold text-green-800 mb-2">All Sections Reviewed</h3>
                    <p className="text-green-600 mb-4">
                      Great! You've reviewed all sections. Ready to submit.
                    </p>
                    {/* Show flagged sections if any */}
                    {((sectionReviews.basicInfo === "flag") || 
                      (sectionReviews.aidScholarships === "flag") || 
                      (sectionReviews.additionalDetails === "flag")) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <p className="text-yellow-700 font-medium text-sm">
                          🏁 Note: Some sections are flagged for review and will be saved for your attention.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <div className="text-center space-y-6">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                  missingReviews.length > 0
                    ? "bg-gradient-to-r from-gray-400 to-gray-500"
                    : "bg-gradient-to-r from-blue-500 to-purple-600"
                }`}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Ready to Submit?</h3>
                  <p className="text-gray-600 mb-6">
                    {missingReviews.length > 0 
                      ? "Please complete all section reviews above before submitting."
                      : "Your offer letter data is ready for submission."
                    }
                  </p>
                  {!auth.currentUser && missingReviews.length === 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-blue-700 font-medium text-sm">
                          You'll need to sign in to submit your offer letter. Your data will be saved and submitted automatically after authentication.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={missingReviews.length > 0 || loading}
                  className={`w-full max-w-md mx-auto py-4 px-8 rounded-2xl font-bold text-lg transition-all duration-200 shadow-lg flex items-center justify-center space-x-3 ${
                    missingReviews.length > 0 || loading
                      ? "bg-gray-400 text-gray-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 hover:shadow-xl"
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {missingReviews.length > 0 
                          ? "Complete Reviews to Submit" 
                          : !auth.currentUser 
                            ? "Sign In to Submit" 
                            : "Submit Offer Letter"
                        }
                      </span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success message with modern design */}
        {submitted && (
          <div className="w-full max-w-4xl mt-12 bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl shadow-2xl border border-green-200">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent mb-4">
                  Submission Received
                </h2>
                <p className="text-green-700 text-lg font-medium mb-6">
                  Your offer has been submitted. Our team will review it within 24 hours to confirm.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-white text-green-700 rounded-xl font-semibold border-2 border-green-300 hover:bg-green-50 transition-all"
                  >
                    Upload Another Letter
                  </button>
                  <button
                    onClick={() => window.location.href = '/profile'}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
                  >
                    View My Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
