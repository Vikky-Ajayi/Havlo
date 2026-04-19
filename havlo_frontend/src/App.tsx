import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useModal } from './hooks/useModal';

// Pages
import { Home } from './pages/Home';
import { AboutUs } from './pages/AboutUs';
import { BuyAbroad } from './pages/BuyAbroad';
import { RelaunchAssessment } from './pages/RelaunchAssessment';
import { EliteProperty } from './pages/EliteProperty';
import { BuyHome } from './pages/BuyHome';
import { CompleteHomeBuying } from './pages/CompleteHomeBuying';
import { Marketing } from './pages/Marketing';
import { Contact } from './pages/Contact';
import { FAQ } from './pages/FAQ';
import { Countries } from './pages/Countries';
import { PropertyPurchase } from './pages/PropertyPurchase';
import { Onboarding } from './pages/Onboarding';
import { TermsOfUse } from './pages/TermsOfUse';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { CookiePolicy } from './pages/CookiePolicy';
import { Referrals } from './pages/Referrals';
import { PropertyMatching } from './pages/PropertyMatching';
import { BuyerNetwork } from './pages/BuyerNetwork';
import { OnboardingSuccess } from './pages/OnboardingSuccess';
import { DashboardPropertyMatching } from './pages/DashboardPropertyMatching';
import { DashboardEliteProperty } from './pages/DashboardEliteProperty';
import { DashboardSellFaster } from './pages/DashboardSellFaster';
import { DashboardSaleAudit } from './pages/DashboardSaleAudit';
import { DashboardBuyerNetwork } from './pages/DashboardBuyerNetwork';
import { DashboardInbox } from './pages/DashboardInbox';
import { DashboardSettings } from './pages/DashboardSettings';
import { DashboardUsers } from './pages/DashboardUsers';
import { Dashboard } from './pages/Dashboard';
import { AdminPanel } from './pages/AdminPanel';

// Shared Components
import { Navbar } from './components/shared/Navbar';
import { Footer } from './components/shared/Footer';

// Modals
import { LoginModal } from './components/modals/LoginModal';
import { CreateAccountModal } from './components/modals/CreateAccountModal';
import { ForgotPasswordModal } from './components/modals/ForgotPasswordModal';
import { OTPModal } from './components/modals/OTPModal';
import { NewPasswordModal } from './components/modals/NewPasswordModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { BookSessionModal } from './components/modals/BookSessionModal';
import { ConsultationModal } from './components/modals/ConsultationModal';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const ModalRenderer = () => {
  const { activeModal } = useModal();

  switch (activeModal) {
    case 'login': return <LoginModal />;
    case 'create-account': return <CreateAccountModal />;
    case 'forgot-password': return <ForgotPasswordModal />;
    case 'otp': return <OTPModal />;
    case 'new-password': return <NewPasswordModal />;
    case 'settings-profile':
    case 'settings-password': return <SettingsModal />;
    case 'book-session': return <BookSessionModal />;
    case 'consultation': return <ConsultationModal />;
    default: return null;
  }
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, loading } = useAuth();
  const { openModal } = useModal();

  useEffect(() => {
    if (!loading && !token) {
      openModal('login');
    }
  }, [loading, token, openModal]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-black/50">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const isOnboarding = pathname.startsWith('/get-started');
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdmin = pathname.startsWith('/admin');

  if (isDashboard || isAdmin) {
    return <main className="flex-grow">{children}</main>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      {!isOnboarding && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
    <ModalProvider>
      <Router>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/buy-abroad" element={<BuyAbroad />} />
            <Route path="/relaunch-assessment" element={<RelaunchAssessment />} />
            <Route path="/elite-property" element={<EliteProperty />} />
            <Route path="/buy-home" element={<BuyHome />} />
            <Route path="/complete-home-buying" element={<CompleteHomeBuying />} />
            <Route path="/sell-faster" element={<Marketing />} />
            <Route path="/marketing" element={<Navigate to="/sell-faster" replace />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/countries" element={<Countries />} />
            <Route path="/property-purchase" element={<PropertyPurchase />} />
            <Route path="/get-started" element={<Onboarding />} />
            <Route path="/get-started/success" element={<OnboardingSuccess />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/property-matching" element={<PropertyMatching />} />
            <Route path="/buyer-network" element={<BuyerNetwork />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/property-matching" element={<ProtectedRoute><DashboardPropertyMatching /></ProtectedRoute>} />
            <Route path="/dashboard/elite-property" element={<ProtectedRoute><DashboardEliteProperty /></ProtectedRoute>} />
            <Route path="/dashboard/sell-faster" element={<ProtectedRoute><DashboardSellFaster /></ProtectedRoute>} />
            <Route path="/dashboard/sale-audit" element={<ProtectedRoute><DashboardSaleAudit /></ProtectedRoute>} />
            <Route path="/dashboard/buyer-network" element={<ProtectedRoute><DashboardBuyerNetwork /></ProtectedRoute>} />
            <Route path="/dashboard/inbox" element={<ProtectedRoute><DashboardInbox /></ProtectedRoute>} />
            <Route path="/dashboard/users" element={<ProtectedRoute><DashboardUsers /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          </Routes>
        </Layout>
        <ModalRenderer />
      </Router>
    </ModalProvider>
    </AuthProvider>
  );
}
