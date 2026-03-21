import { useRef, useEffect, useCallback } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { MORSE_MAP, BAUDOT_MAP, BRAILLE_MAP, ASCII_MAP, CHAR_SEQUENCE, DOT_RADIUS, SYMBOL_GAP, LABEL_GAP, LABEL_FONT_SIZE, KING_WEN_SEQUENCE, LINES_TO_HEXAGRAM, asciiToHexLines, morseEncode, baudotEncode, brailleEncode, asciiEncode, ichingEncode } from './encodingData'
import { computeTablePositions, computeCirclePositions, computeBaudotPositions, computeRingsLayout, computeBrailleGridLayout, computeAsciiTableLayout, computeIChingGridLayout } from './layoutCalculations'
import { LABEL_CHAR_W, BRAILLE_DOT_OFFSETS, drawGroup, drawRadialGroup, drawBaudotGroup, drawRingsTransition, drawRingsToBrailleTransition, drawBrailleCell, drawIChingOverlay, drawHexagram, drawAsciiParticles, drawAsciiColumn, drawAsciiToIChing, drawIChingGrid, drawIChingTooltip, drawPhaseLabel } from './drawFunctions'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const BG_TRANSITIONS = [
  { label: 'fadeMorse',  color: '#a67cf7', origin: '50% 50%' },
  { label: 'explode',    color: '#38d0f2', origin: '50% 50%' },
  { label: 'toRings',    color: '#df5614', origin: '30% 70%' },
  { label: 'toBraille',  color: '#6cd868', origin: '70% 30%' },
  { label: 'fadeIChing', color: '#38d0f2', origin: '50% 50%' },
  { label: 'toIChing',   color: '#df5614', origin: '50% 100%' },
]

const PARALLAX_SECTIONS = [
  { color: '#000000', heightVh: 300 },
  { color: '#a67cf7', heightVh: 300 },
  { color: '#38d0f2', heightVh: 250 },
  { color: '#df5614', heightVh: 300 },
  { color: '#6cd868', heightVh: 200 },
  { color: '#38d0f2', heightVh: 350 },
]

// ═══════════════════════════════════════════════════════════════
//  Phase 1: Morse Code Intro
// ═══════════════════════════════════════════════════════════════
function buildMorseIntro(ctx, { skipMorseIntro }) {
  const { master, states, finalScale, phaseLabelsRef } = ctx

  if (skipMorseIntro) {
    states.forEach((s) => {
      const code = MORSE_MAP[s.char]
      s.centerX = s.finalX
      s.centerY = s.finalY
      s.scale = finalScale
      s.glowAmount = 0
      s.morseProgress = code.length
      s.labelOpacity = 1
      s.settled = true
    })
    states.forEach((s, i) => {
      master.to(s, {
        opacity: 0.8,
        duration: 0.6,
        ease: 'power2.out',
      }, i * 0.02)
    })
    master.to(phaseLabelsRef.current.labels[0], { opacity: 1, duration: 0.8, ease: 'power2.out' })
    master.to(phaseLabelsRef.current.labels[0], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, '+=0.6')
  } else {
    states.forEach((s, i) => {
      const code = MORSE_MAP[s.char]
      const numSymbols = code.length
      const sub = gsap.timeline()

      sub.to(s, { opacity: 1, duration: 0.1, ease: 'none' })
      sub.to(s, { morseProgress: numSymbols, duration: numSymbols * 0.25, ease: 'none' })
      sub.to(s, { labelOpacity: 1, duration: 0.15, ease: 'none' }, '-=0.05')
      sub.to(s, { duration: 0.3 })
      sub.to(s, {
        centerX: s.finalX,
        centerY: s.finalY,
        scale: finalScale,
        glowAmount: 0,
        opacity: 0.8,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: () => { s.settled = true },
      })

      master.add(sub, i === 0 ? 0 : '>-0.05')
    })
    master.to(phaseLabelsRef.current.labels[0], { opacity: 1, duration: 0.8, ease: 'power2.out' })
    master.to(phaseLabelsRef.current.labels[0], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, '+=0.6')
  }
}

