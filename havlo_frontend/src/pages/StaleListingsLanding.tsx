import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4"
      >
        <span className="font-medium text-black text-sm">{q}</span>
        <svg className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

const FAQS = [
  { q: 'How quickly will I receive my report?', a: 'Quick Insight reports are typically ready within 24 hours. Professional Review takes up to 48 hours as it includes human agent review. Premium Strategy includes a consultation call and is delivered within 5 business days.' },
  { q: 'Do I need to switch estate agent?', a: 'No. Our reports are designed to complement your existing arrangement. Share the findings with your current agent or use the insights to have a more informed conversation about your sale strategy.' },
  { q: 'Will this tell me to reduce my price?', a: "Only if the data supports it. Many stale listings have fixable issues that don't require a price reduction — such as poor photography, weak descriptions, or insufficient marketing reach. We tell you what the evidence says." },
  { q: 'What information do I need to provide?', a: 'Just your listing URL or property address, plus answers to 10 quick questions about your situation. The whole process takes under 3 minutes.' },
  { q: 'Is my information kept confidential?', a: 'Yes. Your data is handled securely and never sold to third parties. We use your information only to generate your report and to communicate with you about the assessment service.' },
  { q: 'Can I share my report with my agent?', a: 'Yes, and we encourage it. Your report is designed to be actionable — you can forward it directly to your estate agent with specific recommendations they can act on immediately.' },
];

