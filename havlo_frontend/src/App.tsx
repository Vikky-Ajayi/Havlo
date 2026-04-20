import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useModal } from './hooks/useModal';

// Pages — lazy loaded for code splitting
const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const AboutUs = React.lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })));
const BuyAbroad = React.lazy(() => import('./pages/BuyAbroad').then(m => ({ default: m.BuyAbroad })));
const RelaunchAssessment = React.lazy(() => import('./pages/RelaunchAssessment').then(m => ({ default: m.RelaunchAssessment })));
const EliteProperty = React.lazy(() => import('./pages/EliteProperty').then(m => ({ default: m.EliteProperty })));
const BuyHome = React.lazy(() => import('./pages/BuyHome').then(m => ({ default: m.BuyHome })));
const CompleteHomeBuying = React.lazy(() => import('./pages/CompleteHomeBuying').then(m => ({ default: m.CompleteHomeBuying })));
const Marketing = React.lazy(() => import('./pages/Marketing').then(m => ({ default: m.Marketing })));
const Contact = React.lazy(() => import('./pages/Contact').then(m => ({ default: m.Contact })));
const FAQ = React.lazy(() => import('./pages/FAQ').then(m => ({ default: m.FAQ })));
const Countries = React.lazy(() => import('./pages/Countries').then(m => ({ default: m.Countries })));
const PropertyPurchase = React.lazy(() => import('./pages/PropertyPurchase').then(m => ({ default: m.PropertyPurchase })));
const Onboarding = React.lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const TermsOfUse = React.lazy(() => import('./pages/TermsOfUse').then(m => ({ default: m.TermsOfUse })));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const CookiePolicy = React.lazy(() => import('./pages/CookiePolicy').then(m => ({ default: m.CookiePolicy })));
const Referrals = React.lazy(() => import('./pages/Referrals').then(m => ({ default: m.Referrals })));
const PropertyMatching = React.lazy(() => import('./pages/PropertyMatching').then(m => ({ default: m.PropertyMatching })));
const BuyerNetwork = React.lazy(() => import('./pages/BuyerNetwork').then(m => ({ default: m.BuyerNetwork })));
const OnboardingSuccess = React.lazy(() => import('./pages/OnboardingSuccess').then(m => ({ default: m.OnboardingSuccess })));
const DashboardPropertyMatching = React.lazy(() => import('./pages/DashboardPropertyMatching').then(m => ({ default: m.DashboardPropertyMatching })));
const DashboardEliteProperty = React.lazy(() => import('./pages/DashboardEliteProperty').then(m => ({ default: m.DashboardEliteProperty })));
const DashboardSellFaster = React.lazy(() => import('./pages/DashboardSellFaster').then(m => ({ default: m.DashboardSellFaster })));
const DashboardSaleAudit = React.lazy(() => import('./pages/DashboardSaleAudit').then(m => ({ default: m.DashboardSaleAudit })));
const DashboardBuyerNetwork = React.lazy(() => import('./pages/DashboardBuyerNetwork').then(m => ({ default: m.DashboardBuyerNetwork })));
const DashboardInbox = React.lazy(() => import('./pages/DashboardInbox').then(m => ({ default: m.DashboardInbox })));
const DashboardSettings = React.lazy(() => import('./pages/DashboardSettings').then(m => ({ default: m.DashboardSettings })));
const DashboardUsers = React.lazy(() => import('./pages/DashboardUsers').then(m => ({ default: m.DashboardUsers })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

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

const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-black" />
  </div>
);

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

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, user, loading } = useAuth();
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

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
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
          <Suspense fallback={<PageLoader />}>
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
              <Route path="/dashboard/users" element={<AdminRoute><DashboardUsers /></AdminRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </Layout>
        <ModalRenderer />
      </Router>
    </ModalProvider>
    </AuthProvider>
  );
}
