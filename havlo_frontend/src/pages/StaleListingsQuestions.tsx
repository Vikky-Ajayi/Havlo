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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    sessionStorage.setItem('sl_answers', JSON.stringify(answers));
    sessionStorage.setItem('sl_listing_url', listingUrl);
    sessionStorage.setItem('sl_address', address);
    navigate('/stale-listings/plan');
  };

  const progress = ((currentQ + 1) / QUESTIONS.length) * 100;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8F9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/stale-listings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 18, color: '#1F1F1E', letterSpacing: '-0.4px', lineHeight: 1 }}>StaleListings</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 10, color: '#aaa', letterSpacing: 0.2 }}>by HAVLO</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Secure assessment · SSL encrypted</span>
          </div>
        </div>
      </header>

      {/* STEPPER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
            {[
              { num: 1, label: 'Your property' },
              { num: 2, label: 'Choose Plan' },
              { num: 3, label: 'Completed' },
            ].map((step, i) => {
              const isActive = step.num === 1;
              const isDone = step.num < 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? '#1F1F1E' : isDone ? '#1F1F1E' : '#F0F0F0',
                      color: isActive || isDone ? '#fff' : '#aaa',
                      fontWeight: 700, fontSize: 13, flexShrink: 0,
                    }}>
                      {isDone ? (
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      ) : step.num}
                    </div>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 14, color: isActive ? '#1F1F1E' : '#aaa' }}>{step.label}</span>
                  </div>
                  {i < 2 && (
                    <div style={{ width: 80, height: 1, background: '#E8E8E8', margin: '0 16px' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 3, background: '#F0F0F0' }}>
          <div style={{ height: 3, background: '#1F1F1E', width: `${progress}%`, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* QUESTION */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px 80px' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>

          {/* Question counter */}
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, color: '#aaa', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20 }}>
            Question {currentQ + 1} of {QUESTIONS.length}
          </div>

          {/* Question title */}
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 'clamp(18px, 3vw, 26px)', color: '#1F1F1E', letterSpacing: '-0.5px', lineHeight: 1.3, margin: '0 0 8px' }}>
            {question.title}
          </h2>

          {question.subtitle && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#A409D2', fontWeight: 500, marginBottom: 24, marginTop: 0 }}>{question.subtitle}</p>
          )}
          {!question.subtitle && <div style={{ height: 24 }} />}

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {question.options.map((option, i) => {
              const selected = isSelected(option);
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(option)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '16px 20px',
                    borderRadius: 12,
                    border: selected ? '2px solid #1F1F1E' : '1.5px solid #E8E8E8',
                    background: selected ? '#1F1F1E' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: question.multiSelect ? 4 : '50%',
                    border: selected ? '2px solid #fff' : '2px solid #D0D0D0',
                    background: selected ? '#fff' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s ease',
                  }}>
                    {selected && (
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#1F1F1E" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: selected ? 600 : 400,
                    fontSize: 15,
                    color: selected ? '#fff' : '#1F1F1E',
                    lineHeight: 1.4,
                    transition: 'color 0.15s ease',
                  }}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {currentQ > 0 && (
              <button
                onClick={() => { setCurrentQ(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={{
                  padding: '14px 24px',
                  border: '1.5px solid #E0E0E0',
                  borderRadius: 48,
                  background: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#444',
                  cursor: 'pointer',
                  letterSpacing: '-0.1px',
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={!isAnswered}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: 48,
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                cursor: isAnswered ? 'pointer' : 'not-allowed',
                background: isAnswered ? '#1F1F1E' : '#EBEBEB',
                color: isAnswered ? '#fff' : '#aaa',
                transition: 'background 0.2s, color 0.2s',
                letterSpacing: '-0.2px',
              }}
            >
              {currentQ === QUESTIONS.length - 1 ? 'See Pricing →' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
