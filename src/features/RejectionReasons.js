import React from "react";

export default function RejectionReasonsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 font-sans">
      
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Why Offers Get Rejected
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Understanding common reasons for offer rejection and how to avoid them
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          
          {/* Quality Issues */}
          <section>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Document Quality Issues</h2>
            </div>
            <ul className="space-y-3 text-gray-700 ml-11">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span>Blurry, unreadable, or low-quality images</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span>Missing pages or incomplete offer letters</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span>Documents that appear to be edited or modified</span>
              </li>
            </ul>
          </section>

          {/* Information Issues */}
          <section>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Incomplete or Inaccurate Information</h2>
            </div>
            <ul className="space-y-3 text-gray-700 ml-11">
              <li className="flex items-start">
                <span className="text-orange-500 mr-2">•</span>
                <span>Missing financial aid amounts or cost information</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-500 mr-2">•</span>
                <span>Inconsistent data between uploaded document and extracted information</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-500 mr-2">•</span>
                <span>Student information doesn't match profile data</span>
              </li>
            </ul>
          </section>

          {/* Privacy Issues */}
          <section>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Privacy & Security Concerns</h2>
            </div>
            <ul className="space-y-3 text-gray-700 ml-11">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Personal identifying information not properly redacted</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Social Security Numbers or sensitive data visible</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>Full addresses or contact information not anonymized</span>
              </li>
            </ul>
          </section>

          {/* Duplicate/Invalid */}
          <section>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Duplicate or Invalid Submissions</h2>
            </div>
            <ul className="space-y-3 text-gray-700 ml-11">
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>Duplicate offer already exists in the system</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>Document is not an actual college offer letter</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                <span>Test documents or clearly fraudulent submissions</span>
              </li>
            </ul>
          </section>

          {/* How to Improve */}
          <section className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-800">How to Ensure Approval</h2>
            </div>
            <ul className="space-y-3 text-green-700 ml-11">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Upload clear, high-resolution images or PDFs</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Include complete offer letter with all financial information</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Review and correct AI-extracted data before submitting</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Remove or blur personal identifying information</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Ensure academic information matches your profile</span>
              </li>
            </ul>
          </section>

          {/* Contact */}
          <section className="text-center pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Still Have Questions?
            </h3>
            <p className="text-gray-600 mb-4">
              If you believe your offer was rejected in error or need help with resubmission
            </p>
            <button 
              onClick={() => window.location.href = '/contact'}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Contact Support
            </button>
          </section>
        </div>
      </div>
    </div>
  );
} 