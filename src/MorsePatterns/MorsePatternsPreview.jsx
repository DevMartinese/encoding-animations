import { useRef, useEffect } from 'react'

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
}
const CHARS = Object.keys(MORSE)
const N = CHARS.length

export default function MorsePatternsPreview({ color, hovered }) {
  const canvasRef = useRef(null)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr

    let raf

    function draw() {
      tRef.current += hovered ? 0.008 : 0.003
      if (tRef.current > 3) tRef.current = 0
      const t = tRef.current

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.32

      if (t < 1) {
        // Radial burst
        const ease = t * t * (3 - 2 * t)
        CHARS.forEach((ch, i) => {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2 + t * 0.5
          const dist = ease * r
          const x = cx + dist * Math.cos(angle)
          const y = cy + dist * Math.sin(angle)

          ctx.globalAlpha = ease * 0.8
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fill()

          // Morse extending outward
          if (ease > 0.3) {
            const morseAlpha = (ease - 0.3) / 0.7 * 0.6
            drawRadialMorse(ctx, x, y, MORSE[ch], angle + Math.PI / 2, morseAlpha)
          }
        })
      } else if (t < 2) {
        // Spiral
        const phase = t - 1
        CHARS.forEach((ch, i) => {
          const tt = i / (N - 1)
          const angle = tt * 2.5 * Math.PI * 2 - Math.PI / 2 + phase * Math.PI
          const dist = 10 + tt * (r - 10)
          const x = cx + dist * Math.cos(angle)
          const y = cy + dist * Math.sin(angle)

          ctx.globalAlpha = 0.7
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.arc(x, y, 1.8, 0, Math.PI * 2)
          ctx.fill()
        })
        // Faint connecting line
        ctx.beginPath()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 0.5
        ctx.globalAlpha = 0.15
        CHARS.forEach((ch, i) => {
          const tt = i / (N - 1)
          const angle = tt * 2.5 * Math.PI * 2 - Math.PI / 2 + phase * Math.PI
          const dist = 10 + tt * (r - 10)
          const x = cx + dist * Math.cos(angle)
          const y = cy + dist * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      } else {
        // Constellation with connections
        const phase = t - 2
        const fadeOut = phase > 0.7 ? 1 - (phase - 0.7) / 0.3 : 1
        const golden = (1 + Math.sqrt(5)) / 2
        const positions = CHARS.map((_, i) => {
          const tt = i / N
          const angle = i * golden * Math.PI * 2
          const dist = Math.sqrt(tt) * r
          return {
            x: cx + dist * Math.cos(angle) + Math.sin(phase * Math.PI * 2 + i * 0.7) * 3,
            y: cy + dist * Math.sin(angle) + Math.cos(phase * Math.PI * 2 + i * 1.1) * 3,
          }
        })

        // Lines
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 0.5
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < Math.min(i + 3, positions.length); j++) {
            const dx = positions[i].x - positions[j].x
            const dy = positions[i].y - positions[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 80) continue
            ctx.globalAlpha = 0.12 * fadeOut * (1 - dist / 80)
            ctx.beginPath()
            ctx.moveTo(positions[i].x, positions[i].y)
            ctx.lineTo(positions[j].x, positions[j].y)
            ctx.stroke()
          }
        }

        // Dots
        positions.forEach((p) => {
          ctx.globalAlpha = 0.7 * fadeOut
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      ctx.restore()
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [color, hovered])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

function drawRadialMorse(ctx, x, y, code, angle, alpha) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = 'white'
  ctx.globalAlpha = alpha

  let dy = -6
  for (const sym of code) {
    if (sym === '.') {
      ctx.beginPath()
      ctx.arc(0, dy, 1.5, 0, Math.PI * 2)
      ctx.fill()
      dy -= 5
    } else {
      ctx.fillRect(-1.2, dy - 5, 2.4, 5)
      dy -= 8
    }
  }

  ctx.restore()
}
