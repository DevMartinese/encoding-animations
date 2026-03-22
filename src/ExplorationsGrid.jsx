import { useState } from 'react'
import { Link } from 'react-router-dom'
import { explorations } from './explorations'

function ExplorationCard({ exp }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link to={`/${exp.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          border: `1px solid ${hovered ? exp.color + '66' : exp.color + '33'}`,
          borderRadius: '12px',
          overflow: 'hidden',
          background: hovered ? `${exp.color}18` : `${exp.color}08`,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Preview area */}
        <div style={{
          height: '180px',
          background: `${exp.color}0a`,
          borderBottom: `1px solid ${exp.color}22`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {exp.Preview && <exp.Preview color={exp.color} hovered={hovered} />}
        </div>

        {/* Info area */}
        <div style={{ padding: '24px 24px 20px' }}>
          <h2 style={{
            color: exp.color,
            fontFamily: 'Courier New, monospace',
            fontSize: '16px',
            fontWeight: 700,
            marginBottom: '8px',
            letterSpacing: '0.04em',
          }}>
            {exp.title}
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '13px',
            lineHeight: 1.5,
          }}>
            {exp.description}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function ExplorationsGrid() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      padding: '80px 40px',
      boxSizing: 'border-box',
    }}>
      <h1 style={{
        color: '#fff',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 'clamp(32px, 5vw, 56px)',
        fontWeight: 400,
        letterSpacing: '0.08em',
        marginBottom: '16px',
      }}>
        Explorations
      </h1>
      <p style={{
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        marginBottom: '60px',
      }}>
        Visual experiments & creative coding
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '28px',
        maxWidth: '1200px',
      }}>
        {explorations.map((exp) => (
          <ExplorationCard key={exp.id} exp={exp} />
        ))}
      </div>
    </div>
  )
}
