import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { StaleListingsLogo } from '../components/shared/StaleListingsLogo';

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

/* ─── RADIO BUTTON ─── */
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

/* ─── CHECKBOX ─── */
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
  usePageMeta({
    title: 'Property Assessment Questions | Havlo',
    description: 'Answer a few quick questions about your property and listing history. We\'ll use your answers to build a personalised analysis and action plan for your home.',
    canonical: 'https://www.heyhavlo.com/stale-listings/questions',
  });
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
    <div style={{ minHeight: '100vh', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Answer Questions About Your Property Listing</h1>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .sl-q-option:hover { border-color: #D0A0E0 !important; }

        /* ── NAVBAR ── */
        .sl-q-nav-secure { display: flex; }
        .sl-q-nav-hamburger { display: none; }
        .sl-q-navbar-inner { padding: 0 56px; }

        /* ── STEPPER ── */
        .sl-q-step-label { display: inline; }
        .sl-q-stepper-inner { padding: 20px 56px; }
        .sl-q-step-line { width: 80px; }
        .sl-q-stepper-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .sl-q-stepper-scroll::-webkit-scrollbar { display: none; }

        /* ── CONTENT ── */
        .sl-q-content-inner { padding: 64px 56px 80px; }

        /* ── NAV BUTTONS (desktop) ── */
        .sl-q-nav-desktop { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 40px; }
        .sl-q-nav-mobile { display: none; }

        @media (max-width: 768px) {
          /* Navbar */
          .sl-q-nav-secure { display: none !important; }
          .sl-q-nav-hamburger { display: flex !important; }
          .sl-q-navbar-inner { padding: 0 20px !important; height: 72px !important; }

          /* Stepper */
          .sl-q-step-line { width: 24px !important; margin: 0 8px !important; }
          .sl-q-stepper-inner { padding: 14px 20px !important; }

          /* Content */
          .sl-q-content-inner { padding: 28px 20px 32px !important; }

          /* Desktop nav hidden, mobile nav shown */
          .sl-q-nav-desktop { display: none !important; }
          .sl-q-nav-mobile { display: flex !important; flex-direction: column; gap: 12px; margin-top: 32px; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <header style={{ background: '#FFF', borderBottom: '1px solid #F4F4F4', flexShrink: 0 }}>
        <div className="sl-q-navbar-inner" style={{ maxWidth: '100%', margin: '0 auto', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <button onClick={() => navigate('/stale-listings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <StaleListingsLogo style={{ height: 40, width: 'auto', display: 'block', flexShrink: 0 }} />
          </button>

          {/* Desktop: secure badge */}
          <div className="sl-q-nav-secure" style={{ alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.32px' }}>Secure assessment · SSL encrypted</span>
          </div>

          {/* Mobile: hamburger */}
          <button className="sl-q-nav-hamburger" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6H21M3 12H21M3 18H21" stroke="#1F1F1E" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── STEPPER ── */}
      <div className="sl-q-stepper-scroll" style={{ background: '#fff', borderBottom: '1px solid #F4F4F4', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div className="sl-q-stepper-inner" style={{ margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 'max-content', padding: '0 16px' }}>
          {[
            { num: 1, label: 'Your property' },
            { num: 2, label: 'Choose Plan' },
            { num: 3, label: 'Completed' },
          ].map((step, i) => {
            const isActive = step.num === 1;
            const isInactive = step.num > 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: isActive ? PURPLE : 'transparent',
                    border: isInactive ? '2px solid #D0D0D0' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: isActive ? '#fff' : '#B0B0B0' }}>{step.num}</span>
                  </div>
                  <span className="sl-q-step-label" style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 14, color: isActive ? '#000' : '#B0B0B0', whiteSpace: 'nowrap' }}>{step.label}</span>
                </div>
                {i < 2 && <div className="sl-q-step-line" style={{ height: 1, background: '#E0E0E0', margin: '0 20px', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── QUESTION CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div className="sl-q-content-inner" style={{ width: '100%', maxWidth: 720 }}>

          {/* Counter + title + subtitle */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 16, color: PURPLE, letterSpacing: '-0.32px', lineHeight: '150%', textTransform: 'uppercase', marginBottom: 12 }}>
              QUESTION {currentQ + 1} OF {QUESTIONS.length}
            </div>
            <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 'clamp(22px, 4vw, 28px)', color: '#000', letterSpacing: '-0.5px', lineHeight: '130%', margin: '0 0 10px' }}>
              {question.title}
            </h2>
            {question.subtitle && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#555', lineHeight: '150%', margin: 0 }}>
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
                    minHeight: 64,
                    padding: '16px 20px',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
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

          {/* ── DESKTOP nav (right-aligned, side by side) ── */}
          <div className="sl-q-nav-desktop">
            <button
              onClick={handleBack}
              style={{ display: 'flex', width: 160, height: 52, padding: '16px 24px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#000', cursor: 'pointer', letterSpacing: '-0.32px', flexShrink: 0 }}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              style={{ display: 'flex', width: 160, height: 52, padding: '16px 24px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 8, background: isAnswered ? '#020202' : '#C0C0C0', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#fff', cursor: isAnswered ? 'pointer' : 'not-allowed', letterSpacing: '-0.32px', flexShrink: 0, transition: 'background 0.15s' }}
            >
              {currentQ < QUESTIONS.length - 1 ? 'Next →' : 'Finish →'}
            </button>
          </div>

          {/* ── MOBILE nav (full-width stacked: Continue on top, Back below) ── */}
          <div className="sl-q-nav-mobile">
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              style={{ width: '100%', height: 56, borderRadius: 8, border: 'none', background: isAnswered ? '#020202' : '#C0C0C0', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 16, color: '#fff', cursor: isAnswered ? 'pointer' : 'not-allowed', letterSpacing: '-0.32px', transition: 'background 0.15s' }}
            >
              {currentQ < QUESTIONS.length - 1 ? 'Continue' : 'Finish'}
            </button>
            <button
              onClick={handleBack}
              style={{ width: '100%', height: 56, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#000', cursor: 'pointer', letterSpacing: '-0.32px' }}
            >
              Back
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
