import { useNavigate } from 'react-router-dom'
import './Consultation.css'

export default function Consultation() {
  const navigate = useNavigate()
  return (
    <div className="consultation">
      {/* Welcome Banner */}
      <div className="consult-banner">
        <div>
          <h1>Welcome Freeborn</h1>
          <p>Start your journey</p>
        </div>
      </div>

      {/* Expert Consultation Card */}
      <div className="consult-body">
        <div className="consult-expert-card">
          <div className="consult-expert-left">
            <h2>Expert Consultation</h2>
            <p>Get personalized advice from industry professionals</p>
            <div className="consult-features">
              <div className="consult-feature"><span className="consult-check">✓</span>One-on-one expert guidance</div>
              <div className="consult-feature"><span className="consult-check">✓</span>Tailored solutions for your needs</div>
              <div className="consult-feature"><span className="consult-check">✓</span>60-minute focused session</div>
              <div className="consult-feature"><span className="consult-check">✓</span>Follow-up summary included</div>
            </div>
          </div>
          <div className="consult-expert-right">
            <div className="consult-price">
              <span className="consult-price-amt">$200</span>
              <span className="consult-price-label">Property Advisory Fee</span>
            </div>
            <button className="btn-primary" onClick={() => navigate('/dashboard/book-session')}>Book Session</button>
          </div>
        </div>

        {/* Upcoming Consultations */}
        <h2 className="consult-upcoming-title">Upcoming consultaions</h2>
        <div className="consult-upcoming-card">
          <div className="consult-expert-info">
            <div className="consult-expert-avatar">
              <img src="https://i.pravatar.cc/80?img=47" alt="Dr. Jane Smith" />
            </div>
            <div>
              <p className="consult-expert-name">Dr. Jane Smith</p>
              <p className="consult-expert-role">Real Estate Expert</p>
            </div>
          </div>
          <div className="consult-details">
            <div className="consult-detail-row"><span>Date &amp; Time</span><strong>July 25, 2025 at 2:00 PM</strong></div>
            <div className="consult-detail-row"><span>Duration</span><strong>60 minutes</strong></div>
            <div className="consult-detail-row"><span>Booking ID</span><strong>#CON-2025-0723</strong></div>
          </div>
          <div className="consult-link-box">
            <span>https://meet.example.com/consultation-july-123-723</span>
            <button className="consult-copy-btn">Copy Link</button>
          </div>
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button className="btn-primary" onClick={() => navigate('/dashboard/experts')}>Join meeting</button>
          </div>
        </div>
      </div>
    </div>
  )
}
