import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useModal } from './hooks/useModal';

// Pages — lazy loaded for code splitting
const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const AboutUs = React.lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })));
const BuyAbroad = React.lazy(() => import('./pages/BuyAbroad').then(m => ({ default: m.BuyAbroad })));
const BuyAbroadUk = React.lazy(() => import('./pages/BuyAbroadUk').then(m => ({ default: m.BuyAbroadUk })));
const BuyAbroadUkAgents = React.lazy(() => import('./pages/BuyAbroadUkAgents').then(m => ({ default: m.BuyAbroadUkAgents })));
const BuyAbroadUkListings = React.lazy(() => import('./pages/BuyAbroadUkListings').then(m => ({ default: m.BuyAbroadUkListings })));
const BuyAbroadUkListingDetail = React.lazy(() => import('./pages/BuyAbroadUkListingDetail').then(m => ({ default: m.BuyAbroadUkListingDetail })));
const RelaunchAssessment = React.lazy(() => import('./pages/RelaunchAssessment').then(m => ({ default: m.RelaunchAssessment })));
const EliteProperty = React.lazy(() => import('./pages/EliteProperty').then(m => ({ default: m.EliteProperty })));
const BuyHome = React.lazy(() => import('./pages/BuyHome').then(m => ({ default: m.BuyHome })));
const CompleteHomeBuying = React.lazy(() => import('./pages/CompleteHomeBuying').then(m => ({ default: m.CompleteHomeBuying })));
const Marketing = React.lazy(() => import('./pages/Marketing').then(m => ({ default: m.Marketing })));
const SellFasterAssessment = React.lazy(() => import('./pages/SellFasterAssessment').then(m => ({ default: m.SellFasterAssessment })));
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
const DashboardBuyerNetwork = React.lazy(() => import('./pages/DashboardBuyerNetwork'));
const DashboardInbox = React.lazy(() => import('./pages/DashboardInbox').then(m => ({ default: m.DashboardInbox })));
const DashboardSettings = React.lazy(() => import('./pages/DashboardSettings').then(m => ({ default: m.DashboardSettings })));
const DashboardUsers = React.lazy(() => import('./pages/DashboardUsers').then(m => ({ default: m.DashboardUsers })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
const CheckoutPage = React.lazy(() => import('./pages/Checkout').then(m => ({ default: m.CheckoutPage })));
const StaleListingsLanding = React.lazy(() => import('./pages/StaleListingsLanding').then(m => ({ default: m.StaleListingsLanding })));
const StaleListingsAgents = React.lazy(() => import('./pages/StaleListingsAgents').then(m => ({ default: m.StaleListingsAgents })));
const StaleListingsAccess = React.lazy(() => import('./pages/StaleListingsAccess').then(m => ({ default: m.StaleListingsAccess })));
const StaleListingsReviewAccess = React.lazy(() => import('./pages/StaleListingsReviewAccess').then(m => ({ default: m.StaleListingsReviewAccess })));
const StaleListingsPortal = React.lazy(() => import('./pages/StaleListingsPortal').then(m => ({ default: m.StaleListingsPortal })));
const StaleListingsQuestions = React.lazy(() => import('./pages/StaleListingsQuestions').then(m => ({ default: m.StaleListingsQuestions })));
const StaleListingsPlan = React.lazy(() => import('./pages/StaleListingsPlan').then(m => ({ default: m.StaleListingsPlan })));
const StaleListingsComplete = React.lazy(() => import('./pages/StaleListingsComplete').then(m => ({ default: m.StaleListingsComplete })));
const StaleListingsReport = React.lazy(() => import('./pages/StaleListingsReport').then(m => ({ default: m.StaleListingsReport })));
const DashboardStaleListings = React.lazy(() => import('./pages/DashboardStaleListings').then(m => ({ default: m.DashboardStaleListings })));
const CustomOffers = React.lazy(() => import('./pages/CustomOffers').then(m => ({ default: m.CustomOffers })));
const CustomOffersAccess = React.lazy(() => import('./pages/CustomOffersAccess').then(m => ({ default: m.CustomOffersAccess })));
const CustomOffersPortal = React.lazy(() => import('./pages/CustomOffersPortal').then(m => ({ default: m.CustomOffersPortal })));
const CustomOffersProposal = React.lazy(() => import('./pages/CustomOffersProposal').then(m => ({ default: m.CustomOffersProposal })));
const CustomOffersPlan = React.lazy(() => import('./pages/CustomOffersPlan').then(m => ({ default: m.CustomOffersPlan })));
const CustomOffersComplete = React.lazy(() => import('./pages/CustomOffersComplete').then(m => ({ default: m.CustomOffersComplete })));
const CustomOffersStatus = React.lazy(() => import('./pages/CustomOffersStatus').then(m => ({ default: m.CustomOffersStatus })));
const DashboardCustomOffers = React.lazy(() => import('./pages/DashboardCustomOffers').then(m => ({ default: m.DashboardCustomOffers })));

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
import { ContactSuccessModal } from './components/modals/ContactSuccessModal';
import { OptOutModal } from './components/modals/OptOutModal';

const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-black" />
  </div>
);

const ViewportStabilityManager = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;
    const inputSelector = 'input, textarea, select, [contenteditable="true"]';

    const updateViewportVars = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const active = document.activeElement as HTMLElement | null;
      const isEditing = Boolean(active?.matches(inputSelector));
      const keyboardLikelyOpen = Boolean(
        viewport
        && isEditing
        && viewport.height < window.innerHeight - 120,
      );

      root.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--app-viewport-offset-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--app-viewport-offset-left', `${Math.round(offsetLeft)}px`);
      root.classList.toggle('keyboard-open', keyboardLikelyOpen);
      body.classList.toggle('keyboard-open', keyboardLikelyOpen);
    };

    const deferredUpdate = () => window.setTimeout(updateViewportVars, 40);

    updateViewportVars();
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);
    window.addEventListener('resize', updateViewportVars);
    document.addEventListener('focusin', deferredUpdate);
    document.addEventListener('focusout', deferredUpdate);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      window.removeEventListener('resize', updateViewportVars);
      document.removeEventListener('focusin', deferredUpdate);
      document.removeEventListener('focusout', deferredUpdate);
      root.classList.remove('keyboard-open');
      body.classList.remove('keyboard-open');
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-offset-top');
      root.style.removeProperty('--app-viewport-offset-left');
    };
  }, []);

  return null;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const ModalRenderer = () => {
  const { activeModal, openModal } = useModal();

  useEffect(() => {
    const handler = () => openModal('opt-out');
    window.addEventListener('havlo:open-opt-out', handler);
    return () => window.removeEventListener('havlo:open-opt-out', handler);
  }, [openModal]);

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
    case 'contact-success': return <ContactSuccessModal />;
    case 'opt-out': return <OptOutModal />;
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
  const isStaleListings = pathname.startsWith('/stale-listings');
  const isCustomOffers = pathname.startsWith('/custom-offers');
  const isBuyAbroadUk = pathname.startsWith('/buyabroad/uk');

  if (isDashboard || isAdmin || isStaleListings || isCustomOffers || isBuyAbroadUk) {
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
        <ViewportStabilityManager />
        <ScrollToTop />
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about-us" element={<AboutUs />} />
              <Route path="/about" element={<Navigate to="/about-us" replace />} />
              <Route path="/buy-property-abroad" element={<BuyAbroad />} />
              <Route path="/buyabroad/uk" element={<BuyAbroadUk />} />
              <Route path="/buyabroad/uk/agents" element={<BuyAbroadUkAgents />} />
              <Route path="/buyabroad/uk/listings" element={<BuyAbroadUkListings />} />
              <Route path="/buyabroad/uk/listings/:id" element={<BuyAbroadUkListingDetail />} />
              <Route path="/custom-offers" element={<CustomOffers />} />
              <Route path="/custom-offers/access" element={<CustomOffersAccess />} />
              <Route path="/custom-offers/portal" element={<CustomOffersPortal />} />
              <Route path="/custom-offers/proposal" element={<CustomOffersProposal />} />
              <Route path="/custom-offers/plan" element={<CustomOffersPlan />} />
              <Route path="/custom-offers/complete" element={<CustomOffersComplete />} />
              <Route path="/custom-offers/status/:reference" element={<CustomOffersStatus />} />
              <Route path="/buy-abroad" element={<Navigate to="/buy-property-abroad" replace />} />
              <Route path="/property-audit" element={<RelaunchAssessment />} />
              <Route path="/elite-property" element={<EliteProperty />} />
              <Route path="/buy-home" element={<BuyHome />} />
              <Route path="/complete-home-buying" element={<CompleteHomeBuying />} />
              <Route path="/sell-your-property" element={<Marketing />} />
              <Route path="/sell-your-property/report" element={<SellFasterAssessment />} />
              <Route path="/sell-faster" element={<Navigate to="/sell-your-property" replace />} />
              <Route path="/marketing" element={<Navigate to="/sell-your-property" replace />} />
              <Route path="/contact-us" element={<Contact />} />
              <Route path="/contact" element={<Navigate to="/contact-us" replace />} />
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
              <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="/stale-listings" element={<StaleListingsLanding />} />
              <Route path="/stale-listings/agents" element={<StaleListingsAgents />} />
              <Route path="/stale-listings/access" element={<StaleListingsAccess />} />
              <Route path="/stale-listings/review-access" element={<StaleListingsReviewAccess />} />
              <Route path="/stale-listings/portal" element={<StaleListingsPortal />} />
              <Route path="/stale-listings/questions" element={<StaleListingsQuestions />} />
              <Route path="/stale-listings/plan" element={<StaleListingsPlan />} />
              <Route path="/stale-listings/complete" element={<StaleListingsComplete />} />
              <Route path="/stale-listings/report/:reference" element={<StaleListingsReport />} />
              <Route path="/dashboard/stale-listings" element={<AdminRoute><DashboardStaleListings /></AdminRoute>} />
              <Route path="/stale-listings/review-dashboard" element={<DashboardStaleListings reviewMode />} />
              <Route path="/dashboard/custom-offers" element={<AdminRoute><DashboardCustomOffers /></AdminRoute>} />
            </Routes>
          </Suspense>
        </Layout>
        <ModalRenderer />
      </Router>
    </ModalProvider>
    </AuthProvider>
  );
}
