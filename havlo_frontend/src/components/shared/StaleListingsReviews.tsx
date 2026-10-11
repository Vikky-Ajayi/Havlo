// Customer reviews shown on /stale-listings (StaleListingsHome.tsx) and the
// analyst-review funnel's Preview & pay page (pages/stale-prospect/ReviewFunnel.tsx),
// so both always show the same quotes. Each quote is split into the lines
// the home page breaks it at on desktop.

export interface StaleListingsReview {
  role: string;
  quote: string[];
  tag: string;
}

export const staleListingsReviews: StaleListingsReview[] = [
  {
    role: 'Independent agent',
    quote: ['“Had a listing sat at 11 weeks. The report', 'told us the price was fine — it was the lead', 'photo. Swapped it, had two viewings that', 'weekend.”'],
    tag: 'North West England',
  },
  {
    role: 'Seller',
    quote: ['“Didn’t expect a person to actually look at', 'our listing rather than just spitting out a', 'score. That’s the part that convinced us to', 'act on it.”'],
    tag: 'South East England',
  },
  {
    role: 'Independent agent',
    quote: ['“I’d been told to just drop the price twice.', 'Havlo’s plan was the first time anyone', 'actually looked at why buyers weren’t', 'booking viewings.”'],
    tag: 'Sold within 5 weeks of review',
  },
];

// The marquee renders the review set this many times and slides by one set
// per loop, so the strip never runs out of cards on wide screens.
export const REVIEW_COPIES = 4;

export const ReviewStars = () => (
  <svg width="138" height="26" viewBox="0 0 138 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Rated 5 out of 5">
    {[0, 28, 56, 84, 112].map((x) => (
      <g key={x} transform={`translate(${x} 0)`}>
        <rect width="26" height="26" fill="#00B67A" />
        <path d="M13 4.7l2 4.05 4.47.65-3.24 3.15.77 4.45L13 14.9l-4 2.1.77-4.45L6.53 9.4 11 8.75 13 4.7z" fill="#fff" />
      </g>
    ))}
  </svg>
);