// ═══════════════════════════════════════════════════════════════
//  Phase 2: Table → Circle
// ═══════════════════════════════════════════════════════════════
function buildTableToCircle(ctx) {
  const { master, states, w, h, finalScale, isScroll, spinRef } = ctx
  const { positions: circlePositions } = computeCirclePositions(w, h, finalScale)

  // Pause to let the table breathe
  master.to({}, { duration: 1.0 })

  // Fade out morse codes
  states.forEach((s, i) => {
    master.to(s, { morseOpacity: 0, duration: 0.5, ease: 'power2.in' }, 'fadeMorse+=' + (i * 0.01))
  })

  // Switch all to radial mode and compensate label offset
  const labelOffsets = states.map((s) => {
    const sw = s.slotWidth
    const halfSlot = sw / 2
    if (s.labelSide === 'right') {
      return (halfSlot - LABEL_CHAR_W / 2) * finalScale
    } else {
      return (-halfSlot + LABEL_CHAR_W / 2) * finalScale
    }
  })

  master.to({}, {
    duration: 0.001,
    onComplete: () => {
      states.forEach((s, i) => { s.centerX += labelOffsets[i]; s.radial = true })
    },
    onReverseComplete: () => {
      states.forEach((s, i) => { s.centerX -= labelOffsets[i]; s.radial = false })
    },
  })

  // Flow letters into circle
  states.forEach((s, i) => {
    const cp = circlePositions.get(s.char)
    master.to(s, {
      centerX: cp.x, centerY: cp.y, rotation: cp.angle, opacity: 1,
      duration: 2.0, ease: 'power2.inOut',
    }, 'toCircle+=' + (i * 0.08))
  })

  // Fade in morse codes radially
  states.forEach((s, i) => {
    master.to(s, { morseOpacity: 1, duration: 0.8, ease: 'power2.out' }, 'showMorse+=' + (i * 0.03))
  })

  // Circle rotation
  if (isScroll) {
    master.to(spinRef.current, { angle: Math.PI * 2, duration: 2, ease: 'none' })
  } else {
    master.call(() => { spinRef.current.active = true })
  }
}

// ═══════════════════════════════════════════════════════════════
//  Phase 3: Morse Circle → Baudot Tape
// ═══════════════════════════════════════════════════════════════
function buildCircleToBaudot(ctx) {
  const { master, states, w, h, finalScale, isScroll, spinRef, phaseLabelsRef } = ctx
  const { positions: baudotPositions } = computeBaudotPositions(w, h, finalScale)

  if (!isScroll) {
    master.to({}, { duration: 2.0 })
    master.to(spinRef.current, { speed: 0, duration: 1.5, ease: 'power2.out' })
  }

  // Fade out radial morse codes
  states.forEach((s, i) => {
    master.to(s, { morseOpacity: 0, duration: 0.5, ease: 'power2.in' }, 'fadeMorse3+=' + (i * 0.01))
  })

  // Phase label: MORSE → BAUDOT
  master.to(phaseLabelsRef.current.labels[0], { opacity: 0, morphT: 0, duration: 0.6, ease: 'power2.in' }, 'explode')
  master.to(phaseLabelsRef.current.labels[1], { opacity: 1, duration: 0.8, ease: 'power2.out' }, 'explode+=0.3')
  master.to(phaseLabelsRef.current.labels[1], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, 'explode+=1.8')

  // Explode to baudot rows
  states.forEach((s, i) => {
    const bp = baudotPositions.get(s.char)
    const prevLabelSide = s.labelSide
    const prevSlotWidth = s.slotWidth
    master.to(s, {
      centerX: bp.x, centerY: bp.y, rotation: 0, scale: finalScale,
      duration: 1.2, ease: 'back.out(1.2)',
      onStart: () => {
        s.baudot = true; s.radial = false
        s.labelSide = bp.labelSide; s.slotWidth = bp.slotWidth
      },
      onReverseComplete: () => {
        s.baudot = false; s.radial = true
        s.labelSide = prevLabelSide; s.slotWidth = prevSlotWidth
      },
    }, 'explode+=' + (i * 0.04))
  })

  // Fade in baudot bits
  states.forEach((s, i) => {
    master.to(s, { baudotOpacity: 1, duration: 0.6, ease: 'power2.out' }, 'baudotFade+=' + (i * 0.03))
  })
}

