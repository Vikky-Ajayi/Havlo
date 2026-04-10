import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

// Public pages
import Home from './pages/Home'
import BuyAbroad from './pages/BuyAbroad'
import SellFaster from './pages/SellFaster'
import About from './pages/About'
import EliteProperty from './pages/EliteProperty'
import MarketingPage from './pages/MarketingPage'
import HomeBuying from './pages/HomeBuying'
import Contact from './pages/Contact'
import FAQ from './pages/FAQ'
import WhoThisIsFor from './pages/WhoThisIsFor'
import BuyerSeller from './pages/BuyerSeller'
import PropertyMatching from './pages/PropertyMatching'
import InternationalBuyerNetwork from './pages/InternationalBuyerNetwork'
import PropertyPurchase from './pages/PropertyPurchase'
import Referral from './pages/Referral'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import CookiePolicy from './pages/CookiePolicy'

// Wizard
import WizardLayout from './wizard/WizardLayout'

// Dashboard
import DashboardLayout from './dashboard/DashboardLayout'
import Consultation from './dashboard/Consultation'
import TalkToExpert from './dashboard/TalkToExpert'
import BookSession from './dashboard/BookSession'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/buy-abroad" element={<BuyAbroad />} />
        <Route path="/sell-faster" element={<SellFaster />} />
        <Route path="/about" element={<About />} />
        <Route path="/elite-property" element={<EliteProperty />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/home-buying" element={<HomeBuying />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/who-this-is-for" element={<WhoThisIsFor />} />
        <Route path="/buyer-seller" element={<BuyerSeller />} />
        <Route path="/property-matching" element={<PropertyMatching />} />
        <Route path="/international-buyer-network" element={<InternationalBuyerNetwork />} />
        <Route path="/property-purchase" element={<PropertyPurchase />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/get-started/*" element={<WizardLayout />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route path="consultation" element={<Consultation />} />
          <Route path="experts" element={<TalkToExpert />} />
          <Route path="book-session" element={<BookSession />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
