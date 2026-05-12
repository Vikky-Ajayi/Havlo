import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PURPLE = '#A409D2';

/* ─── QUESTIONS DATA ─── */
const QUESTIONS = [
  {
    id: 'q1_viewings',
    title: 'How many viewings has the property had since being listed?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ['0–5 viewings', '6–15 viewings', '16–20 viewings', '30+ viewings', 'None yet'],
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
    id: 'q8_photos',
    title: 'Are you happy with the quality of the listing photos?',
    subtitle: 'Your answers help us identify potential friction points, buyer concerns, and opportunities to improve saleability.',
    options: ["Yes, I'm happy with the photos", "They're okay, but could be better", "No, I don't think they represent it well", "I'm not sure"],
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

/* ─── NAV LOGO ─── */
const StaleListingsLogo = () => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 215, height: 52 }}>
    <svg width="215" height="33" viewBox="0 0 215 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="26" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight="800" fontSize="26" fill="#313131" letterSpacing="-0.5">StaleListings</text>
    </svg>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: '#000', fontWeight: 400, letterSpacing: '-0.32px' }}>By</span>
      <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 13, color: '#313131', letterSpacing: '-0.3px' }}>HAVLO</span>
    </div>
  </div>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─── RADIO BUTTON (exact Figma SVG) ─── */
function RadioCircle({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9.5" stroke={PURPLE} />
        <circle cx="12" cy="12" r="6" fill={PURPLE} />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.25" stroke="#B5B5B5" strokeWidth="1.5" />
    </svg>
  );
}

/* ─── CHECKBOX (for multi-select) ─── */
function CheckboxCircle({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <div style={{ width: 24, height: 24, borderRadius: 6, background: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid #B5B5B5', flexShrink: 0 }} />
  );
}

/* ─── MAIN COMPONENT ─── */
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

  const handleNext = () => {
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
    <div style={{ minHeight: '100vh', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        .sl-q-option:hover { border-color: #D0A0E0 !important; }
        @media (max-width: 640px) {
          .sl-q-navbar { padding: 12px 20px !important; }
          .sl-q-stepper { padding: 16px 20px !important; }
          .sl-q-content { padding: 32px 20px 60px !important; }
          .sl-q-nav-row { flex-direction: column-reverse !important; gap: 12px !important; }
          .sl-q-nav-row button { width: 100% !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <header className="sl-q-navbar" style={{ display: 'flex', height: 80, padding: '12px 56px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F4F4F4', background: '#FFF', backdropFilter: 'blur(5px)', boxSizing: 'border-box', flexShrink: 0 }}>
        <button onClick={() => navigate('/stale-listings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <StaleListingsLogo />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LockIcon />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.32px' }}>Secure assessment · SSL encrypted</span>
        </div>
      </header>

      {/* STEPPER */}
      <div className="sl-q-stepper" style={{ background: '#fff', borderBottom: '1px solid #F4F4F4', padding: '20px 56px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { num: 1, label: 'Your property' },
            { num: 2, label: 'Choose Plan' },
            { num: 3, label: 'Completed' },
          ].map((step, i) => {
            const isActive = step.num === 1;
            const isInactive = step.num > 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isActive ? PURPLE : 'transparent',
                    border: isInactive ? '2px solid #D0D0D0' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: isActive ? '#fff' : '#B0B0B0' }}>{step.num}</span>
                  </div>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 14, color: isActive ? '#000' : '#B0B0B0' }}>{step.label}</span>
                </div>
                {i < 2 && <div style={{ width: 80, height: 1, background: '#E0E0E0', margin: '0 20px' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* QUESTION CONTENT */}
      <div className="sl-q-content" style={{ flex: 1, padding: '64px 56px 80px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 720 }}>

          {/* Question counter + title */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#666', letterSpacing: '-0.28px', marginBottom: 16 }}>
              Question {currentQ + 1} of {QUESTIONS.length}
            </div>
            <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 28, color: '#000', letterSpacing: '-0.5px', lineHeight: '130%', margin: '0 0 12px' }}>
              {question.title}
            </h2>
            {question.subtitle && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#666', lineHeight: '150%', margin: 0 }}>
                {question.subtitle}
              </p>
            )}
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {question.options.map((option, i) => {
              const selected = isSelected(option);
              return (
                <button
                  key={i}
                  className="sl-q-option"
                  onClick={() => handleSelect(option)}
                  style={{
                    display: 'flex',
                    height: 72,
                    padding: '16px 24px',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'stretch',
                    borderRadius: 8,
                    border: selected ? `1.5px solid ${PURPLE}` : '1.5px solid #E8E8E8',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {question.multiSelect
                    ? <CheckboxCircle selected={selected} />
                    : <RadioCircle selected={selected} />
                  }
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#000', letterSpacing: '-0.32px', lineHeight: '150%' }}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="sl-q-nav-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 40 }}>
            <button
              onClick={handleBack}
              style={{ display: 'flex', width: 160, height: 52, padding: '16px 24px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#000', cursor: 'pointer', letterSpacing: '-0.32px', boxSizing: 'border-box' }}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              style={{ display: 'flex', width: 160, height: 52, padding: '16px 24px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 8, background: isAnswered ? '#020202' : '#C0C0C0', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#fff', cursor: isAnswered ? 'pointer' : 'not-allowed', letterSpacing: '-0.32px', boxSizing: 'border-box', transition: 'background 0.15s' }}
            >
              {currentQ < QUESTIONS.length - 1 ? 'Next →' : 'Finish →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
