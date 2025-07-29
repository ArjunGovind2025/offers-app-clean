import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Back to Home */}
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Terms Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6">
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing and using Offers (the "Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Offers is an AI-powered platform that analyzes college financial aid offer letters to help students understand and compare their financial aid packages. The service includes:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Document upload and analysis</li>
              <li>Financial aid breakdown and categorization</li>
              <li>Comparative analysis tools</li>
              <li>Earnings opportunities for data contribution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts and Registration</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              To use certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and update your account information</li>
              <li>Keep your account credentials secure</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Privacy and Data Protection</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information. By using our Service, you agree to our Privacy Policy.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Document Processing:</strong> When you upload offer letters, we process them using AI technology to extract financial information. Documents are stored securely and may be used to improve our analysis algorithms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. User Content and Uploads</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              By uploading documents to our Service, you:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Grant us a license to process and analyze your documents</li>
              <li>Confirm you have the right to share this information</li>
              <li>Understand that documents may be used for service improvement</li>
              <li>Agree not to upload malicious, fraudulent, or inappropriate content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Earnings and Payments</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Users may earn money by contributing offer letter data. Payment terms:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Earnings are calculated based on data quality and completeness</li>
              <li>Minimum payout thresholds apply</li>
              <li>Payments are processed through Stripe</li>
              <li>Users must complete Stripe onboarding to receive payments</li>
              <li>We reserve the right to modify payment rates and terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Prohibited Uses</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              You may not use the Service to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Upload fake or fraudulent documents</li>
              <li>Attempt to manipulate or game the payment system</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Interfere with the Service's operation</li>
              <li>Share account credentials with others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service and its original content, features, and functionality are owned by Offers and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimers</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              The Service is provided "as is" without warranties of any kind. We do not guarantee:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>100% accuracy of AI analysis results</li>
              <li>Continuous availability of the Service</li>
              <li>Compatibility with all devices or browsers</li>
              <li>Specific earnings amounts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              In no event shall Offers be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the Service. Continued use after changes constitutes acceptance of new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms and Conditions, please contact us at support@offers.com
            </p>
          </section>

          <div className="border-t pt-6 mt-8">
            <p className="text-sm text-gray-500 text-center">
              By using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 