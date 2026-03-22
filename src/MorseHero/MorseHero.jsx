import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { MORSE_MAP, CHAR_SEQUENCE, LABEL_FONT_SIZE } from '../EncodingAnimation/encodingData'
import { computeTablePositions, computeCirclePositions } from '../EncodingAnimation/layoutCalculations'
import { LABEL_CHAR_W, drawGroup, drawRadialGroup } from '../EncodingAnimation/drawFunctions'

gsap.registerPlugin(useGSAP)

const N = CHAR_SEQUENCE.length

export default function MorseHero() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const circleRef = useRef({ states: [], cx: 0, cy: 0, scale: 1, angle: 0, spinActive: false })
  const bgRef = useRef({ states: [], shimmerActive: false })

  // ── Draw loop ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const now = performance.now() * 0.001
    const circle = circleRef.current
    const bg = bgRef.current

    // ── Background table ─────────────────────────────────────
    for (const s of bg.states) {
      if (s.opacity <= 0) continue
      const code = MORSE_MAP[s.char]

      // Shimmer: gentle wave modulating opacity
      let shimmerMod = 1
      if (bg.shimmerActive) {
        shimmerMod = 0.92 + 0.08 * Math.sin(now * 0.5 + s.charIndex * 0.3)
      }

      ctx.save()
      ctx.translate(s.centerX, s.centerY)
      ctx.scale(s.scale, s.scale)
      ctx.globalAlpha = s.opacity * shimmerMod

      drawGroup(ctx, s, code, s.morseProgress)

      ctx.restore()
    }

    // ── Circle in corner ─────────────────────────────────────
    if (circle.spinActive) {
      circle.angle += 0.001
    }

    if (circle.states.length > 0 && circle.states[0].opacity > 0) {
      ctx.save()
      ctx.translate(circle.cx, circle.cy)
      ctx.scale(circle.scale, circle.scale)
      ctx.rotate(circle.angle)

      const screenCX = canvas.width / dpr / 2
      const screenCY = canvas.height / dpr / 2

      for (const s of circle.states) {
        if (s.opacity <= 0) continue
        const code = MORSE_MAP[s.char]

        // Positions are relative to canvas center, so offset
        ctx.save()
        ctx.translate(s.centerX - screenCX, s.centerY - screenCY)
        ctx.rotate(s.rotation)

        drawRadialGroup(ctx, s, code)

        ctx.restore()
      }

      ctx.restore()
    }

    ctx.restore()
    rafRef.current = requestAnimationFrame(draw)
  }, [])

  // ── Canvas resize ──────────────────────────────────────────
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
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  // ── Timeline ───────────────────────────────────────────────
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

    const { positions: tablePositions, finalScale } = computeTablePositions(w, h)
    const { positions: circlePositions } = computeCirclePositions(w, h, finalScale)

    const circle = circleRef.current
    circle.cx = cx
    circle.cy = cy
    circle.scale = 1
    circle.angle = 0

    // ── Circle states ────────────────────────────────────────
    const circleStates = CHAR_SEQUENCE.map((char) => {
      const cp = circlePositions.get(char)
      return {
        char,
        centerX: cx, centerY: cy,
        opacity: 0,
        morseOpacity: 0,
        labelOpacity: 1,
        rotation: cp.angle,
        // targets
        _targetX: cp.x,
        _targetY: cp.y,
      }
    })
    circle.states = circleStates

    // ── Background table states ──────────────────────────────
    const bgStates = CHAR_SEQUENCE.map((char, i) => {
      const pos = tablePositions.get(char)
      const code = MORSE_MAP[char]
      return {
        char, charIndex: i,
        centerX: pos.x, centerY: pos.y,
        scale: finalScale,
        opacity: 0,
        glowAmount: 0,
        morseOpacity: 1,
        morseProgress: 0,
        labelOpacity: 1,
        slotWidth: pos.slotWidth,
        labelSide: pos.labelSide,
        _numSymbols: code.length,
      }
    })
    bgRef.current.states = bgStates

    const master = gsap.timeline()

    // ═══════════════════════════════════════
    //  Phase 1: Circle forms at center
    // ═══════════════════════════════════════

    // Fade in chars at center
    circleStates.forEach((s, i) => {
      master.to(s, { opacity: 1, duration: 0.15 }, 'circleIn+=' + (i * 0.02))
    })

    // Explode to circle positions
    circleStates.forEach((s, i) => {
      master.to(s, {
        centerX: s._targetX, centerY: s._targetY,
        duration: 1.5, ease: 'power3.out',
      }, 'circleExplode+=' + (i * 0.025))
    })

    // Morse codes appear
    circleStates.forEach((s, i) => {
      master.to(s, { morseOpacity: 1, duration: 0.5 }, 'circleMorse+=' + (i * 0.02))
    })

    // Brief hold with spin
    master.to({}, { duration: 1.0 })

    // ═══════════════════════════════════════
    //  Phase 2: Circle moves to top-left corner
    // ═══════════════════════════════════════

    const cornerX = w * 0.13
    const cornerY = h * 0.18
    const cornerScale = Math.min(0.28, 180 / Math.min(w, h))

    master.to(circle, {
      cx: cornerX, cy: cornerY, scale: cornerScale,
      duration: 2.0, ease: 'power2.inOut',
      onComplete: () => { circle.spinActive = true },
    }, 'toCorner')

    // Slight fade while moving
    const circleOpacityProxy = { v: 1 }
    master.to(circleOpacityProxy, {
      v: 0.85, duration: 2.0, ease: 'power2.inOut',
      onUpdate: () => { circleStates.forEach(s => { s.opacity = circleOpacityProxy.v }) },
    }, 'toCorner')

    // ═══════════════════════════════════════
    //  Phase 3: Background table fades in
    // ═══════════════════════════════════════

    // Staggered fade-in with morse writing
    bgStates.forEach((s, i) => {
      const sub = gsap.timeline()
      sub.to(s, { opacity: 0.18, duration: 0.4, ease: 'power2.out' })
      sub.to(s, { morseProgress: s._numSymbols, duration: s._numSymbols * 0.15, ease: 'none' }, '-=0.2')
      master.add(sub, 'tableFade+=' + (i * 0.04))
    })

    // ═══════════════════════════════════════
    //  Phase 4: Activate shimmer
    // ═══════════════════════════════════════

    master.call(() => { bgRef.current.shimmerActive = true })
    // Keep timeline alive briefly so it doesn't end abruptly
    master.to({}, { duration: 1.0 })

  }, { scope: canvasRef })

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000' }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}
      />
    </>
  )
}
