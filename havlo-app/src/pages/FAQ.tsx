import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'
import './FAQ.css'

const faqs = [
  { q: 'What is Havlo?', a: "Havlo is a platform that helps people buy, manage, and sell property abroad. We guide clients through every stage of overseas property ownership — from clarifying goals before purchase to managing or selling property internationally." },
  { q: 'Who is Havlo for?', a: "Havlo works with individuals buying a second home abroad, people seeking international property investment, property owners who require ongoing overseas management, and owners looking to sell property abroad with trusted local support." },
  { q: 'Which countries does Havlo operate in?', a: "Havlo supports property management transactions across multiple international markets, subject to local regulations and market availability. We work with vetted local experts to ensure compliance, accuracy, and reliable solutions." },
  { q: 'How can Havlo help with buying property abroad?', a: "Havlo has tools for: Define your goal for buying investment: lifestyle, vacation, rental income. Understand the local property markets and risks. Identify suitable ownership and investment structures. Make informed, risk-aware decisions." },
  { q: 'Why does Havlo focus on one person for buying?', a: "Property abroad is different from a second home purchase. An investment property requires a different strategy than a second home or recreation purchase. Understanding your purpose means Havlo helps you: Find the right structure. Identify suitable ownership opportunities. Suggest suitable ownership structures. Align with long-term personal or financial goals." },
  { q: 'What ownership options are available?', a: "Depending on the country and property type, Havlo helps clients explore: Full ownership, Shared ownership, Fractional ownership, Co-investment opportunities. Each option is explained clearly, including benefits, risks, and legal implications." },
  { q: 'Can foreigners legally buy property in other countries?', a: "In many countries, yes — although rules vary widely. Some countries allow full foreign ownership, while others impose restrictions or special requirements. Havlo helps you understand: Local ownership laws, Residency or visa considerations, Tax and compliance requirements." },
  { q: 'Does Havlo provide legal or financial advice?', a: "Havlo does not replace licensed legal or financial professionals; however, we help you understand what questions to ask, highlight potential fees, and connect you with trusted local experts when advice is required." },
  { q: 'Can I buy property remotely?', a: "In many cases, yes. Some purchases can be completed partially or fully remotely using powers of attorney and digital processes. Havlo coordinates and explains what is possible in each market." },
  { q: "Does Havlo help manage property after purchase?", a: "Yes. Havlo supports ongoing overseas property management, particularly for owners who live outside the country where the property is located. Depending on location and local partners, services Havlo offer include: Best coordination, Maintenance and minor repairs, Managing local service providers, Preserving long-term property value." },
  { q: "What are Havlo's fees?", a: "Havlo charges service fees depending on the type of support (provided: buying, managing, or selling property). All fees are communicated clearly before you proceed." },
  { q: "Is there an initial consultation or commitment fee?", a: "Yes. To commence advisory services, clients are required to pay an initial commitment fee of $500. This fee covers: An initial consultation, Assessment of the type of property sought and the location, and is disclosed transparently before any transaction proceeds." },
  { q: "Are there hidden costs?", a: "No. Transparency is central to Havlo. Any service fees, third-party costs, or potential expenses are explained upfront." },
  { q: "How do I get started?", a: "We learn about your situation and goals. From there, Havlo guides you through the next steps based on whether you are buying, managing, or selling property abroad." },
  { q: "How does Havlo work with local partners?", a: "Havlo works with serious professionals and service providers to ensure quality, compliance, and reliability in each market." },
  { q: "Is my information secure?", a: "Yes. Havlo treats all client information with strict confidentiality and uses secure systems to protect personal and property data." },
]

export default function FAQ() {
  const navigate = useNavigate()
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="page">
      <Navbar />

      <section className="faq-hero">
        <div className="container">
          <h1>FAQ's</h1>
        </div>
      </section>

      <section className="faq-list-section">
        <div className="container faq-container">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`} onClick={() => setOpen(open === i ? null : i)}>
              <div className="faq-question">
                <span>{faq.q}</span>
                <button className="faq-toggle">{open === i ? '−' : '+'}</button>
              </div>
              {open === i && <div className="faq-answer"><p>{faq.a}</p></div>}
            </div>
          ))}
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="faq-cta">
        <div className="container faq-cta-inner">
          <h2>Still Have Questions?</h2>
          <p>Every property journey is unique. If you have specific questions about buying, managing, or selling property abroad, Havlo is here to help. Start with your goals — we'll guide you from there.</p>
          <button className="btn-primary" onClick={() => navigate('/contact')}>Talk to our Team</button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
