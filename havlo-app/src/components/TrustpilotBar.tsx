import './TrustpilotBar.css'

const reviews = [
  { text: 'Outstanding support for first time buyer', body: 'As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one.', author: 'Freeborn', time: '50 minutes ago' },
  { text: 'Outstanding support for first time buyer', body: 'As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one.', author: 'Freeborn', time: '50 minutes ago' },
  { text: 'Outstanding support for first time buyer', body: 'As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one.', author: 'Freeborn', time: '50 minutes ago' },
]

export default function TrustpilotBar() {
  return (
    <div className="tp-section">
      <div className="container tp-inner">
        <div className="tp-left">
          <div className="tp-excellent">Excellent</div>
          <div className="tp-stars-row">
            {[1,2,3,4,5].map(i => (
              <span key={i} className="tp-star">★</span>
            ))}
          </div>
          <div className="tp-based">
            Based on <strong>4,359 reviews</strong>
          </div>
          <div className="tp-logo-row">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#00b67a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>Trustpilot</span>
          </div>
        </div>

        <div className="tp-reviews">
          {reviews.map((r, i) => (
            <div key={i} className="tp-card">
              <div className="tp-card-stars">
                {[1,2,3,4,5].map(s => <span key={s} className="tp-card-star">★</span>)}
              </div>
              <p className="tp-card-title">{r.text}</p>
              <p className="tp-card-body">{r.body}</p>
              <p className="tp-card-author"><strong>{r.author}</strong>, {r.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