export function StaleListingsLanding() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'url' | 'address'>('url');
  const [url, setUrl] = useState('');
  const [address, setAddress] = useState('');

  const handleStart = () => {
    const params = new URLSearchParams();
    if (tab === 'url' && url.trim()) params.set('url', url.trim());
    else if (tab === 'address' && address.trim()) params.set('address', address.trim());
    navigate(`/stale-listings/questions${params.toString() ? '?' + params.toString() : ''}`);
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/stale-listings')}>
            <span className="font-bold text-black text-xl tracking-tight">StaleListings</span>
            <span className="text-gray-400 text-sm font-normal">by HAVLO</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-gray-500 hover:text-black transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-gray-500 hover:text-black transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-gray-500 hover:text-black transition-colors">FAQ</a>
            <button onClick={handleStart} className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors">
              Start Assessment
            </button>
          </nav>
          <button onClick={handleStart} className="md:hidden bg-black text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Start
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
          Trusted by 10,000+ UK homeowners
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
          Don't Let Your Home<br className="hidden sm:block" /> Sit on the Market
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          Thousands of UK properties stall each year — not because of market conditions, but because of fixable issues buyers won't tell you about. Get a data-backed assessment in minutes.
        </p>

        <div className="max-w-2xl mx-auto">
          <div className="flex bg-gray-100 rounded-lg p-1 mb-5 w-fit mx-auto">
            {(['url', 'address'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 text-sm font-medium rounded-md transition-all ${tab === t ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>
                {t === 'url' ? 'Listing URL' : 'Property Address'}
              </button>
            ))}
          </div>
          {tab === 'url' ? (
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="Paste your Rightmove, Zoopla or OTM listing URL…"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
              <button onClick={handleStart} className="bg-black text-white font-bold px-7 py-4 rounded-xl hover:bg-gray-900 transition-colors whitespace-nowrap text-sm">
                Assess My Listing →
              </button>
            </div>
          ) : (
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleStart()}
                placeholder="e.g. 14 Ashford Road, Bristol, BS3 4TH"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
              <button onClick={handleStart} className="bg-black text-white font-bold px-7 py-4 rounded-xl hover:bg-gray-900 transition-colors whitespace-nowrap text-sm">
                Assess My Listing →
              </button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">Free to start · Paid reports from £79.99 · No commitment required</p>
        </div>
      </section>

      {/* Trust badges */}
      <div className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '4.8/5', label: '⭐ Trustpilot rating' },
              { value: '10K+', label: 'Sellers helped' },
              { value: '250K+', label: 'Reports delivered' },
              { value: '94%', label: 'Would recommend' },
            ].map((b, i) => (
              <div key={i}>
                <div className="text-2xl font-bold text-black">{b.value}</div>
                <div className="text-sm text-gray-500 mt-1">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why listings stale */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-black">Homes that sit too long lose buyer attention.</h2>
          <p className="text-gray-500 mt-3 text-lg">Yours doesn't have to.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '🔍', title: 'Spot What Buyers Notice', desc: 'Our analysis identifies the exact issues making buyers scroll past your listing — from photos and pricing to description quality and portal visibility.' },
            { icon: '📊', title: 'Expert-Backed Insights', desc: 'Each report draws on current market data and UK property sales expertise to give you a prioritised action plan, not vague generic advice.' },
            { icon: '🤝', title: 'Works With Your Agent', desc: "You don't need to switch agent. Share the report with your existing agent or use it to have a more informed, productive conversation about your sale." },
          ].map((c, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl mb-5">{c.icon}</div>
              <h3 className="font-bold text-lg text-black mb-3">{c.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-black">How it works</h2>
            <p className="text-gray-500 mt-3">Three steps to a clearer picture of your sale</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { n: '1', title: 'Tell us about your home', desc: 'Share your listing URL or property address and answer 10 quick questions. Takes under 3 minutes.' },
              { n: '2', title: 'Get personalised insights', desc: 'Our system generates a scored assessment with specific findings tailored to your property and situation.' },
              { n: '3', title: 'Improve your chances', desc: 'Act on your prioritised action plan. Most homeowners see measurable improvement in enquiry rates within 30 days.' },
            ].map((s, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm">{s.n}</div>
                <div>
                  <h3 className="font-bold text-black mb-2">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="text-3xl font-bold text-black mb-4">Your report includes</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">Everything you need to understand why your property isn't selling — and exactly what to do about it.</p>
            <ul className="space-y-3">
              {['Overall listing score (0–100) with category breakdown', 'Photo and presentation analysis', 'Pricing positioning vs. current market', 'Marketing channel and portal exposure gaps', 'Listing description effectiveness', 'Prioritised action plan with urgency levels', 'International buyer opportunity assessment'].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700 text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-1">Overall Score</div>
                <div className="text-5xl font-bold text-black">54<span className="text-gray-300 text-3xl">/100</span></div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full">Needs Attention</span>
              </div>
            </div>
            {[
              { label: 'Photos', score: 40, color: 'bg-red-400' },
              { label: 'Pricing', score: 65, color: 'bg-orange-400' },
              { label: 'Description', score: 58, color: 'bg-yellow-400' },
              { label: 'Positioning', score: 72, color: 'bg-green-400' },
            ].map((s, i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-600 font-medium">{s.label}</span>
                  <span className="font-bold text-gray-900">{s.score}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`${s.color} h-2.5 rounded-full transition-all`} style={{ width: `${s.score}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="text-xs text-gray-400 font-medium mb-3">KEY FINDINGS</div>
              {['Photos need significant improvement', 'Pricing slightly above comparable sales', 'Limited international buyer exposure'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-black">See why sellers trust our insights</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Sarah T.', loc: 'Bristol', text: 'After 4 months of nothing, the report told me exactly what was wrong. Two weeks after making the changes I had two offers above asking.' },
              { name: 'James M.', loc: 'Manchester', text: 'Worth every penny. The pricing analysis alone saved me from dropping my price by £15k unnecessarily. The market just needed a different approach.' },
              { name: 'Priya K.', loc: 'London', text: "My agent had no idea why it wasn't selling. The report pinpointed three specific issues and gave me a clear action plan. Sold in 3 weeks." },
            ].map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
                <div className="flex gap-0.5 mb-4">{[...Array(5)].map((_, j) => <span key={j} className="text-yellow-400 text-sm">★</span>)}</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{r.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-sm">{r.name[0]}</div>
                  <div>
                    <div className="font-semibold text-sm text-black">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-black">Choose your assessment</h2>
          <p className="text-gray-500 mt-3">One-time report. No subscriptions. No hidden fees.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { id: 'quick_insight', name: 'Quick Insight', price: '£79.99', desc: 'A concise, data-driven assessment highlighting the 3 critical issues holding your sale back.', features: ['Overall listing score', 'Top 3 critical issues', 'Essential action steps', '24hr delivery'], featured: false },
            { id: 'professional_review', name: 'Professional Review', price: '£299.99', desc: 'A thorough analysis reviewed by a property expert with a detailed action plan and pricing strategy.', features: ['Full score breakdown', '6+ key findings', 'Detailed action plan', 'Human agent review', 'Pricing analysis', '48hr delivery'], featured: true },
            { id: 'premium_strategy', name: 'Premium Strategy', price: '£1,499.99', desc: 'Comprehensive strategic analysis with comparable market data and a personalised strategy consultation.', features: ['Everything in Professional', 'Comparable sales analysis', 'International buyer strategy', '1hr strategy consultation', 'Follow-up review call', 'Priority delivery'], featured: false },
          ].map((plan, i) => (
            <div key={i} className={`rounded-2xl p-8 border-2 relative ${plan.featured ? 'border-violet-500 shadow-lg shadow-violet-100/50' : 'border-gray-200'}`}>
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full">BEST VALUE</span>
                </div>
              )}
              <div className="mb-7">
                <h3 className="font-bold text-lg text-black mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold text-black mb-3">{plan.price}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{plan.desc}</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className={`w-4 h-4 flex-shrink-0 ${plan.featured ? 'text-violet-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleStart}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-colors ${plan.featured ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-black text-white hover:bg-gray-900'}`}
              >
                Get {plan.name} →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-black">Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <FAQItem key={i} {...faq} />)}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-black mb-4">Ready to find out what's really holding your sale back?</h2>
        <p className="text-gray-500 mb-10 max-w-xl mx-auto">Get your personalised listing assessment and start making changes that actually move buyers to act.</p>
        <button onClick={handleStart} className="bg-black text-white font-bold px-10 py-5 rounded-xl text-lg hover:bg-gray-900 transition-colors inline-block">
          Start My Free Assessment →
        </button>
        <p className="text-xs text-gray-400 mt-5">Free to start · Paid reports from £79.99 · No commitment required</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-black">StaleListings</span>
            <span className="text-gray-400 text-sm">by HAVLO</span>
          </div>
          <div className="text-sm text-gray-400">© 2026 Havlo Ltd. All rights reserved.</div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="/privacy-policy" className="hover:text-black">Privacy</a>
            <a href="/terms" className="hover:text-black">Terms</a>
            <a href="/contact-us" className="hover:text-black">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
