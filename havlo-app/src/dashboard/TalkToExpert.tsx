import { useNavigate } from 'react-router-dom'
import './TalkToExpert.css'

const experts = [
  { name: 'Dr. Jane Smith', role: 'Real Estate Expert', rating: 5, reviews: 124, avatar: 'https://i.pravatar.cc/80?img=47', available: true },
  { name: 'Michael Torres', role: 'Property Investment Advisor', rating: 5, reviews: 98, avatar: 'https://i.pravatar.cc/80?img=11', available: true },
  { name: 'Amara Okafor', role: 'International Property Law', rating: 5, reviews: 76, avatar: 'https://i.pravatar.cc/80?img=23', available: false },
  { name: 'Sarah Chen', role: 'Mortgage & Finance Specialist', rating: 5, reviews: 143, avatar: 'https://i.pravatar.cc/80?img=45', available: true },
]

export default function TalkToExpert() {
  const navigate = useNavigate()
  return (
    <div className="experts-page">
      <div className="experts-header">
        <h1>Talk to an Expert</h1>
        <p>Connect with our qualified property advisors for personalised guidance</p>
      </div>
      <div className="experts-grid">
        {experts.map((expert, i) => (
          <div key={i} className="expert-card">
            <div className="expert-card-top">
              <img src={expert.avatar} alt={expert.name} className="expert-avatar" />
              <div className={`expert-availability ${expert.available ? 'available' : 'busy'}`}>
                {expert.available ? '● Available' : '● Busy'}
              </div>
            </div>
            <div className="expert-info">
              <h3>{expert.name}</h3>
              <p className="expert-role">{expert.role}</p>
              <div className="expert-rating">
                {'★'.repeat(expert.rating)}
                <span>({expert.reviews} reviews)</span>
              </div>
            </div>
            <div className="expert-actions">
              <button className="btn-primary expert-btn" onClick={() => navigate('/dashboard/book-session')}>
                Book Session
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
