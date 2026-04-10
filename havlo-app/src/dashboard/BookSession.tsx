import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './BookSession.css'

const times = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM']

export default function BookSession() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')

  const handleBook = () => {
    if (selectedDate && selectedTime) navigate('/dashboard/consultation')
  }

  return (
    <div className="book-session">
      <div className="book-header">
        <button className="book-back" onClick={() => navigate('/dashboard/experts')}>← Back</button>
        <h1>Book a Session</h1>
        <p>Schedule a 60-minute consultation with Dr. Jane Smith</p>
      </div>

      <div className="book-body">
        <div className="book-card">
          <div className="book-expert-summary">
            <img src="https://i.pravatar.cc/80?img=47" alt="Dr. Jane Smith" />
            <div>
              <h3>Dr. Jane Smith</h3>
              <p>Real Estate Expert</p>
              <p className="book-price">$200 — 60 min session</p>
            </div>
          </div>

          <div className="book-form">
            <div className="book-form-group">
              <label>Select Date</label>
              <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div className="book-form-group">
              <label>Select Time</label>
              <div className="book-times">
                {times.map(t => (
                  <button key={t} className={`book-time-btn ${selectedTime === t ? 'selected' : ''}`} onClick={() => setSelectedTime(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="book-form-group">
              <label>Additional notes (optional)</label>
              <textarea className="form-textarea" placeholder="Describe your property situation or questions..." />
            </div>
            <button className="btn-primary book-confirm" onClick={handleBook}>
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