// ═══════════════════════════════════════════════════════════════
//  Phase 4: Baudot Grid → Concentric Rings
// ═══════════════════════════════════════════════════════════════
function buildBaudotToRings(ctx) {
  const { master, states, w, h, finalScale, isScroll, ringsRef } = ctx
  const ringsLayout = computeRingsLayout(w, h, finalScale)

  ringsRef.current._radii = ringsLayout.ringRadii
  ringsRef.current._dotRadius = ringsLayout.dotRadius
  ringsRef.current._baudotScale = finalScale

  // Fade out baudot labels
  states.forEach((s, i) => {
    master.to(s, { labelOpacity: 0, duration: 0.4, ease: 'power2.in' }, 'fadeLabels4+=' + (i * 0.01))
  })

  // Transition baudot dots → ring positions
  states.forEach((s, i) => {
    master.to(s, {
      ringsT: 1, duration: 2.0, ease: 'expo.inOut',
      onStart: () => {
        const sw = s.slotWidth
        const halfSlot = sw / 2
        const bitsWidth = 5 * DOT_RADIUS * 2 + 4 * SYMBOL_GAP
        let bitsStartX
        if (s.labelSide === 'right') {
          bitsStartX = halfSlot - LABEL_CHAR_W - LABEL_GAP - bitsWidth
        } else {
          bitsStartX = -halfSlot + LABEL_CHAR_W + LABEL_GAP
        }
        s.baudotDotScreenX = []
        s.baudotDotScreenY = []
        for (let j = 0; j < 5; j++) {
          const localX = bitsStartX + j * (DOT_RADIUS * 2 + SYMBOL_GAP) + DOT_RADIUS
          s.baudotDotScreenX[j] = s.centerX + s.scale * localX
          s.baudotDotScreenY[j] = s.centerY
        }
        s.ringAngle = ringsLayout.positions.get(s.char).angle
      },
      onReverseComplete: () => { s.ringsT = 0 },
    }, 'toRings+=' + (i * 0.03))
  })

  // Start independent ring rotation
  if (isScroll) {
    for (let i = 0; i < 5; i++) {
      master.to(ringsRef.current.angles, {
        [i]: Math.PI * 2 * (1 + i * 0.2), duration: 3, ease: 'none',
      }, 'ringsRotate')
    }
  } else {
    master.call(() => { ringsRef.current.active = true })
  }
}

// ═══════════════════════════════════════════════════════════════
//  Phase 5: Concentric Rings → Braille Grid + I Ching Overlay
// ═══════════════════════════════════════════════════════════════
function buildRingsToBraille(ctx) {
  const { master, states, w, h, centerX, centerY, finalScale, isScroll, ringsRef, brailleRef, phaseLabelsRef } = ctx
  const ringsLayout = computeRingsLayout(w, h, finalScale)
  const brailleLayout = computeBrailleGridLayout(w, h)
  brailleRef.current.gridLayout = brailleLayout

  // Stop ring rotation
  if (!isScroll) {
    master.to({}, { duration: 1.5 })
    ringsRef.current.speeds.forEach((_, i) => {
      master.to(ringsRef.current.speeds, { [i]: 0, duration: 1.0, ease: 'power2.out' }, 'stopRings')
    })
  }

  // Phase label: BAUDOT → BRAILLE
  master.to(phaseLabelsRef.current.labels[1], { opacity: 0, morphT: 0, duration: 0.6, ease: 'power2.in' }, 'toBraille')
  master.to(phaseLabelsRef.current.labels[2], { opacity: 1, duration: 0.8, ease: 'power2.out' }, 'toBraille+=0.5')
  master.to(phaseLabelsRef.current.labels[2], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, 'toBraille+=2.0')

  // Fly dots from rings to braille grid
  states.forEach((s, i) => {
    const bp = brailleLayout.positions.get(s.char)
    master.to(s, {
      brailleT: 1, duration: 2.5, ease: 'power3.inOut',
      onStart: () => {
        const ringAngle = ringsLayout.positions.get(s.char).angle
        s.ringDotScreenX = []
        s.ringDotScreenY = []
        for (let j = 0; j < 5; j++) {
          s.ringDotScreenX[j] = centerX + ringsLayout.ringRadii[j] * Math.sin(ringAngle + ringsRef.current.angles[j])
          s.ringDotScreenY[j] = centerY - ringsLayout.ringRadii[j] * Math.cos(ringAngle + ringsRef.current.angles[j])
        }
        ringsRef.current.active = false
        s.brailleCellX = bp.x
        s.brailleCellY = bp.y
      },
    }, 'toBraille+=' + (i * 0.04))
  })

  // Morph: circle → square → circle
  states.forEach((s, i) => {
    const sub = gsap.timeline()
    sub.to(s, { morphRadius: 0, duration: 0.4, ease: 'power2.in' })
    sub.to(s, { duration: 1.5 })
    sub.to(s, { morphRadius: 1, duration: 0.5, ease: 'power2.out' })
    master.add(sub, 'toBraille+=' + (i * 0.04))
  })

  // Flash in 6th dot
  states.forEach((s, i) => {
    master.to(s, { dot6Flash: 1, duration: 0.3, ease: 'power2.out' }, 'flash6th+=' + (i * 0.02))
  })

  // Labels appear below cells
  states.forEach((s, i) => {
    master.to(s, { brailleLabelOpacity: 1, duration: 0.4 }, 'brailleLabels+=' + (i * 0.02))
  })

  // I Ching hexagrams fade in
  states.forEach((s, i) => {
    master.to(s, { iChingOpacity: 1, duration: 0.8 }, 'iching+=' + (i * 0.02))
  })

  // Activate breathing
  master.call(() => { brailleRef.current.active = true })
}

