import { useEffect, useMemo, useState } from 'react'
import './GridBackground.css'

const SPACING = 80

function useGrid() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return useMemo(() => {
    const { w, h } = size
    const cols = Math.ceil(w / SPACING) + 1
    const rows = Math.ceil(h / SPACING) + 1
    const offsetX = (w - (cols - 1) * SPACING) / 2
    const offsetY = (h - (rows - 1) * SPACING) / 2

    const dots = []
    const hLines = []
    const vLines = []

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * SPACING
        const y = offsetY + r * SPACING
        const delay = Math.random() * 1.8

        dots.push({ x, y, delay, key: `d-${c}-${r}` })

        if (c < cols - 1) {
          hLines.push({ x, y, key: `h-${c}-${r}`, delay: Math.random() * 1.2 })
        }
        if (r < rows - 1) {
          vLines.push({ x, y, key: `v-${c}-${r}`, delay: Math.random() * 1.2 })
        }
      }
    }

    return { dots, hLines, vLines }
  }, [size])
}

export default function GridBackground() {
  const { dots, hLines, vLines } = useGrid()

  return (
    <div className="grid-bg">
      {hLines.map(l => (
        <div
          key={l.key}
          className="grid-line grid-line--h"
          style={{
            left: l.x,
            top: l.y,
            width: SPACING,
            animationDelay: `${3.5 + l.delay}s`,
          }}
        />
      ))}
      {vLines.map(l => (
        <div
          key={l.key}
          className="grid-line grid-line--v"
          style={{
            left: l.x,
            top: l.y,
            height: SPACING,
            animationDelay: `${3.5 + l.delay}s`,
          }}
        />
      ))}
      {dots.map(d => (
        <div
          key={d.key}
          className="grid-dot"
          style={{
            left: d.x,
            top: d.y,
            animationDelay: `${d.delay}s, ${3}s, ${5.5}s`,
          }}
        />
      ))}
    </div>
  )
}
