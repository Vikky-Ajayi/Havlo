import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const QUESTIONS = [
  {
    id: 'q1_viewings',
    title: 'How many viewings has the property had since being listed?',
    options: ['0–5 viewings', '6–15 viewings', '16–30 viewings', '30+ viewings', 'No viewings yet'],
    multiSelect: false,
  },
  {
    id: 'q2_feedback',
    title: 'What feedback are buyers giving after viewings?',
    subtitle: 'Select all that apply',
    options: ['Too expensive / overpriced', 'Rooms feel smaller than expected', 'Concerns about condition or work needed', 'Location or access concerns', 'No feedback provided', 'Mostly positive, but no offers yet'],
    multiSelect: true,
  },
  {
    id: 'q3_time_on_market',
    title: 'How long has the property been on the market?',
    options: ['Less than 1 month', '1–3 months', '3–6 months', '6–12 months', 'Over 12 months'],
    multiSelect: false,
  },
  {
    id: 'q4_price_reduction',
    title: 'Has the asking price been reduced since listing?',
    options: ['No, the price is unchanged', 'Yes, reduced once', 'Yes, reduced multiple times', 'The price has been increased'],
    multiSelect: false,
  },
  {
    id: 'q5_marketing',
    title: 'How is the property currently being marketed?',
    options: ['Rightmove only', 'Rightmove and Zoopla', 'Multiple portals including OnTheMarket', 'Through a local estate agent only', 'Portals plus social media'],
    multiSelect: false,
  },
  {
    id: 'q6_listing_features',
    title: 'Which of the following apply to your listing?',
    subtitle: 'Select all that apply',
    options: ['Professional photos were taken', 'A virtual tour is available', 'A floor plan is included', 'The property description is detailed', 'None of the above'],
    multiSelect: true,
  },
  {
    id: 'q7_property_type',
    title: 'What type of property is it?',
    options: ['Detached house', 'Semi-detached house', 'Terraced house', 'Flat / apartment', 'Bungalow', 'Other'],
    multiSelect: false,
  },
  {
    id: 'q8_asking_price',
    title: 'What is the approximate asking price?',
    options: ['Under £200,000', '£200,000 – £350,000', '£350,000 – £500,000', '£500,000 – £750,000', '£750,000 – £1,000,000', 'Over £1,000,000'],
    multiSelect: false,
  },
  {
    id: 'q9_primary_goal',
    title: 'What is your primary goal?',
    options: ['Sell as quickly as possible', 'Achieve the best possible price', 'Find the right buyer (not just any buyer)', 'Relocating and need certainty'],
    multiSelect: false,
  },
  {
    id: 'q10_challenge',
    title: "What is the biggest challenge you're currently facing?",
    options: ['Not enough viewings', 'Getting viewings but no offers', 'Offers are too low', 'Uncertain about what to do next', "My agent isn't communicating enough"],
    multiSelect: false,
  },
];

export function StaleListingsQuestions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const listingUrl = searchParams.get('url') || '';
  const address = searchParams.get('address') || '';
  const question = QUESTIONS[currentQ];
  const current = answers[question.id];
  const isAnswered = question.multiSelect
    ? Array.isArray(current) && current.length > 0
    : !!current;

  const isSelected = (option: string) => {
    const val = answers[question.id];
    return question.multiSelect ? Array.isArray(val) && val.includes(option) : val === option;
  };

  const handleSelect = (option: string) => {
    if (question.multiSelect) {
      const arr = (Array.isArray(current) ? current : []) as string[];
      setAnswers({
        ...answers,
        [question.id]: arr.includes(option) ? arr.filter(o => o !== option) : [...arr, option],
      });
    } else {
      setAnswers({ ...answers, [question.id]: option });
    }
  };

  const handleContinue = () => {
    if (!isAnswered) return;
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(prev => prev + 1);
      return;
    }
    sessionStorage.setItem('sl_answers', JSON.stringify(answers));
    sessionStorage.setItem('sl_listing_url', listingUrl);
    sessionStorage.setItem('sl_address', address);
    navigate('/stale-listings/plan');
  };

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
            {[
              { num: 1, label: 'Your property' },
              { num: 2, label: 'Choose Plan' },
              { num: 3, label: 'Completed' },
            ].map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.num === 1 ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {step.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${step.num === 1 ? 'text-black' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {i < 2 && <div className="w-8 sm:w-16 h-px bg-gray-200 mx-3" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-black transition-all duration-500"
            style={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wide">
            Question {currentQ + 1} of {QUESTIONS.length}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-black mb-2">{question.title}</h2>
          {question.subtitle && <p className="text-sm text-violet-600 font-medium mb-6">{question.subtitle}</p>}
          {!question.subtitle && <div className="mb-6" />}

          <div className="space-y-3">
            {question.options.map((option, i) => {
              const selected = isSelected(option);
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                    selected
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selected ? 'border-violet-500 bg-violet-500' : 'border-gray-300 bg-white'
                  }`}>
                    {selected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-medium leading-snug ${selected ? 'text-violet-700' : 'text-gray-800'}`}>{option}</span>
                </button>
              );
            })}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-3 mt-8">
            {currentQ > 0 && (
              <button
                onClick={() => setCurrentQ(prev => prev - 1)}
                className="px-6 py-3.5 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-700 hover:border-gray-300 transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={!isAnswered}
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-colors ${
                isAnswered
                  ? 'bg-black text-white hover:bg-gray-900 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {currentQ === QUESTIONS.length - 1 ? 'See Pricing →' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
