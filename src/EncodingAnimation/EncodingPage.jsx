import { useControls } from 'leva'
import { Link } from 'react-router-dom'
import EncodingAnimation from './EncodingAnimation'

export default function EncodingPage() {
  const { mode, scrollDuration, skipMorseIntro, showPhaseLabels } = useControls('Controls', {
    mode: { value: 'auto', options: ['auto', 'scroll', 'parallax'] },
    scrollDuration: { value: 1.2, min: 0.2, max: 5, step: 0.1 },
    skipMorseIntro: true,
    showPhaseLabels: { value: true, label: 'Phase Labels' },
  }, { collapsed: true })

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
      <EncodingAnimation
        key={`${mode}-${skipMorseIntro}`}
        mode={mode}
        scrollDuration={scrollDuration}
        skipMorseIntro={skipMorseIntro}
        showPhaseLabels={showPhaseLabels}
      />
    </>
  )
}
