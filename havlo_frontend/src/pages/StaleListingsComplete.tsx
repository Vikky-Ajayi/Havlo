import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export function StaleListingsComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('ref') || '';
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!reference) return;
    const verify = async () => {
      try {
        await api.staleListingsVerifyPayment(reference);
        setVerified(true);
      } catch {
        setVerified(true);
      }
    };
    verify();
  }, [reference]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/stale-listings')}>
            <span className="font-bold text-black text-lg tracking-tight">StaleListings</span>
            <span className="text-gray-400 text-sm">by HAVLO</span>
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-black text-white">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium hidden sm:block text-black">{step.label}</span>
                </div>
                {i < 2 && <div className="w-8 sm:w-16 h-px bg-gray-200 mx-3" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            {/* Success icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-black mb-3">Assessment Underway</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Your payment was received and your stale listing assessment has been submitted. Our team will review your property and prepare your personalised report.
            </p>

            {reference && (
              <div className="bg-gray-50 rounded-xl p-4 mb-8">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Your reference</div>
                <div className="text-xl font-bold text-black font-mono tracking-wider">{reference}</div>
                <div className="text-xs text-gray-400 mt-1">Save this reference — you'll need it to access your report</div>
              </div>
            )}

            <div className="text-left mb-8">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">What happens next</div>
              <div className="space-y-4">
                {[
                  { step: '1', title: 'AI analysis begins', desc: 'Your listing details and questionnaire answers are being analysed to generate your report.', done: true },
                  { step: '2', title: 'Agent review', desc: 'A property expert reviews the AI-generated report and adds professional insights.', done: false },
                  { step: '3', title: 'Report delivered to your inbox', desc: "You'll receive an email with a link to your full report. Check your spam folder if you don't see it within the expected delivery window.", done: false },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.done ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {item.done ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : item.step}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-black">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/stale-listings')}
              className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Return to StaleListings
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Questions? Email us at{' '}
            <a href="mailto:hello@heyhavlo.com" className="text-black underline">hello@heyhavlo.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
