import './Ticker.css'

const items = [
  'Initial Consultation and Needs Assessment',
  'International Property Search',
  'Legal and Regulatory Guidance',
  'Due Diligence and Documentation',
  'Mortgage and Financing Support',
  'Property Survey and Inspection',
  'Negotiation and Offer Management',
  'Completion and Handover',
]

export default function Ticker() {
  const doubled = [...items, ...items]
  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <span key={i} className="ticker-item">
            <span className="ticker-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
