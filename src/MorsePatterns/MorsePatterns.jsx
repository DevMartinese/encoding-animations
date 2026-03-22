import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const MORSE_MAP = {
  A: '.-',    B: '-...',  C: '-.-.',  D: '-..',   E: '.',
  F: '..-.',  G: '--.',   H: '....',  I: '..',    J: '.---',
  K: '-.-',   L: '.-..',  M: '--',    N: '-.',    O: '---',
  P: '.--.',  Q: '--.-',  R: '.-.',   S: '...',   T: '-',
  U: '..-',   V: '...-',  W: '.--',   X: '-..-',  Y: '-.--',
  Z: '--..',
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
}

const CHARS = Object.keys(MORSE_MAP)
const N = CHARS.length

// ─── Responsive sizing ──────────────────────────────────────

function computeSizes(minDim) {
  const unit = minDim / 100
  return {
    dotR:     unit * 0.8,
    dashW:    unit * 3.2,
    dashH:    unit * 0.9,
    symGap:   unit * 1.0,
    labelSize: unit * 2.4,
    labelGap:  unit * 1.5,
  }
}

// ─── Drawing helpers ─────────────────────────────────────────

function drawMorseRadial(ctx, x, y, code, angle, alpha, sizes) {
  const { dotR, dashW, dashH, symGap, labelSize, labelGap } = sizes
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  ctx.fillStyle = 'white'
  ctx.globalAlpha = alpha
  let dy = -(labelSize / 2 + labelGap)
  for (const sym of code) {
    if (sym === '.') {
      ctx.beginPath()
      ctx.arc(0, dy - dotR, dotR, 0, Math.PI * 2)
      ctx.fill()
      dy -= dotR * 2 + symGap
    } else {
      ctx.fillRect(-dashH / 2, dy - dashW, dashH, dashW)
      dy -= dashW + symGap
    }
  }

  ctx.restore()
}

function drawMorseHorizontal(ctx, x, y, code, alpha, sizes) {
  const { dotR, dashW, dashH, symGap } = sizes
  ctx.fillStyle = 'white'
  ctx.globalAlpha = alpha
  let dx = 0
  for (const sym of code) {
    if (sym === '.') {
      ctx.beginPath()
      ctx.arc(x + dx + dotR, y, dotR, 0, Math.PI * 2)
      ctx.fill()
      dx += dotR * 2 + symGap
    } else {
      ctx.fillRect(x + dx, y - dashH / 2, dashW, dashH)
      dx += dashW + symGap
    }
  }
}

function morseWidthPx(code, sizes) {
  const { dotR, dashW, symGap } = sizes
  let w = 0
  for (const sym of code) {
    w += sym === '.' ? dotR * 2 : dashW
    w += symGap
  }
  return w - symGap
}

