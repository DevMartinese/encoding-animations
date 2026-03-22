import { Link } from 'react-router-dom'
import MorseHero from './MorseHero'

export default function MorseHeroPage() {
  return (
    <>
      <Link
        to="/"
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 100,
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'Courier New, monospace',
          fontSize: '13px',
          textDecoration: 'none',
          padding: '6px 12px',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
        }}
      >
        ← Back
      </Link>
      <MorseHero />
    </>
  )
}