// ═══════════════════════════════════════════════════════════════
//  Phase 6: Braille Grid → ASCII Table via Bits Explosion
// ═══════════════════════════════════════════════════════════════
function buildBrailleToAscii(ctx) {
  const { master, states, w, h, isScroll, brailleRef, particlesRef, phaseLabelsRef } = ctx
  const asciiLayout = computeAsciiTableLayout(w, h)
  particlesRef.current.asciiLayout = asciiLayout

  // Pre-set ASCII cell positions
  states.forEach((s) => {
    const asciiPos = asciiLayout.positions.get(s.char)
    s.asciiCellX = asciiPos.x
    s.asciiCellY = asciiPos.y
  })

  // Pre-create particles
  const bl = brailleRef.current.gridLayout
  const minDim = Math.min(w, h)
  const explodeBase = minDim * 0.12
  const explodeRange = minDim * 0.18
  const preParticles = []
  states.forEach((s, ci) => {
    const brailleCode = BRAILLE_MAP[s.char]
    const asciiCode = ASCII_MAP[s.char]
    const asciiPos = asciiLayout.positions.get(s.char)
    const bp = bl.positions.get(s.char)

    for (let di = 0; di < 6; di++) {
      const offX = BRAILLE_DOT_OFFSETS[di][0] * bl.dx
      const offY = BRAILLE_DOT_OFFSETS[di][1] * bl.dy
      const srcX = bp.x + offX
      const srcY = bp.y + offY
      const angle = Math.random() * Math.PI * 2
      const dist = explodeBase + Math.random() * explodeRange

      preParticles.push({
        charIndex: ci, dotIndex: di, srcX, srcY,
        explodeX: srcX + Math.cos(angle) * dist,
        explodeY: srcY + Math.sin(angle) * dist,
        targetX: asciiPos.x,
        targetY: asciiPos.y - asciiLayout.columnHeight / 2 + di * asciiLayout.dotGap,
        chaosSeed: Math.random() * Math.PI * 2,
        radius: bl.dotRadius, targetRadius: asciiLayout.dotRadius,
        srcOpacity: brailleCode[di] === '1' ? 1 : 0.15,
        targetOpacity: asciiCode[di] === '1' ? 1 : 0.15,
        isNewBit: false,
      })
    }

    // 7th dot (new ASCII bit)
    const angle = Math.random() * Math.PI * 2
    const dist = explodeBase + Math.random() * explodeRange
    preParticles.push({
      charIndex: ci, dotIndex: 6,
      srcX: bp.x, srcY: bp.y,
      explodeX: bp.x + Math.cos(angle) * dist,
      explodeY: bp.y + Math.sin(angle) * dist,
      targetX: asciiPos.x,
      targetY: asciiPos.y - asciiLayout.columnHeight / 2 + 6 * asciiLayout.dotGap,
      chaosSeed: Math.random() * Math.PI * 2,
      radius: bl.dotRadius * 0.5, targetRadius: asciiLayout.dotRadius,
      srcOpacity: 0,
      targetOpacity: asciiCode[6] === '1' ? 1 : 0.15,
      isNewBit: true,
    })
  })
  particlesRef.current.particles = preParticles
  particlesRef.current.explosionT = 0
  particlesRef.current.reGroupT = 0
  particlesRef.current.floatAmplitude = 1
  particlesRef.current.globalOpacity = 0

  // Fade out I Ching + labels
  if (!isScroll) { master.to({}, { duration: 1.5 }) }
  master.to({}, {
    duration: 0.001,
    onComplete: () => { brailleRef.current.active = false },
    onReverseComplete: () => { brailleRef.current.active = true },
  })
  states.forEach((s) => {
    master.to(s, { iChingOpacity: 0, brailleLabelOpacity: 0, duration: 0.5 }, 'fadeIChing')
  })

  // Phase label: BRAILLE → ASCII
  master.to(phaseLabelsRef.current.labels[2], { opacity: 0, morphT: 0, duration: 0.6, ease: 'power2.in' }, 'explode6')
  master.to(phaseLabelsRef.current.labels[3], { opacity: 1, duration: 0.8, ease: 'power2.out' }, 'crossfade6+=0.3')
  master.to(phaseLabelsRef.current.labels[3], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, 'crossfade6+=1.8')

  // Crossfade braille → particles + explosion
  states.forEach((s) => {
    master.to(s, { brailleOpacity: 0, duration: 0.5, ease: 'power2.in' }, 'explode6')
  })
  master.to(particlesRef.current, {
    globalOpacity: 1, duration: 0.5, ease: 'power2.out',
    onStart: () => { particlesRef.current.active = true },
    onReverseComplete: () => { particlesRef.current.active = false },
  }, 'explode6')
  master.to(particlesRef.current, { explosionT: 1, duration: 1.0, ease: 'power2.out' }, 'explode6')

  // Brief chaotic float
  master.to({}, { duration: 0.5 })

  // Regroup — float dampens while particles converge
  master.to(particlesRef.current, { floatAmplitude: 0, duration: 0.8, ease: 'power2.out' }, 'regroup6')
  master.to(particlesRef.current, { reGroupT: 1, duration: 1.5, ease: 'power2.inOut' }, 'regroup6')

  // Smooth crossfade particles → ASCII columns
  const asciiTProxy = { v: 0 }
  master.to(asciiTProxy, {
    v: 1, duration: 0.5, ease: 'power2.out',
    onUpdate: () => { states.forEach(s => { s.asciiT = asciiTProxy.v }) },
    onReverseComplete: () => { states.forEach(s => { s.asciiT = 0 }) },
  }, 'crossfade6')
  master.to(particlesRef.current, {
    globalOpacity: 0, duration: 0.5, ease: 'power2.in',
    onComplete: () => { particlesRef.current.active = false },
    onReverseComplete: () => { particlesRef.current.active = true; particlesRef.current.globalOpacity = 1 },
  }, 'crossfade6')

  // Labels + green flash
  states.forEach((s, i) => {
    master.to(s, { asciiLabelOpacity: 1, duration: 0.4 }, 'asciiLabels+=' + (i * 0.015))
  })

  const flashProxy = { v: 0 }
  master.to(flashProxy, {
    v: 1, duration: 0.6, ease: 'power2.out',
    onUpdate: () => { states.forEach((s) => { s.dot7Flash = flashProxy.v }) },
  }, 'greenFlash')
  master.to(flashProxy, {
    v: 0, duration: 0.8, ease: 'power2.in',
    onUpdate: () => { states.forEach((s) => { s.dot7Flash = flashProxy.v }) },
  }, 'greenFlash+=0.6')
}