function drawLabel(ctx, x, y, char, alpha, sizes) {
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'white'
  ctx.font = `bold ${sizes.labelSize}px Courier New, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, x, y)
}

// ─── Pattern layouts (all responsive) ────────────────────────

function getRadialPositions(cx, cy, radius) {
  return CHARS.map((_, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle: angle + Math.PI / 2 }
  })
}

function getSpiralPositions(cx, cy, maxRadius) {
  const turns = 2.5
  const innerR = maxRadius * 0.1
  return CHARS.map((_, i) => {
    const t = i / (N - 1)
    const angle = t * turns * Math.PI * 2 - Math.PI / 2
    const r = innerR + t * (maxRadius - innerR)
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle: angle + Math.PI / 2 }
  })
}

function getWavePositions(cx, cy, w, h) {
  const usableW = Math.min(w * 0.85, 1200)
  const spacing = usableW / N
  const startX = cx - (N - 1) * spacing / 2
  const amp = h * 0.12
  return CHARS.map((_, i) => ({
    x: startX + i * spacing,
    y: cy + Math.sin(i * 0.5) * amp,
    angle: 0,
  }))
}

function getGridPositions(cx, cy, minDim) {
  const cols = 9
  const rows = Math.ceil(N / cols)
  const spacingX = minDim * 0.09
  const spacingY = minDim * 0.11
  return CHARS.map((_, i) => ({
    x: cx + (i % cols - (cols - 1) / 2) * spacingX,
    y: cy + (Math.floor(i / cols) - (rows - 1) / 2) * spacingY,
    angle: 0,
  }))
}

function getConstellationPositions(cx, cy, radius) {
  const golden = (1 + Math.sqrt(5)) / 2
  return CHARS.map((_, i) => {
    const t = i / N
    const angle = i * golden * Math.PI * 2
    const r = Math.sqrt(t) * radius
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle: 0 }
  })
}

const PATTERN_NAMES = ['RADIAL BURST', 'SPIRAL', 'WAVE', 'GRID', 'CONSTELLATION']

// ─── Component ───────────────────────────────────────────────

export default function MorsePatterns() {
  const canvasRef = useRef(null)
  const triggerRef = useRef(null)
  const stateRef = useRef([])
  const rafRef = useRef(null)
  const sizesRef = useRef(computeSizes(800))
  const spinRef = useRef({ angle: 0 })
  const patternRef = useRef({
    labels: PATTERN_NAMES.map(t => ({ text: t, opacity: 0 })),
    connections: { opacity: 0 },
  })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const screenCX = canvas.width / dpr / 2
    const screenCY = canvas.height / dpr / 2
    const sizes = sizesRef.current
    const spin = spinRef.current
    const pat = patternRef.current

    // Constellation connections
    if (pat.connections.opacity > 0) {
      const states = stateRef.current
      const maxDist = Math.min(canvas.width / dpr, canvas.height / dpr) * 0.2
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 0.6
      for (let i = 0; i < states.length; i++) {
        const a = states[i]
        if (a.opacity <= 0) continue
        for (let j = i + 1; j < Math.min(i + 4, states.length); j++) {
          const b = states[j]
          if (b.opacity <= 0) continue
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > maxDist) continue
          ctx.globalAlpha = pat.connections.opacity * 0.2 * Math.min(a.opacity, b.opacity) * (1 - dist / maxDist)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }

    // Characters
    for (const s of stateRef.current) {
      if (s.opacity <= 0) continue
      const code = MORSE_MAP[s.char]

      if (s.radial) {
        const finalAngle = s.angle + spin.angle
        const cosA = Math.cos(finalAngle - Math.PI / 2)
        const sinA = Math.sin(finalAngle - Math.PI / 2)
        const rx = screenCX + (s.x - screenCX) * cosA - (s.y - screenCY) * sinA
        const ry = screenCY + (s.x - screenCX) * sinA + (s.y - screenCY) * cosA

        drawLabel(ctx, rx, ry, s.char, s.opacity * s.labelAlpha, sizes)
        if (s.morseAlpha > 0) {
          drawMorseRadial(ctx, rx, ry, code, finalAngle, s.opacity * s.morseAlpha, sizes)
        }
      } else {
        drawLabel(ctx, s.x, s.y, s.char, s.opacity * s.labelAlpha, sizes)
        if (s.morseAlpha > 0) {
          const mw = morseWidthPx(code, sizes)
          drawMorseHorizontal(ctx, s.x - mw / 2, s.y + sizes.labelSize * 0.8, code, s.opacity * s.morseAlpha, sizes)
        }
      }
    }

    // Pattern label
    const screenW = canvas.width / dpr
    const screenH = canvas.height / dpr
    const fontSize = screenW > 768 ? 20 : 13
    const spacing = screenW > 768 ? 5 : 3.5
    for (const label of pat.labels) {
      if (label.opacity <= 0) continue
      ctx.globalAlpha = label.opacity * 0.6
      ctx.fillStyle = 'white'
      ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      let lx = 28
      for (const ch of label.text) {
        ctx.fillText(ch, lx, screenH - 24)
        lx += ctx.measureText(ch).width + spacing
      }
    }

    ctx.restore()
    rafRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2 })
    lenis.on('scroll', ScrollTrigger.update)
    const onTick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)
    return () => { lenis.destroy(); gsap.ticker.remove(onTick) }
  }, [])

  useGSAP(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = window.innerWidth + 'px'
    canvas.style.height = window.innerHeight + 'px'

    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cx = w / 2
    const cy = h / 2
    const minDim = Math.min(w, h)

    const sizes = computeSizes(minDim)
    sizesRef.current = sizes

    const radius = minDim * 0.35

    const states = CHARS.map((char, i) => ({
      char, charIndex: i,
      x: cx, y: cy,
      opacity: 0, labelAlpha: 1, morseAlpha: 0,
      angle: 0, radial: false,
    }))
    stateRef.current = states

    const pat = patternRef.current
    const master = gsap.timeline({
      scrollTrigger: {
        trigger: triggerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      },
    })

    const radialPos = getRadialPositions(cx, cy, radius)
    const spiralPos = getSpiralPositions(cx, cy, radius)
    const wavePos = getWavePositions(cx, cy, w, h)
    const gridPos = getGridPositions(cx, cy, minDim)
    const constPos = getConstellationPositions(cx, cy, radius)

    // ═══════════════════════════════════════
    //  Pattern 1: Radial Burst
    // ═══════════════════════════════════════
    master.to(pat.labels[0], { opacity: 1, duration: 0.5 })

    states.forEach((s, i) => {
      master.to(s, { opacity: 1, duration: 0.3 }, 'radialIn+=' + (i * 0.015))
    })
    states.forEach((s, i) => {
      const p = radialPos[i]
      master.to(s, {
        x: p.x, y: p.y, angle: p.angle,
        duration: 1.5, ease: 'power3.out',
        onStart: () => { s.radial = true },
        onReverseComplete: () => { s.radial = false },
      }, 'radialExplode+=' + (i * 0.02))
    })
    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 1, duration: 0.6 }, 'radialMorse+=' + (i * 0.015))
    })
    master.to(spinRef.current, { angle: Math.PI * 2, duration: 2, ease: 'none' })
    master.to({}, { duration: 0.5 })

    // ═══════════════════════════════════════
    //  Pattern 2: Spiral
    // ═══════════════════════════════════════
    master.to(pat.labels[0], { opacity: 0, duration: 0.3 }, 'toSpiral')
    master.to(pat.labels[1], { opacity: 1, duration: 0.5 }, 'toSpiral+=0.2')

    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 0, duration: 0.3 }, 'toSpiral+=' + (i * 0.01))
    })
    states.forEach((s, i) => {
      const p = spiralPos[i]
      master.to(s, {
        x: p.x, y: p.y, angle: p.angle,
        duration: 1.8, ease: 'power2.inOut',
      }, 'spiralMove+=' + (i * 0.025))
    })
    master.to(spinRef.current, { angle: Math.PI * 4, duration: 1, ease: 'none' }, 'spiralMove')
    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 0.8, duration: 0.5 }, 'spiralMorse+=' + (i * 0.015))
    })
    master.to({}, { duration: 0.5 })

    // ═══════════════════════════════════════
    //  Pattern 3: Wave
    // ═══════════════════════════════════════
    master.to(pat.labels[1], { opacity: 0, duration: 0.3 }, 'toWave')
    master.to(pat.labels[2], { opacity: 1, duration: 0.5 }, 'toWave+=0.2')

    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 0, duration: 0.3 }, 'toWave+=' + (i * 0.01))
    })
    states.forEach((s, i) => {
      const p = wavePos[i]
      master.to(s, {
        x: p.x, y: p.y, angle: 0,
        duration: 1.5, ease: 'power2.inOut',
        onStart: () => { s.radial = false },
      }, 'waveMove+=' + (i * 0.02))
    })
    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 1, duration: 0.4 }, 'waveMorse+=' + (i * 0.015))
    })
    const waveAmp = h * 0.08
    const waveProxy = { t: 0 }
    master.to(waveProxy, {
      t: 1, duration: 2, ease: 'none',
      onUpdate: () => {
        const offset = waveProxy.t * Math.PI * 4
        states.forEach((s, i) => {
          s.y = wavePos[i].y + Math.sin(i * 0.5 + offset) * waveAmp
        })
      },
    }, 'waveAnimate')
    master.to({}, { duration: 0.3 })

    // ═══════════════════════════════════════
    //  Pattern 4: Grid
    // ═══════════════════════════════════════
    master.to(pat.labels[2], { opacity: 0, duration: 0.3 }, 'toGrid')
    master.to(pat.labels[3], { opacity: 1, duration: 0.5 }, 'toGrid+=0.2')

    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 0, duration: 0.2 }, 'toGrid+=' + (i * 0.008))
    })
    states.forEach((s, i) => {
      const p = gridPos[i]
      master.to(s, {
        x: p.x, y: p.y,
        duration: 1.2, ease: 'back.out(1.4)',
      }, 'gridMove+=' + (i * 0.03))
    })
    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 1, duration: 0.5 }, 'gridMorse+=' + (i * 0.02))
    })
    master.to({}, { duration: 0.5 })

    // ═══════════════════════════════════════
    //  Pattern 5: Constellation
    // ═══════════════════════════════════════
    master.to(pat.labels[3], { opacity: 0, duration: 0.3 }, 'toConst')
    master.to(pat.labels[4], { opacity: 1, duration: 0.5 }, 'toConst+=0.2')

    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 0, labelAlpha: 0, duration: 0.3 }, 'toConst+=' + (i * 0.01))
    })
    states.forEach((s, i) => {
      const p = constPos[i]
      master.to(s, {
        x: p.x, y: p.y,
        duration: 2.0, ease: 'power3.inOut',
      }, 'constMove+=' + (i * 0.02))
    })
    master.to(pat.connections, { opacity: 1, duration: 1.0 }, 'constLines')
    states.forEach((s, i) => {
      master.to(s, { labelAlpha: 1, duration: 0.4 }, 'constReveal+=' + (i * 0.015))
    })
    states.forEach((s, i) => {
      master.to(s, { morseAlpha: 0.6, duration: 0.5 }, 'constMorse+=' + (i * 0.015))
    })
    const driftAmp = minDim * 0.01
    const driftProxy = { t: 0 }
    master.to(driftProxy, {
      t: 1, duration: 2, ease: 'none',
      onUpdate: () => {
        states.forEach((s, i) => {
          s.x = constPos[i].x + Math.sin(driftProxy.t * Math.PI * 2 + i * 0.7) * driftAmp
          s.y = constPos[i].y + Math.cos(driftProxy.t * Math.PI * 2 + i * 1.1) * driftAmp
        })
      },
    }, 'constDrift')

    // Final fade
    master.to({}, { duration: 0.5 })
    states.forEach((s, i) => {
      master.to(s, { opacity: 0, duration: 0.8 }, 'fadeOut+=' + (i * 0.01))
    })
    master.to(pat.labels[4], { opacity: 0, duration: 0.5 }, 'fadeOut')
    master.to(pat.connections, { opacity: 0, duration: 0.5 }, 'fadeOut')

  }, { scope: triggerRef })

  return (
    <div ref={triggerRef} style={{ position: 'relative' }}>
      <div style={{ height: '2400vh' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000' }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}
      />
    </div>
  )
}
