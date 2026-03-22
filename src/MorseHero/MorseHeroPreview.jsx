import { useRef, useEffect } from 'react'

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.',
}
const CHARS = Object.keys(MORSE)
const N = CHARS.length

export default function MorseHeroPreview({ color, hovered }) {
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
      tRef.current += hovered ? 0.006 : 0.002
      const t = tRef.current
      const loopT = t % 3

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.3
      const now = performance.now() * 0.001

      if (loopT < 1.2) {
        // Circle forming and spinning
        const formT = Math.min(1, loopT / 0.8)
        const ease = formT * formT * (3 - 2 * formT)
        const spinAngle = loopT * 0.5

        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(spinAngle)

        CHARS.forEach((ch, i) => {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2
          const dist = ease * r
          const x = dist * Math.cos(angle)
          const y = dist * Math.sin(angle)

          // Label
          ctx.globalAlpha = ease * 0.7
          ctx.fillStyle = 'white'
          ctx.font = 'bold 5px Courier New, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(ch, x, y)

          // Radial morse
          if (ease > 0.4) {
            const morseAlpha = (ease - 0.4) / 0.6 * 0.5
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(angle + Math.PI / 2)
            drawMiniMorse(ctx, MORSE[ch], morseAlpha)
            ctx.restore()
          }
        })

        ctx.restore()
      } else if (loopT < 2.2) {
        // Circle shrinks to corner + table fades in
        const moveT = (loopT - 1.2) / 1.0
        const ease = moveT * moveT * (3 - 2 * moveT)

        // Circle in corner
        const circleX = cx + (w * 0.18 - cx) * ease
        const circleY = cy + (h * 0.22 - cy) * ease
        const circleScale = 1 - ease * 0.65

        ctx.save()
        ctx.translate(circleX, circleY)
        ctx.scale(circleScale, circleScale)
        ctx.rotate(loopT * 0.5)

        CHARS.forEach((ch, i) => {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2
          const x = r * Math.cos(angle)
          const y = r * Math.sin(angle)
          ctx.globalAlpha = 0.6
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.arc(x, y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.restore()

        // Table background
        if (ease > 0.3) {
          const tableAlpha = (ease - 0.3) / 0.7 * 0.15
          drawMiniTable(ctx, cx, cy, w, h, tableAlpha, now)
        }
      } else {
        // Final state: circle spinning + table shimmer
        const fadeOut = loopT > 2.7 ? 1 - (loopT - 2.7) / 0.3 : 1

        // Table
        drawMiniTable(ctx, cx, cy, w, h, 0.15 * fadeOut, now)

        // Circle
        ctx.save()
        ctx.translate(w * 0.18, h * 0.22)
        ctx.scale(0.35, 0.35)
        ctx.rotate(loopT * 0.5)

        CHARS.forEach((ch, i) => {
          const angle = (i / N) * Math.PI * 2 - Math.PI / 2
          const x = r * Math.cos(angle)
          const y = r * Math.sin(angle)
          ctx.globalAlpha = 0.6 * fadeOut
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.arc(x, y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.restore()
      }

      ctx.restore()
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [color, hovered])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

function drawMiniMorse(ctx, code, alpha) {
  ctx.fillStyle = 'white'
  ctx.globalAlpha = alpha
  let dy = -5
  for (const sym of code) {
    if (sym === '.') {
      ctx.beginPath()
      ctx.arc(0, dy, 1, 0, Math.PI * 2)
      ctx.fill()
      dy -= 3.5
    } else {
      ctx.fillRect(-0.8, dy - 3, 1.6, 3)
      dy -= 5
    }
  }
}

function drawMiniTable(ctx, cx, cy, w, h, baseAlpha, now) {
  const cols = 2
  const perCol = 8
  const spacingX = w * 0.25
  const spacingY = h * 0.08

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < perCol; row++) {
      const idx = col * perCol + row
      if (idx >= CHARS.length) break
      const x = cx + (col - 0.5) * spacingX
      const y = cy + (row - (perCol - 1) / 2) * spacingY

      const shimmer = 0.92 + 0.08 * Math.sin(now * 0.5 + idx * 0.3)
      ctx.globalAlpha = baseAlpha * shimmer
      ctx.fillStyle = 'white'

      // Dot/dash pattern
      const code = MORSE[CHARS[idx]]
      if (!code) continue
      let dx = -8
      for (const sym of code) {
        if (sym === '.') {
          ctx.beginPath()
          ctx.arc(x + dx, y, 1, 0, Math.PI * 2)
          ctx.fill()
          dx += 4
        } else {
          ctx.fillRect(x + dx, y - 0.8, 5, 1.6)
          dx += 7
        }
      }
    }
  }
}