// ═══════════════════════════════════════════════════════════════
//  Phase 7: ASCII → I Ching Hexagrams
// ═══════════════════════════════════════════════════════════════
function buildAsciiToIChing(ctx) {
  const { master, states, w, h, isScroll, ichingRef, phaseLabelsRef } = ctx
  const ichingLayout = computeIChingGridLayout(w, h)
  ichingRef.current.layout = ichingLayout

  const hexToChars = {}
  states.forEach((s) => {
    const kwIdx = LINES_TO_HEXAGRAM[s.hexLines]
    if (kwIdx != null) {
      s.ichingGridX = ichingLayout.positions[kwIdx].x
      s.ichingGridY = ichingLayout.positions[kwIdx].y
      if (!hexToChars[s.hexLines]) hexToChars[s.hexLines] = []
      hexToChars[s.hexLines].push(s.charIndex)
    }
  })
  ichingRef.current.hexToChars = hexToChars

  // Phase label: ASCII → I CHING
  master.to(phaseLabelsRef.current.labels[3], { opacity: 0, morphT: 0, duration: 0.6, ease: 'power2.in' }, 'fadeAsciiLabels')
  master.to(phaseLabelsRef.current.labels[4], { opacity: 1, duration: 0.8, ease: 'power2.out' }, 'toLines+=0.3')
  master.to(phaseLabelsRef.current.labels[4], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, 'toLines+=1.8')

  // Fade out ASCII labels
  if (!isScroll) { master.to({}, { duration: 1.5 }) }
  states.forEach((s, i) => {
    master.to(s, { asciiLabelOpacity: 0, duration: 0.4, ease: 'power2.in' }, 'fadeAsciiLabels+=' + (i * 0.01))
  })

  // Discard 7th bit
  const flash8Proxy = { v: 0 }
  master.to(flash8Proxy, {
    v: 1, duration: 0.2,
    onUpdate: () => { states.forEach(s => { s.dot7Flash = flash8Proxy.v }) },
  }, 'discard7th')
  const shrinkProxy = { v: 1 }
  master.to(shrinkProxy, {
    v: 0, duration: 0.6, ease: 'power2.in',
    onUpdate: () => { states.forEach(s => { s.bit7Shrink = shrinkProxy.v }) },
  }, 'discard7th+=0.1')
  master.to(flash8Proxy, {
    v: 0, duration: 0.5,
    onUpdate: () => { states.forEach(s => { s.dot7Flash = flash8Proxy.v }) },
  }, 'discard7th+=0.3')

  // Dots to hexagram lines
  states.forEach((s, i) => {
    master.to(s, {
      ichingT: 1, duration: 1.5, ease: 'power2.inOut',
      onReverseComplete: () => { s.ichingT = 0 },
    }, 'toLines+=' + (i * 0.02))
  })

  // Fly to 8x8 grid
  master.to(ichingRef.current, { gridT: 1, duration: 2.0, ease: 'power3.inOut' }, 'toIChing')

  // Build extra hexagrams
  master.to(ichingRef.current, { extraOpacity: 1, duration: 1.0, ease: 'power2.out' }, 'fillGrid')
  master.to(ichingRef.current, { buildT: 1, duration: 1.5, ease: 'power2.out' }, 'fillGrid')

  // Breathe
  master.call(() => { ichingRef.current.breatheActive = true })
  if (!isScroll) { master.to({}, { duration: 2.0 }) }
}

