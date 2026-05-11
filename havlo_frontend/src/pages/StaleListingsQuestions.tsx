import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PURPLE = '#8B05D3';

const QUESTIONS = [
  {
    id: 'q1_viewings',
    title: 'How many viewings has the property had since being listed?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['0–5 viewings', '6–15 viewings', '16-20 viewings', '30+ viewings', 'None yet'],
    multiSelect: false,
  },
  {
    id: 'q2_feedback',
    title: 'What feedback are buyers giving after viewings?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['Too expensive / overpriced', 'Rooms feel smaller than expected', 'Condition or works needed', 'Location or surrounding area concerns', 'No feedback received', 'Mostly positive — no clear objections'],
    multiSelect: true,
  },
  {
    id: 'q3_under_offer',
    title: 'Has the property previously gone under offer and fallen through?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['No, not under offer yet', 'Yes, once', 'Yes, more than once'],
    multiSelect: false,
  },
  {
    id: 'q4_price_reduction',
    title: 'Have you reduced the asking price since launch?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['No, price unchanged since launch', 'Yes, reduced once', 'Yes, reduced more than once'],
    multiSelect: false,
  },
  {
    id: 'q5_flexibility',
    title: 'Are you open to adjusting your pricing or marketing strategy?',
    subtitle: 'This helps us understand how flexible you are and tailor recommendations accordingly.',
    options: ['Yes, open to recommendations', 'Price is fixed, but open on marketing', 'Not sure — depends on the advice', 'Prefer to keep things as they are for now'],
    multiSelect: false,
  },
  {
    id: 'q6_marketing',
    title: 'How is the property currently being marketed?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['Rightmove only', 'Rightmove and Zoopla', 'Multiple portals including OnTheMarket', 'Through a local estate agent only', 'Portals plus social media'],
    multiSelect: false,
  },
  {
    id: 'q7_listing_features',
    title: 'Which of the following apply to your listing?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['Professional photos were taken', 'A virtual tour is available', 'A floor plan is included', 'The property description is detailed', 'None of the above'],
    multiSelect: true,
  },
  {
    id: 'q8_property_type',
    title: 'What type of property is it?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['Detached house', 'Semi-detached house', 'Terraced house', 'Flat / apartment', 'Bungalow', 'Other'],
    multiSelect: false,
  },
  {
    id: 'q9_asking_price',
    title: 'What is the approximate asking price?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['Under £200,000', '£200,000 – £350,000', '£350,000 – £500,000', '£500,000 – £750,000', '£750,000 – £1,000,000', 'Over £1,000,000'],
    multiSelect: false,
  },
  {
    id: 'q10_challenge',
    title: "What is the biggest challenge you're currently facing?",
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
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

  const handleBack = () => {
    if (currentQ === 0) {
      navigate('/stale-listings');
    } else {
      setCurrentQ(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .sl-q-back-btn { display: inline-flex; }
        .sl-q-continue-btn { padding: 14px 32px !important; border-radius: 8px !important; }
        .sl-q-nav-desktop { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
        .sl-q-nav-mobile { display: none; margin-top: 24px; }
        @media (max-width: 768px) {
          .sl-q-nav-desktop { display: none !important; }
          .sl-q-nav-mobile { display: flex !important; flex-direction: column; gap: 10px; }
          .sl-stepper-label { display: none !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/stale-listings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 20, color: '#1F1F1E', letterSpacing: '-0.5px', lineHeight: 1 }}>StaleListings</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 10, color: '#aaa', letterSpacing: 0.3 }}>By HAVLO</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888' }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#888' }}>Secure assessment · SSL encrypted</span>
          </div>
        </div>
      </header>

      {/* STEPPER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
            {[
              { num: 1, label: 'Your property' },
              { num: 2, label: 'Choose Plan' },
              { num: 3, label: 'Completed' },
            ].map((step, i) => {
              const isActive = step.num === 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? PURPLE : 'transparent',
                      border: isActive ? `2px solid ${PURPLE}` : '2px solid #D0D0D0',
                      color: isActive ? '#fff' : '#B0B0B0',
                      fontWeight: 700, fontSize: 14, flexShrink: 0,
                    }}>
                      {step.num}
                    </div>
                    <span className="sl-stepper-label" style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 14, color: isActive ? '#1F1F1E' : '#B0B0B0' }}>{step.label}</span>
                  </div>
                  {i < 2 && (
                    <div style={{ width: 64, height: 1, background: '#E0E0E0', margin: '0 16px' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* QUESTION AREA */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px 80px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>

          {/* Question label */}
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, color: PURPLE, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            QUESTION {currentQ + 1} OF {QUESTIONS.length}
          </div>

          {/* Question title */}
          <h2 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(18px, 3vw, 24px)', color: '#1F1F1E', letterSpacing: '-0.5px', lineHeight: 1.3, margin: '0 0 10px' }}>
            {question.title}
          </h2>

          {/* Subtitle */}
          {question.subtitle && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 28, marginTop: 0 }}>{question.subtitle}</p>
          )}

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
                    borderRadius: 10,
                    border: selected ? `2px solid ${PURPLE}` : '1.5px solid #E0E0E0',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Radio / Checkbox circle */}
                  <div style={{
                    width: 22, height: 22, borderRadius: question.multiSelect ? 6 : '50%',
                    border: selected ? `2px solid ${PURPLE}` : '2px solid #C8C8C8',
                    background: selected ? PURPLE : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s ease',
                  }}>
                    {selected && (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: selected ? 600 : 400,
                    fontSize: 15,
                    color: '#1F1F1E',
                    lineHeight: 1.4,
                  }}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop nav: Back (left) + Continue (right) */}
          <div className="sl-q-nav-desktop">
            {currentQ > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '13px 28px',
                  border: '1.5px solid #D0D0D0',
                  borderRadius: 8,
                  background: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#444',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={!isAnswered}
              style={{
                padding: '13px 36px',
                borderRadius: 8,
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                cursor: isAnswered ? 'pointer' : 'not-allowed',
                background: isAnswered ? '#1F1F1E' : '#D0D0D0',
                color: '#fff',
                transition: 'background 0.2s',
              }}
            >
              Continue
            </button>
          </div>

          {/* Mobile nav: full-width Continue, then Back below */}
          <div className="sl-q-nav-mobile">
            <button
              onClick={handleContinue}
              disabled={!isAnswered}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 10,
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 16,
                cursor: isAnswered ? 'pointer' : 'not-allowed',
                background: isAnswered ? '#1F1F1E' : '#D0D0D0',
                color: '#fff',
              }}
            >
              Continue
            </button>
            {currentQ > 0 && (
              <button
                onClick={handleBack}
                style={{
                  width: '100%',
                  padding: '15px',
                  border: '1.5px solid #D0D0D0',
                  borderRadius: 10,
                  background: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 16,
                  color: '#444',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
