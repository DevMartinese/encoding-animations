import { useRef, useEffect } from 'react'

const MORSE = {
  E: '.', T: '-', A: '.-', N: '-.', I: '..', M: '--',
  S: '...', O: '---', H: '....', R: '.-.', L: '.-..', D: '-..',
}
const CHARS = Object.keys(MORSE)
const DOT_R = 3
const DASH_W = 10
const DASH_H = 3
const GAP = 3

export default function EncodingPreview({ color, hovered }) {
  const canvasRef = useRef(null)
  const animRef = useRef({ t: 0, phase: 0 })

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
    const anim = animRef.current

    function draw() {
      const speed = hovered ? 0.012 : 0.004
      anim.t += speed
      if (anim.t > 4) anim.t = 0

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const cx = w / 2
      const cy = h / 2
      const phase = anim.t

      if (phase < 1) {
        // Morse table fade in
        const t = phase
        drawMorseTable(ctx, cx, cy, t, color)
      } else if (phase < 2) {
        // Morse → circle
        const t = phase - 1
        drawMorseToCircle(ctx, cx, cy, t, color)
      } else if (phase < 3) {
        // Circle spinning → braille grid
        const t = phase - 2
        drawCircleToBraille(ctx, cx, cy, t, color)
      } else {
        // Braille grid → fade out
        const t = phase - 3
        drawBrailleFadeOut(ctx, cx, cy, t, color)
      }

      ctx.restore()
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [color, hovered])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

function getTablePositions(cx, cy) {
  const cols = 2
  const perCol = Math.ceil(CHARS.length / cols)
  const spacingX = 60
  const spacingY = 12
  return CHARS.map((_, i) => {
    const col = Math.floor(i / perCol)
    const row = i % perCol
    return {
      x: cx + (col - 0.5) * spacingX,
      y: cy + (row - (perCol - 1) / 2) * spacingY,
    }
  })
}

function getCirclePositions(cx, cy) {
  const r = 35
  return CHARS.map((_, i) => {
    const angle = (i / CHARS.length) * Math.PI * 2 - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
}

function getBraillePositions(cx, cy) {
  const cols = 4
  const rows = Math.ceil(CHARS.length / cols)
  const spacingX = 28
  const spacingY = 22
  return CHARS.map((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: cx + (col - (cols - 1) / 2) * spacingX,
      y: cy + (row - (rows - 1) / 2) * spacingY,
    }
  })
}

function drawMorseSymbol(ctx, x, y, code, alpha) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'white'
  let dx = 0
  for (const sym of code) {
    if (sym === '.') {
      ctx.beginPath()
      ctx.arc(x + dx + DOT_R, y, DOT_R, 0, Math.PI * 2)
      ctx.fill()
      dx += DOT_R * 2 + GAP
    } else {
      ctx.fillRect(x + dx, y - DASH_H / 2, DASH_W, DASH_H)
      dx += DASH_W + GAP
    }
  }
}

function drawBrailleDots(ctx, x, y, index, alpha) {
  // Fake braille pattern from char index
  const bits = ((index * 37 + 13) % 63) + 1
  const dx = 4, dy = 4, r = 1.8
  const offsets = [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
  for (let i = 0; i < 6; i++) {
    const on = (bits >> i) & 1
    ctx.globalAlpha = alpha * (on ? 1 : 0.15)
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(x + offsets[i][0] * dx, y + offsets[i][1] * dy, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMorseTable(ctx, cx, cy, t, color) {
  const positions = getTablePositions(cx, cy)
  CHARS.forEach((ch, i) => {
    const delay = i * 0.04
    const alpha = Math.max(0, Math.min(1, (t - delay) * 3))
    if (alpha <= 0) return
    const pos = positions[i]
    drawMorseSymbol(ctx, pos.x - 10, pos.y, MORSE[ch], alpha * 0.7)
  })
}

function drawMorseToCircle(ctx, cx, cy, t, color) {
  const tablePos = getTablePositions(cx, cy)
  const circlePos = getCirclePositions(cx, cy)
  const ease = t * t * (3 - 2 * t) // smoothstep

  CHARS.forEach((ch, i) => {
    const tp = tablePos[i]
    const cp = circlePos[i]
    const x = tp.x + (cp.x - tp.x) * ease
    const y = tp.y + (cp.y - tp.y) * ease
    const morseAlpha = 0.7 * (1 - ease)
    const dotAlpha = ease * 0.8

    if (morseAlpha > 0.01) {
      drawMorseSymbol(ctx, x - 10, y, MORSE[ch], morseAlpha)
    }
    if (dotAlpha > 0.01) {
      ctx.globalAlpha = dotAlpha
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function drawCircleToBraille(ctx, cx, cy, t, color) {
  const circlePos = getCirclePositions(cx, cy)
  const braillePos = getBraillePositions(cx, cy)
  const ease = t * t * (3 - 2 * t)

  CHARS.forEach((ch, i) => {
    const cp = circlePos[i]
    const bp = braillePos[i]
    const x = cp.x + (bp.x - cp.x) * ease
    const y = cp.y + (bp.y - cp.y) * ease

    if (ease < 0.5) {
      ctx.globalAlpha = 0.8
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const brailleT = (ease - 0.5) * 2
      drawBrailleDots(ctx, x, y, i, 0.5 + brailleT * 0.5)
    }
  })
}

function drawBrailleFadeOut(ctx, cx, cy, t, color) {
  const braillePos = getBraillePositions(cx, cy)
  const alpha = Math.max(0, 1 - t)

  CHARS.forEach((ch, i) => {
    const bp = braillePos[i]
    drawBrailleDots(ctx, bp.x, bp.y, i, alpha)
  })
}
