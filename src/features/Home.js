import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Navbar from "../components/Navbar"; // Adjust path to your Navbar component
import { db, auth } from "../firebase"; // Firebase configuration

const HomePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myColleges, setMyColleges] = useState([]);
  const [userSearches, setUserSearches] = useState(0);
  const [maxSearches, setMaxSearches] = useState(0);
  const [viewedSchools, setViewedSchools] = useState([]);

  // Fetch schools from Firestore
  useEffect(() => {
    const fetchSchools = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "collegeData", "allData");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const allSchools = docSnap.data();
          const schoolArray = Object.entries(allSchools).map(([id, data]) => ({
            id,
            name: data.name,
            offer_count: data.offer_count || 0,
          }));
          setSchools(schoolArray);
        } else {
          console.error("No data found for the schools.");
        }
      } catch (error) {
        console.error("Error fetching schools:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  // Fetch user colleges and searches
  useEffect(() => {
    const fetchUserCollegesAndSearches = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            try {
              const userRef = doc(db, "users", currentUser.uid);
              const userDoc = await getDoc(userRef);

              if (userDoc.exists()) {
                const userData = userDoc.data();
                setMyColleges(
                  (userData.myColleges || []).map((college) => ({
                    schoolId: college.schoolId,
                    name: college.name || "Unknown College",
                  }))
                );
                setUserSearches(userData.searches || 0);
                setMaxSearches(userData.max_searches || 0);

                // Get viewed schools (schools user has paid for and can access for free)
                const viewedOffers = userData.viewedOffers || {};
                const viewedSchoolIds = Object.keys(viewedOffers)
                  .filter(key => key.startsWith('school_') && viewedOffers[key])
                  .map(key => key.replace('school_', ''));
                
                // Get school names for viewed schools
                const viewedSchoolsWithNames = await Promise.all(
                  viewedSchoolIds.map(async (schoolId) => {
                    try {
                      const schoolRef = doc(db, "offerLetters", schoolId);
                      const schoolDoc = await getDoc(schoolRef);
                      const schoolName = schoolDoc.exists() ? schoolDoc.data().school_name : "Unknown School";
                      return { schoolId, name: schoolName };
                    } catch (error) {
                      console.error(`Error fetching school ${schoolId}:`, error);
                      return { schoolId, name: "Unknown School" };
                    }
                  })
                );
                setViewedSchools(viewedSchoolsWithNames);
              } else {
                // First-time user - initialize with empty arrays/defaults
                setMyColleges([]);
                setUserSearches(0);
                setMaxSearches(0);
                setViewedSchools([]);
              }
            } catch (error) {
              console.error("Error fetching user document:", error);
              // Set defaults on error
              setMyColleges([]);
              setUserSearches(0);
              setMaxSearches(0);
              setViewedSchools([]);
            }
          } else {
            // User is not logged in - reset to defaults
            setMyColleges([]);
            setUserSearches(0);
            setMaxSearches(0);
            setViewedSchools([]);
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserCollegesAndSearches();
  }, []);

  const capitalizeFirstLetter = (name) => {
    const exceptions = ["of", "and", "for", "the", "at", "in", "on"];
    return name
      .toLowerCase()
      .split(" ")
      .map((word, index) =>
        index === 0 || !exceptions.includes(word)
          ? word.charAt(0).toUpperCase() + word.slice(1)
          : word
      )
      .join(" ");
  };

  const handleSchoolSelect = (schoolId) => {
    navigate(`/school/${schoolId}`);
  };

  const filteredSchools = searchQuery
    ? schools.filter((school) =>
        school.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 font-sans text-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pt-8 pb-12 text-center">
            <div className="max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full text-xs font-medium text-gray-700 mb-4">
                <svg className="w-3 h-3 mr-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Trusted by thousands of students nationwide
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight">
                Upload, Get{" "}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Paid
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base md:text-lg text-gray-600 mb-4 max-w-2xl mx-auto leading-relaxed">
                Upload your offer letter anonymously, earn money every time it's viewed, 
                and help other students make informed decisions about their college choices.
              </p>

              {/* Primary CTA */}
              <div className="mb-6">
                <button
                  onClick={() => navigate("/offerLetterUpload")}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold text-base flex items-center mx-auto group"
                >
                  <svg className="w-4 h-4 mr-2 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  Upload Offer Letter
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <p className="text-center text-gray-600 mt-2 text-xs">
                  Start earning money from your college documents
                </p>
              </div>

              {/* Search Section */}
              <div className="mb-8">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-xl border border-white/20 max-w-2xl mx-auto">
                  <div className="text-center mb-3">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Find Your School</h3>
                    <p className="text-xs text-gray-600">Search and browse offer letters from students</p>
                  </div>

                  {/* Search Input */}
                  <div className="relative mb-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Type the school name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base bg-white"
                    />
                    
                    {/* Search Results Dropdown */}
                    {searchQuery && (
                      <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-80 overflow-y-auto z-20">
                        {filteredSchools.length > 0 ? (
                          <ul className="divide-y divide-gray-100">
                            {filteredSchools.map((school) => (
                              <li
                                key={school.id}
                                onClick={() => handleSchoolSelect(school.id)}
                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-900 font-medium">{school.name}</span>
                                  <div className="flex items-center space-x-3 text-sm">
                                    <div className="flex items-center text-gray-500">
                                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {school.offer_count} offers
                                    </div>
                                    <div className="flex items-center text-blue-600 font-medium">
                                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      {school.offer_count} credits
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="p-6 text-center text-gray-500">
                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
                            </svg>
                            No schools found matching "{searchQuery}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Your Schools - Schools you can access for free */}
                  {viewedSchools.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-medium text-gray-700 mb-1.5 text-center">Your Schools (Free Access)</h4>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {viewedSchools.map((school) => (
                          <button
                            key={school.schoolId}
                            onClick={() => handleSchoolSelect(school.schoolId)}
                            className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg shadow-sm hover:shadow-md hover:bg-green-200 transition-all duration-150 text-xs font-medium flex items-center"
                            style={{
                              maxWidth: "150px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {capitalizeFirstLetter(school.name)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}



                  {/* Search Counter */}
                  <div className="text-center text-xs">
                    <div className="flex items-center justify-center text-gray-600">
                    
                     
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 mb-1">10K+</div>
                  <div className="text-gray-600 text-sm">Offer Letters</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 mb-1">500+</div>
                  <div className="text-gray-600 text-sm">Universities</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 mb-1">$2k+</div>
                  <div className="text-gray-600 text-sm">Earned by Students</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Features Section */}
      <div className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose Our Platform?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Join thousands of students who are making informed decisions about their college choices
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Earn Money</h3>
              <p className="text-gray-600">Get paid every time someone views your offer letter. Turn your college documents into passive income.</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Stay Anonymous</h3>
              <p className="text-gray-600">Your personal information is completely protected. Share your data without revealing your identity.</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Help Others</h3>
                             <p className="text-gray-600">Help future students make better college decisions by sharing real financial aid data.</p>
             </div>
           </div>

           {/* Terms Link */}
           <div className="text-center mt-12">
             <a href="/terms" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
               Terms & Conditions
             </a>
           </div>
         </div>
       </div>
    </div>
  );
};

export default HomePage;
