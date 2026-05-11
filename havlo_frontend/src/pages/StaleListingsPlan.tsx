import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const PLANS = [
  {
    id: 'quick_insight' as const,
    name: 'Quick Insight',
    price: '£79.99',
    amount: 79.99,
    desc: 'A concise, data-driven assessment highlighting the 3 critical issues holding your sale back.',
    features: ['Overall listing score', 'Top 3 critical issues', 'Essential action steps', '24hr delivery'],
    featured: false,
    icon: '📋',
  },
  {
    id: 'professional_review' as const,
    name: 'Professional Review',
    price: '£299.99',
    amount: 299.99,
    desc: 'A thorough professional analysis with detailed findings, action plan, and pricing strategy.',
    features: ['Full score breakdown', '6+ key findings', 'Detailed action plan', 'Human agent review', 'Pricing analysis', '48hr delivery'],
    featured: true,
    icon: '📊',
  },
  {
    id: 'premium_strategy' as const,
    name: 'Premium Strategy',
    price: '£1,499.99',
    amount: 1499.99,
    desc: 'Comprehensive strategic analysis with comparable data and a personalised strategy consultation.',
    features: ['Everything in Professional', 'Comparable sales analysis', 'International buyer strategy', '1hr strategy consultation', 'Follow-up review call', 'Priority delivery'],
    featured: false,
    icon: '🏆',
  },
];

type PlanId = 'quick_insight' | 'professional_review' | 'premium_strategy';

const COUNTRY_CODES = ['+44', '+1', '+971', '+65', '+852', '+61', '+49', '+33'];

export function StaleListingsPlan() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('professional_review');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_country_code: '+44',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.phone) {
      setError('Please fill in all fields.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const answers = JSON.parse(sessionStorage.getItem('sl_answers') || '{}');
    const listingUrl = sessionStorage.getItem('sl_listing_url') || '';
    const address = sessionStorage.getItem('sl_address') || '';

    setLoading(true);
    setError('');

    try {
      const result = await api.staleListingsSubmit({
        ...form,
        package: selectedPlan,
        property_address: address || undefined,
        listing_url: listingUrl || undefined,
        questions_data: answers,
        redirect_url: `${window.location.origin}/stale-listings/complete`,
      });

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        navigate(`/stale-listings/complete?ref=${result.reference}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const plan = PLANS.find(p => p.id === selectedPlan)!;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/stale-listings')}>
            <span className="font-bold text-black text-lg tracking-tight">StaleListings</span>
            <span className="text-gray-400 text-sm">by HAVLO</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-gray-400 text-xs font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure assessment · SSL encrypted
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center">
            {[{ num: 1, label: 'Your property' }, { num: 2, label: 'Choose Plan' }, { num: 3, label: 'Completed' }].map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.num <= 2 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {step.num === 1 ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${step.num <= 2 ? 'text-black' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {i < 2 && <div className="w-8 sm:w-16 h-px bg-gray-200 mx-3" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Choose your assessment plan</h1>
            <p className="text-gray-500 mt-2 text-sm">One-time payment. No subscriptions.</p>
          </div>

          {/* Plan cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {PLANS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={`text-left rounded-2xl p-6 border-2 transition-all relative ${
                  selectedPlan === p.id
                    ? p.featured ? 'border-violet-500 bg-violet-50/30 shadow-lg shadow-violet-100/50' : 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>
                  </div>
                )}
                <div className="text-3xl mb-3">{p.icon}</div>
                <div className="font-bold text-black text-base mb-1">{p.name}</div>
                <div className="text-2xl font-bold text-black mb-3">{p.price}</div>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">{p.desc}</p>
                <ul className="space-y-1.5">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-xs text-gray-700">
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 ${selectedPlan === p.id && p.featured ? 'text-violet-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {selectedPlan === p.id && (
                  <div className={`mt-4 text-xs font-bold ${p.featured ? 'text-violet-600' : 'text-black'}`}>✓ Selected</div>
                )}
              </button>
            ))}
          </div>

          {/* Contact form */}
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h2 className="font-bold text-black text-lg mb-1">Your details</h2>
            <p className="text-sm text-gray-500 mb-6">We'll send your report to this email address.</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">First name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={e => setForm({ ...form, first_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Last name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="jane.smith@email.com"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone number</label>
              <div className="flex gap-2">
                <select
                  value={form.phone_country_code}
                  onChange={e => setForm({ ...form, phone_country_code: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                >
                  {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="07700 000000"
                />
              </div>
            </div>

            {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="bg-gray-50 rounded-xl p-4 mb-5 flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold text-black">{plan.name}</div>
                <div className="text-xs text-gray-500">One-time payment</div>
              </div>
              <div className="text-xl font-bold text-black">{plan.price}</div>
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-900'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Pay Securely — {plan.price}
                </>
              )}
            </button>
            <p className="text-xs text-center text-gray-400 mt-3">🔒 Secured by SumUp · SSL encrypted · No card data stored</p>
          </div>
        </div>
      </div>
    </div>
  );
}
