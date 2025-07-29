import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './features/Home'; // Home page component
import ProfilePage from './features/Profile';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import OfferLetterUploadPage from './features/OfferLetterUpload';
import SchoolPage from './features/SchoolsOffers';
import UpgradePlans from './features/Upgrade';
import TermsPage from './features/Terms';
import SuccessPage from './features/Success';
import CancelPage from './features/Cancel';
import RejectionReasonsPage from './features/RejectionReasons';
import BillingHistory from './features/BillingHistory';
import PayoutHistory from './features/PayoutHistory';

function App() {
  return (
    <Router>
      <Navbar/> 

      {/* Application Routes */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/offerLetterUpload" element={<OfferLetterUploadPage/>} />
        <Route path="/school/:id" element={<SchoolPage />} />
        <Route path="/upgrade" element={<UpgradePlans/>} />
        <Route path="/terms" element={<TermsPage/>} />
        <Route path="/success" element={<SuccessPage/>} />
        <Route path="/cancel" element={<CancelPage/>} />
        <Route path="/rejection-reasons" element={<RejectionReasonsPage/>} />
        <Route path="/billing-history" element={<BillingHistory/>} />
        <Route path="/payout-history" element={<PayoutHistory/>} />
      </Routes>
    </Router>
  );
}

export default App;