// ═══════════════════════════════════════════════════════════════
//  Background Transitions
// ═══════════════════════════════════════════════════════════════
function buildBgTransitions(ctx, { mode, bgLayersRef, parallaxBgRef, triggerRef }) {
  const { master } = ctx

  if (mode !== 'parallax') {
    BG_TRANSITIONS.forEach((t, i) => {
      const el = bgLayersRef.current[i]
      if (!el) return
      master.to(el, {
        clipPath: `circle(150% at ${t.origin})`,
        duration: 2.0,
        ease: 'power2.inOut',
      }, t.label)
    })
  }

  if (mode === 'parallax') {
    if (parallaxBgRef.current) {
      const totalH = PARALLAX_SECTIONS.reduce((s, p) => s + p.heightVh, 0)
      gsap.to(parallaxBgRef.current, {
        y: () => -(totalH - 100) * window.innerHeight / 100,
        ease: 'none',
        scrollTrigger: {
          trigger: triggerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
        },
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════
export default function EncodingAnimation({ mode = 'auto', scrollDuration = 1.2, skipMorseIntro = false, showPhaseLabels = true }) {
  const canvasRef = useRef(null)
  const triggerRef = useRef(null)
  const bgLayersRef = useRef([])
  const parallaxSectionsRef = useRef([])
  const parallaxBgRef = useRef(null)
  const stateRef = useRef([])
  const rafRef = useRef(null)
  const spinRef = useRef({ active: false, angle: 0, speed: 0.0008 })
  const ringsRef = useRef({
    active: false,
    angles: [0, 0, 0, 0, 0],
    speeds: [0.0003, 0.00025, 0.0002, 0.00015, 0.0001],
  })
  const brailleRef = useRef({
    active: false,
    showIChing: false,
    gridLayout: null,
  })
  const particlesRef = useRef({
    active: false,
    explosionT: 0,
    reGroupT: 0,
    floatAmplitude: 1,
    globalOpacity: 0,
    particles: [],
    asciiLayout: null,
  })
  const ichingRef = useRef({
    layout: null, gridT: 0, extraOpacity: 0, buildT: 0,
    breatheActive: false,
    hexToChars: {},
  })
  const ichingTooltipRef = useRef({
    visible: false, x: 0, y: 0, number: 0, name: '', lines: '', chars: [],
  })
  const phaseLabelsRef = useRef({
    enabled: true,
    labels: [
      { text: 'MORSE CODE',  encoded: '', opacity: 0, morphT: 0 },
      { text: 'BAUDOT CODE', encoded: '', opacity: 0, morphT: 0 },
      { text: 'BRAILLE',     encoded: '', opacity: 0, morphT: 0 },
      { text: 'ASCII',       encoded: '', opacity: 0, morphT: 0 },
      { text: 'I CHING',     encoded: '', opacity: 0, morphT: 0 },
    ],
  })

  useEffect(() => {
    phaseLabelsRef.current.enabled = showPhaseLabels
  }, [showPhaseLabels])

  // ── Draw loop ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const spin = spinRef.current
    if (spin.active) { spin.angle += spin.speed }
    const rings = ringsRef.current
    if (rings.active) {
      for (let i = 0; i < 5; i++) { rings.angles[i] += rings.speeds[i] }
    }
    const screenCX = canvas.width / dpr / 2
    const screenCY = canvas.height / dpr / 2

    const braille = brailleRef.current
    const brailleLayout = braille.gridLayout

    for (const s of stateRef.current) {
      if (s.opacity <= 0) continue

      // I Ching
      if (s.ichingT >= 1 && ichingRef.current.gridT >= 1) continue
      if (s.ichingT >= 1 && ichingRef.current.gridT > 0) {
        const gt = ichingRef.current.gridT
        const gx = s.asciiCellX + (s.ichingGridX - s.asciiCellX) * gt
        const gy = s.asciiCellY + (s.ichingGridY - s.asciiCellY) * gt
        drawHexagram(ctx, gx, gy, s.hexLines, ichingRef.current.layout, s.opacity * s.ichingOpacity)
        continue
      }
      if (s.ichingT > 0) {
        drawAsciiToIChing(ctx, s, ASCII_MAP[s.char], s.hexLines, particlesRef.current.asciiLayout, ichingRef.current.layout)
        continue
      }

      // ASCII column
      if (s.asciiT > 0 && particlesRef.current.asciiLayout) {
        drawAsciiColumn(ctx, s, ASCII_MAP[s.char], particlesRef.current.asciiLayout)
        continue
      }

      // Skip individual braille drawing while particles are active
      if (particlesRef.current.active && s.brailleT >= 1) continue

      // Braille phase
      if (s.brailleT > 0 && brailleLayout) {
        const brailleCode = BRAILLE_MAP[s.char]
        if (s.brailleT < 1) {
          drawRingsToBrailleTransition(ctx, s, BAUDOT_MAP[s.char], brailleCode, brailleLayout, ringsRef.current)
        } else {
          const breatheScale = braille.active ? 1 + 0.015 * Math.sin(performance.now() * 0.002) : 1
          if (braille.showIChing && s.iChingOpacity > 0) {
            drawIChingOverlay(ctx, s, brailleCode, brailleLayout)
          }
          drawBrailleCell(ctx, s, brailleCode, brailleLayout, breatheScale)
        }
        continue
      }

      // Rings transition
      if (s.ringsT > 0) {
        drawRingsTransition(ctx, s, BAUDOT_MAP[s.char], rings._radii || [], rings.angles, rings._dotRadius || 0, screenCX, screenCY, rings._baudotScale || 1)
        if (s.ringsT >= 1) continue
      }

      const code = MORSE_MAP[s.char]
      ctx.save()
      if (s.radial && spin.angle !== 0) {
        ctx.translate(screenCX, screenCY)
        ctx.rotate(spin.angle)
        ctx.translate(s.centerX - screenCX, s.centerY - screenCY)
      } else {
        ctx.translate(s.centerX, s.centerY)
      }
      ctx.rotate(s.rotation)
      ctx.scale(s.scale, s.scale)
      ctx.globalAlpha = s.opacity

      if (s.baudot) {
        if (s.ringsT > 0) {
          if (s.labelOpacity > 0) {
            const sw = s.slotWidth
            const halfSlot = sw / 2
            let labelCenterX
            if (s.labelSide === 'right') {
              labelCenterX = halfSlot - LABEL_CHAR_W / 2
            } else {
              labelCenterX = -halfSlot + LABEL_CHAR_W / 2
            }
            ctx.shadowBlur = 0
            ctx.shadowColor = 'transparent'
            ctx.globalAlpha = s.opacity * s.labelOpacity
            ctx.fillStyle = 'white'
            ctx.font = `bold ${LABEL_FONT_SIZE}px Courier New, monospace`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(s.char, labelCenterX, 0)
          }
        } else {
          drawBaudotGroup(ctx, s, BAUDOT_MAP[s.char])
        }
      } else if (s.radial) {
        drawRadialGroup(ctx, s, code)
      } else {
        drawGroup(ctx, s, code, s.morseProgress)
      }

      ctx.restore()
    }

    if (particlesRef.current.active) {
      drawAsciiParticles(ctx, particlesRef.current)
    }

    const ichingDraw = ichingRef.current
    if (ichingDraw.layout && ichingDraw.gridT >= 1) {
      drawIChingGrid(ctx, ichingDraw, stateRef.current)
    }
    if (ichingTooltipRef.current.visible) {
      drawIChingTooltip(ctx, ichingTooltipRef.current)
    }

    drawPhaseLabel(ctx, phaseLabelsRef.current, canvas.width / dpr, canvas.height / dpr)

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
    document.body.style.overflow = mode === 'auto' ? 'hidden' : ''
    return () => { document.body.style.overflow = 'hidden' }
  }, [mode])

  useEffect(() => {
    if (mode !== 'scroll' && mode !== 'parallax') return

    const lenis = new Lenis({ duration: scrollDuration })
    lenis.on('scroll', ScrollTrigger.update)
    const onTick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(onTick)
    }
  }, [mode, scrollDuration])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  // ── Timeline setup ─────────────────────────────────────────
  useGSAP(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Ensure canvas is sized before computing positions
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = window.innerWidth + 'px'
    canvas.style.height = window.innerHeight + 'px'

    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const centerX = w / 2
    const centerY = h / 2

    const isScroll = mode === 'scroll' || mode === 'parallax'
    const { positions, finalScale } = computeTablePositions(w, h)
    const introScale = Math.min(1, Math.min(w, h) / 800)

    const states = CHAR_SEQUENCE.map((char, i) => {
      const pos = positions.get(char)
      return {
        char, charIndex: i,
        centerX, centerY, scale: introScale,
        opacity: 0, glowAmount: 1, morseProgress: 0, morseOpacity: 1,
        labelOpacity: 0, rotation: 0,
        radial: false, baudot: false, baudotOpacity: 0,
        ringsT: 0, ringAngle: 0, baudotDotScreenX: [], baudotDotScreenY: [],
        brailleT: 0, morphRadius: 1,
        brailleCellX: 0, brailleCellY: 0, brailleOpacity: 1,
        brailleLabelOpacity: 0, dot6Flash: 0, iChingOpacity: 0,
        asciiT: 0, asciiLabelOpacity: 0, dot7Flash: 0,
        asciiCellX: 0, asciiCellY: 0,
        hovered: false, ringDotScreenX: [], ringDotScreenY: [],
        settled: false, bit7Shrink: 1,
        ichingT: 0, hexLines: asciiToHexLines(char),
        ichingGridX: 0, ichingGridY: 0, ichingOpacity: 1,
        finalX: pos.x, finalY: pos.y,
        labelSide: pos.labelSide, slotWidth: pos.slotWidth,
      }
    })
    stateRef.current = states

    // Populate encoded text for phase labels
    const pl = phaseLabelsRef.current.labels
    pl[0].encoded = morseEncode('MORSE CODE')
    pl[1].encoded = baudotEncode('BAUDOT')
    pl[2].encoded = brailleEncode('BRAILLE')
    pl[3].encoded = asciiEncode('ASCII')
    pl[4].encoded = ichingEncode('I CHING')

    const master = gsap.timeline(isScroll ? {
      scrollTrigger: {
        trigger: triggerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      },
    } : undefined)

    const ctx = {
      master, states, w, h, centerX, centerY, finalScale, isScroll,
      spinRef, ringsRef, brailleRef, particlesRef, ichingRef, phaseLabelsRef,
    }

    // ═══════════════════════════════════════
    //  Animation phases (sequential)
    // ═══════════════════════════════════════
    buildMorseIntro(ctx, { skipMorseIntro })
    buildTableToCircle(ctx)
    buildCircleToBaudot(ctx)
    buildBaudotToRings(ctx)
    buildRingsToBraille(ctx)
    buildBrailleToAscii(ctx)
    buildAsciiToIChing(ctx)
    buildBgTransitions(ctx, { mode, bgLayersRef, parallaxBgRef, triggerRef })

  }, { scope: mode !== 'auto' ? triggerRef : canvasRef })

  // ── I Ching overlay toggle (i key) ─────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'i' || !brailleRef.current.active) return
      brailleRef.current.showIChing = !brailleRef.current.showIChing
      const show = brailleRef.current.showIChing
      stateRef.current.forEach((s) => {
        gsap.to(s, {
          iChingOpacity: show ? 1 : 0,
          brailleOpacity: show ? 0.3 : 1,
          duration: 0.6,
          ease: 'power2.inOut',
        })
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── I Ching hover tooltip ──────────────────────────────────
  useEffect(() => {
    function onMouseMove(e) {
      const ic = ichingRef.current
      if (!ic.layout || ic.gridT < 1) {
        ichingTooltipRef.current.visible = false
        return
      }
      const mx = e.clientX
      const my = e.clientY
      let closestDist = Infinity
      let closestIdx = -1
      for (let i = 0; i < 64; i++) {
        const pos = ic.layout.positions[i]
        const dx = mx - pos.x
        const dy = my - pos.y
        const dist = dx * dx + dy * dy
        if (dist < closestDist) { closestDist = dist; closestIdx = i }
      }
      const hitRadius = Math.max(ic.layout.cellW * 0.4, 30)
      if (closestIdx >= 0 && Math.sqrt(closestDist) < hitRadius) {
        const [lines, name] = KING_WEN_SEQUENCE[closestIdx]
        const chars = (ic.hexToChars[lines] || []).map(ci => stateRef.current[ci].char)
        ichingTooltipRef.current = {
          visible: true, x: mx, y: my,
          number: closestIdx + 1, name, lines, chars,
        }
      } else {
        ichingTooltipRef.current.visible = false
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  // ── JSX ────────────────────────────────────────────────────
  const canvasElement = (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    />
  )

  const bgElement = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
      {BG_TRANSITIONS.map((t, i) => (
        <div
          key={i}
          ref={el => bgLayersRef.current[i] = el}
          style={{
            position: 'absolute',
            inset: 0,
            background: t.color,
            clipPath: `circle(0% at ${t.origin})`,
          }}
        />
      ))}
    </div>
  )

  if (mode === 'parallax') {
    return (
      <div ref={triggerRef} style={{ position: 'relative' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
          <div ref={parallaxBgRef}>
            {PARALLAX_SECTIONS.map((section, i) => (
              <div
                key={i}
                ref={el => parallaxSectionsRef.current[i] = el}
                style={{
                  height: `${section.heightVh}vh`,
                  background: section.color,
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ height: '1800vh' }} />
        {canvasElement}
      </div>
    )
  }

  if (mode === 'scroll') {
    return (
      <div ref={triggerRef} style={{ position: 'relative' }}>
        <div style={{ height: '1800vh' }} />
        {bgElement}
        {canvasElement}
      </div>
    )
  }

  return <>{bgElement}{canvasElement}</>
}
