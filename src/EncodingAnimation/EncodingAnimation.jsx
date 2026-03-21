import { useRef, useEffect, useCallback } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { MORSE_MAP, BAUDOT_MAP, BRAILLE_MAP, ASCII_MAP, CHAR_SEQUENCE, DOT_RADIUS, DASH_WIDTH, DASH_HEIGHT, SYMBOL_GAP, LABEL_GAP, LABEL_FONT_SIZE, KING_WEN_SEQUENCE, LINES_TO_HEXAGRAM, asciiToHexLines } from './encodingData'
import { computeTablePositions, computeCirclePositions, computeBaudotPositions, computeRingsLayout, computeBrailleGridLayout, computeAsciiTableLayout, computeIChingGridLayout, morseWidth } from './layoutCalculations'

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
  { color: '#000000', heightVh: 300 },  // Morse intro + table
  { color: '#a67cf7', heightVh: 300 },  // Baudot
  { color: '#38d0f2', heightVh: 250 },  // Rings
  { color: '#df5614', heightVh: 300 },  // Braille
  { color: '#6cd868', heightVh: 200 },  // ASCII
  { color: '#38d0f2', heightVh: 350 },  // I Ching
]

const LABEL_CHAR_W = LABEL_FONT_SIZE * 0.65

function morseSymbolCount(code) {
  return code.length
}

// Draw a group centered at origin.
// labelSide: 'left' = [label][gap][morse], 'right' = [morse][gap][label]
// slotWidth: fixed width so all items in a column align morse codes
function drawGroup(ctx, s, code, morseProgress) {
  const visibleSymbols = Math.ceil(morseProgress)
  const fractional = morseProgress - Math.floor(morseProgress)
  const sw = s.slotWidth
  const halfSlot = sw / 2

  let morseStartX, labelCenterX

  if (s.labelSide === 'right') {
    // Left column: morse right-aligned, ending just before the label
    labelCenterX = halfSlot - LABEL_CHAR_W / 2
    const mw = morseWidth(code)
    morseStartX = halfSlot - LABEL_CHAR_W - LABEL_GAP - mw
  } else {
    // Right column: label on left, morse starts after label+gap
    labelCenterX = -halfSlot + LABEL_CHAR_W / 2
    morseStartX = -halfSlot + LABEL_CHAR_W + LABEL_GAP
  }

  // Draw morse symbols (left-aligned from morseStartX)
  if (s.glowAmount > 0) {
    ctx.shadowBlur = 15 * s.glowAmount
    ctx.shadowColor = 'white'
  }

  let drawX = morseStartX
  for (let i = 0; i < visibleSymbols; i++) {
    const sym = code[i]
    // Last visible symbol fades in using the fractional part
    const isLast = i === visibleSymbols - 1 && fractional > 0
    const symAlpha = isLast ? fractional : 1
    ctx.globalAlpha = s.opacity * symAlpha * s.morseOpacity
    ctx.fillStyle = 'white'
    if (sym === '.') {
      ctx.beginPath()
      ctx.arc(drawX + DOT_RADIUS, 0, DOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      drawX += DOT_RADIUS * 2 + SYMBOL_GAP
    } else {
      ctx.beginPath()
      ctx.rect(drawX, -DASH_HEIGHT / 2, DASH_WIDTH, DASH_HEIGHT)
      ctx.fill()
      drawX += DASH_WIDTH + SYMBOL_GAP
    }
  }

  // Draw label
  if (s.labelOpacity > 0) {
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = s.opacity * s.labelOpacity
    ctx.fillStyle = 'white'
    ctx.font = `bold ${LABEL_FONT_SIZE}px Courier New, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.char, labelCenterX, 0)
  }
}

// Draw group in radial mode: label at origin, morse extending outward (-Y)
function drawRadialGroup(ctx, s, code) {
  // Morse extending outward (-Y direction)
  if (s.morseOpacity > 0) {
    ctx.fillStyle = 'white'
    let drawY = -(LABEL_FONT_SIZE / 2 + LABEL_GAP)
    for (let i = 0; i < code.length; i++) {
      ctx.globalAlpha = s.opacity * s.morseOpacity
      const sym = code[i]
      if (sym === '.') {
        ctx.beginPath()
        ctx.arc(0, drawY - DOT_RADIUS, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        drawY -= DOT_RADIUS * 2 + SYMBOL_GAP
      } else {
        ctx.beginPath()
        ctx.rect(-DASH_HEIGHT / 2, drawY - DASH_WIDTH, DASH_HEIGHT, DASH_WIDTH)
        ctx.fill()
        drawY -= DASH_WIDTH + SYMBOL_GAP
      }
    }
  }

  // Label at origin
  if (s.labelOpacity > 0) {
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = s.opacity * s.labelOpacity
    ctx.fillStyle = 'white'
    ctx.font = `bold ${LABEL_FONT_SIZE}px Courier New, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.char, 0, 0)
  }
}

// Draw baudot tape row: same layout style as drawGroup but with 5 dot cells
function drawBaudotGroup(ctx, s, baudotCode) {
  const sw = s.slotWidth
  const halfSlot = sw / 2
  const bitsWidth = 5 * DOT_RADIUS * 2 + 4 * SYMBOL_GAP

  let bitsStartX, labelCenterX

  if (s.labelSide === 'right') {
    // Left column: bits right-aligned, label on right edge
    labelCenterX = halfSlot - LABEL_CHAR_W / 2
    bitsStartX = halfSlot - LABEL_CHAR_W - LABEL_GAP - bitsWidth
  } else {
    // Right column: label on left, bits after
    labelCenterX = -halfSlot + LABEL_CHAR_W / 2
    bitsStartX = -halfSlot + LABEL_CHAR_W + LABEL_GAP
  }

  // Draw bit cells
  let drawX = bitsStartX
  for (let i = 0; i < 5; i++) {
    const bit = baudotCode[i]
    const bitAlpha = bit === '1' ? 1 : 0.15
    ctx.globalAlpha = s.opacity * s.baudotOpacity * bitAlpha
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(drawX + DOT_RADIUS, 0, DOT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    drawX += DOT_RADIUS * 2 + SYMBOL_GAP
  }

  // Draw label
  if (s.labelOpacity > 0) {
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = s.opacity * s.labelOpacity
    ctx.fillStyle = 'white'
    ctx.font = `bold ${LABEL_FONT_SIZE}px Courier New, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.char, labelCenterX, 0)
  }
}

// Draw dots transitioning from baudot grid positions to concentric ring positions
// At ringsT=0: dots at their baudot grid screen positions
// At ringsT=1: dots at their ring positions around canvas center
function drawRingsTransition(ctx, s, baudotCode, ringRadii, ringAngles, dotRadius, screenCX, screenCY, baudotDotScale) {
  const t = s.ringsT
  for (let i = 0; i < 5; i++) {
    const bit = baudotCode[i]
    // '0' bits fade out during transition, '1' bits stay fully visible
    const bitAlpha = bit === '1' ? 1 : 0.15 * (1 - t)
    if (bitAlpha <= 0.001) continue

    ctx.globalAlpha = s.opacity * bitAlpha
    ctx.fillStyle = 'white'

    // Baudot screen position (captured at transition start)
    const bx0 = s.baudotDotScreenX[i]
    const by0 = s.baudotDotScreenY[i]

    // Ring screen position
    const bx1 = screenCX + ringRadii[i] * Math.sin(s.ringAngle + ringAngles[i])
    const by1 = screenCY - ringRadii[i] * Math.cos(s.ringAngle + ringAngles[i])

    // Lerp position
    const x = bx0 + (bx1 - bx0) * t
    const y = by0 + (by1 - by0) * t

    // Lerp dot radius from baudot size to ring size
    const r0 = DOT_RADIUS * baudotDotScale
    const r1 = dotRadius
    const r = r0 + (r1 - r0) * t

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Dot offsets relative to cell center for braille 2x3 grid
// dot0: (-dx, -dy)  dot3: (+dx, -dy)
// dot1: (-dx,   0)  dot4: (+dx,   0)
// dot2: (-dx, +dy)  dot5: (+dx, +dy)
const BRAILLE_DOT_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [1, -1], [1, 0], [1, 1],
]

function drawRingsToBrailleTransition(ctx, s, baudotCode, brailleCode, layout, ringsRef) {
  const t = s.brailleT
  const { dx, dy, dotRadius: targetDotR } = layout
  const srcDotR = ringsRef._dotRadius || targetDotR

  // Draw 5 original dots transitioning
  for (let i = 0; i < 5; i++) {
    const baudotBit = baudotCode[i]
    const brailleBit = brailleCode[i]
    const baudotAlpha = baudotBit === '1' ? 1 : 0.12
    const brailleAlpha = brailleBit === '1' ? 1 : 0.12
    const alpha = baudotAlpha + (brailleAlpha - baudotAlpha) * t

    // Lerp from captured ring pos to braille cell pos
    const offX = BRAILLE_DOT_OFFSETS[i][0] * dx
    const offY = BRAILLE_DOT_OFFSETS[i][1] * dy
    const targetX = s.brailleCellX + offX
    const targetY = s.brailleCellY + offY

    const x = s.ringDotScreenX[i] + (targetX - s.ringDotScreenX[i]) * t
    const y = s.ringDotScreenY[i] + (targetY - s.ringDotScreenY[i]) * t

    const r = srcDotR + (targetDotR - srcDotR) * t
    const cornerRadius = r * s.morphRadius

    ctx.globalAlpha = s.opacity * alpha
    ctx.fillStyle = 'white'
    ctx.beginPath()
    if (cornerRadius >= r * 0.99) {
      ctx.arc(x, y, r, 0, Math.PI * 2)
    } else {
      ctx.roundRect(x - r, y - r, r * 2, r * 2, cornerRadius)
    }
    ctx.fill()
  }

  // 6th dot appearing
  if (s.dot6Flash > 0) {
    const brailleBit5 = brailleCode[5]
    const alpha5 = brailleBit5 === '1' ? 1 : 0.12
    const offX = BRAILLE_DOT_OFFSETS[5][0] * dx
    const offY = BRAILLE_DOT_OFFSETS[5][1] * dy
    const x = s.brailleCellX + offX
    const y = s.brailleCellY + offY
    const r = targetDotR

    // Glow effect
    if (s.dot6Flash < 1 && alpha5 > 0.5) {
      ctx.shadowBlur = 12 * s.dot6Flash
      ctx.shadowColor = 'white'
    }
    ctx.globalAlpha = s.opacity * alpha5 * s.dot6Flash
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }
}

function drawBrailleCell(ctx, s, brailleCode, layout, breatheScale) {
  const { dx, dy, dotRadius, labelOffsetY } = layout

  ctx.save()
  ctx.translate(s.brailleCellX, s.brailleCellY)
  ctx.scale(breatheScale, breatheScale)

  // Draw 6 dots
  for (let i = 0; i < 6; i++) {
    const bit = brailleCode[i]
    const offX = BRAILLE_DOT_OFFSETS[i][0] * dx
    const offY = BRAILLE_DOT_OFFSETS[i][1] * dy
    const r = dotRadius

    if (bit === '1') {
      ctx.globalAlpha = s.opacity * s.brailleOpacity
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(offX, offY, r, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.globalAlpha = s.opacity * s.brailleOpacity * 0.15
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(offX, offY, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Label below cell
  if (s.brailleLabelOpacity > 0) {
    ctx.globalAlpha = s.opacity * s.brailleLabelOpacity
    ctx.fillStyle = 'white'
    ctx.font = `bold ${Math.max(14, dotRadius * 2.5)}px Courier New, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(s.char, 0, labelOffsetY)
  }

  ctx.restore()
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

function drawAsciiParticles(ctx, pRef) {
  const { explosionT, reGroupT, floatAmplitude, particles, globalOpacity } = pRef
  const now = performance.now() * 0.001
  const alpha = globalOpacity != null ? globalOpacity : 1
  if (alpha <= 0) return

  for (const p of particles) {
    let x, y, r
    // Lerp radius from braille size to ascii size during regroup
    r = p.radius + (p.targetRadius - p.radius) * clamp01(reGroupT)

    // Interpolate opacity from braille to ASCII values during regroup
    const opacity = p.srcOpacity + (p.targetOpacity - p.srcOpacity) * clamp01(reGroupT * 3)
    if (opacity <= 0) continue

    // Float offset (used in both float and regroup phases)
    const floatOffX = Math.sin(now * 1.3 + p.chaosSeed) * floatAmplitude * 30
    const floatOffY = Math.cos(now * 0.9 + p.chaosSeed * 1.7) * floatAmplitude * 30

    if (reGroupT > 0) {
      // Regroup: converge from float position toward target
      const floatX = p.explodeX + floatOffX
      const floatY = p.explodeY + floatOffY
      const delay = (p.charIndex * 7 + p.dotIndex) / (36 * 7) * 0.15
      const localT = clamp01((reGroupT - delay) / (1 - delay))
      const ease = localT * localT * (3 - 2 * localT) // smoothstep
      x = floatX + (p.targetX - floatX) * ease
      y = floatY + (p.targetY - floatY) * ease
    } else if (explosionT >= 1) {
      // Chaotic float
      x = p.explodeX + floatOffX
      y = p.explodeY + floatOffY
    } else {
      // Explosion outward
      const ease = 1 - Math.pow(1 - explosionT, 3) // power3.out
      x = p.srcX + (p.explodeX - p.srcX) * ease
      y = p.srcY + (p.explodeY - p.srcY) * ease
    }

    ctx.globalAlpha = opacity * alpha
    ctx.fillStyle = p.isNewBit ? '#39ff14' : 'white'
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawAsciiColumn(ctx, s, asciiCode, layout) {
  const { dotRadius, dotGap, columnHeight, labelOffsetX, fontSize } = layout

  ctx.save()
  ctx.translate(s.asciiCellX, s.asciiCellY)

  for (let j = 0; j < 7; j++) {
    const bit = asciiCode[j]
    const x = 0
    const y = -columnHeight / 2 + j * dotGap
    const isNewBit = j === 6
    if (isNewBit && s.bit7Shrink <= 0) continue

    ctx.globalAlpha = s.opacity * s.asciiT * (bit === '1' ? 1 : 0.15)

    if (isNewBit) {
      ctx.fillStyle = '#39ff14'
      if (s.dot7Flash > 0) {
        ctx.shadowBlur = 15 * s.dot7Flash
        ctx.shadowColor = '#39ff14'
      }
    } else {
      ctx.fillStyle = 'white'
    }

    const dotR = isNewBit ? dotRadius * s.bit7Shrink : dotRadius
    ctx.beginPath()
    ctx.arc(x, y, dotR, 0, Math.PI * 2)
    ctx.fill()

    if (isNewBit && s.dot7Flash > 0) {
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'
    }
  }

  // Label to the left of the dot column, vertically centered
  if (s.asciiLabelOpacity > 0) {
    ctx.globalAlpha = s.opacity * s.asciiLabelOpacity
    ctx.fillStyle = 'white'
    ctx.font = `bold ${fontSize}px Courier New, monospace`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.char, -labelOffsetX, 0)
  }

  ctx.restore()
}

function drawIChingOverlay(ctx, s, brailleCode, layout) {
  const { dx, dy } = layout
  const lineW = dx * 3
  const lineH = dy * 0.3
  const gapW = lineW * 0.2

  ctx.save()
  ctx.translate(s.brailleCellX, s.brailleCellY)
  ctx.globalAlpha = s.iChingOpacity * 0.6 * s.opacity

  // 6 lines stacked vertically (bottom to top, like traditional I Ching)
  for (let i = 0; i < 6; i++) {
    const bit = brailleCode[i]
    const yOff = (2.5 - i) * (lineH + dy * 0.5)

    ctx.fillStyle = 'white'
    if (bit === '1') {
      // Yang: solid line
      ctx.fillRect(-lineW / 2, yOff - lineH / 2, lineW, lineH)
    } else {
      // Yin: broken line with center gap
      ctx.fillRect(-lineW / 2, yOff - lineH / 2, (lineW - gapW) / 2, lineH)
      ctx.fillRect(gapW / 2, yOff - lineH / 2, (lineW - gapW) / 2, lineH)
    }
  }

  ctx.restore()
}

function drawHexagram(ctx, x, y, lines, layout, opacity, buildT) {
  if (!layout) return
  const { lineW, lineH, lineGap, gapW } = layout
  const hexH = 5 * (lineH + lineGap)
  ctx.fillStyle = 'white'
  for (let i = 0; i < 6; i++) {
    const bit = lines[i]
    const lineY = y + hexH / 2 - i * (lineH + lineGap)
    let lineAlpha = 1
    if (buildT != null && buildT < 1) {
      lineAlpha = clamp01((buildT * 6 - i) * 2)
      if (lineAlpha <= 0) continue
    }
    ctx.globalAlpha = opacity * lineAlpha
    if (bit === '1') {
      ctx.fillRect(x - lineW / 2, lineY - lineH / 2, lineW, lineH)
    } else {
      const gapScale = (buildT != null && buildT < 1) ? clamp01(lineAlpha * 2 - 1) : 1
      const actualGap = gapW * gapScale
      const actualHalf = (lineW - actualGap) / 2
      ctx.fillRect(x - lineW / 2, lineY - lineH / 2, actualHalf, lineH)
      ctx.fillRect(x + lineW / 2 - actualHalf, lineY - lineH / 2, actualHalf, lineH)
    }
  }
}

function drawAsciiToIChing(ctx, s, asciiCode, hexLines, asciiLayout, ichingLayout) {
  if (!asciiLayout || !ichingLayout) return
  const t = s.ichingT
  const { dotRadius, dotGap, columnHeight } = asciiLayout
  const { lineW, lineH, lineGap, gapW } = ichingLayout
  const hexH = 5 * (lineH + lineGap)
  ctx.save()
  ctx.translate(s.asciiCellX, s.asciiCellY)
  ctx.fillStyle = 'white'
  for (let j = 0; j < 6; j++) {
    const bit = asciiCode[j]
    const hexBit = hexLines[j]
    const dotY = -columnHeight / 2 + j * dotGap
    const lineY = hexH / 2 - j * (lineH + lineGap)
    const y = dotY + (lineY - dotY) * t
    const w = dotRadius * 2 + (lineW - dotRadius * 2) * t
    const h = dotRadius * 2 + (lineH - dotRadius * 2) * t
    const dotAlpha = bit === '1' ? 1 : 0.15
    ctx.globalAlpha = s.opacity * (dotAlpha + (1 - dotAlpha) * t)
    if (hexBit === '0' && t > 0.5) {
      const gapT = (t - 0.5) / 0.5
      const gap = gapW * gapT
      const halfW = (w - gap) / 2
      ctx.fillRect(-w / 2, y - h / 2, halfW, h)
      ctx.fillRect(-w / 2 + halfW + gap, y - h / 2, halfW, h)
    } else {
      ctx.fillRect(-w / 2, y - h / 2, w, h)
    }
  }
  ctx.restore()
}

function drawIChingGrid(ctx, iching, states) {
  const layout = iching.layout
  if (!layout) return
  const breathe = iching.breatheActive ? 1 + 0.01 * Math.sin(performance.now() * 0.002) : 1
  for (let i = 0; i < 64; i++) {
    const [lines] = KING_WEN_SEQUENCE[i]
    const pos = layout.positions[i]
    const charIndices = iching.hexToChars[lines]
    let opacity = 0
    if (charIndices && charIndices.length > 0) {
      const s = states[charIndices[0]]
      opacity = s.opacity * s.ichingOpacity
    } else {
      opacity = iching.extraOpacity
    }
    if (opacity <= 0) continue
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.scale(breathe, breathe)
    ctx.translate(-pos.x, -pos.y)
    drawHexagram(ctx, pos.x, pos.y, lines, layout, opacity, charIndices ? 1 : iching.buildT)
    ctx.restore()
  }
}

function drawIChingTooltip(ctx, tip) {
  const padding = 10
  const lineHeight = 20
  ctx.font = 'bold 14px Courier New, monospace'
  const tlines = [
    '#' + tip.number + ' ' + tip.name,
    tip.lines.split('').map(b => b === '1' ? '\u2501' : '\u254D').join(' '),
  ]
  if (tip.chars.length > 0) tlines.push('ASCII: ' + tip.chars.join(', '))
  const maxW = Math.max(...tlines.map(l => ctx.measureText(l).width))
  const boxW = maxW + padding * 2
  const boxH = tlines.length * lineHeight + padding * 2
  const x = tip.x + 15
  const y = tip.y - boxH - 10
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(x, y, boxW, boxH, 6)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'white'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  tlines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + i * lineHeight)
  })
}

function morseEncode(text) {
  return text.split('').map(ch => ch === ' ' ? '/' : (MORSE_MAP[ch] || ''))
    .join(' ').replace(/\. /g, '· ').replace(/\./g, '·')
}

function baudotEncode(text) {
  return text.replace(/ /g, '').split('').map(ch => BAUDOT_MAP[ch] || '').join(' ')
}

function brailleEncode(text) {
  return text.replace(/ /g, '').split('').map(ch => {
    const bits = BRAILLE_MAP[ch]
    if (!bits) return ''
    let code = 0
    for (let i = 0; i < 6; i++) if (bits[i] === '1') code |= (1 << i)
    return String.fromCodePoint(0x2800 + code)
  }).join('')
}

function asciiEncode(text) {
  return text.replace(/ /g, '').split('').map(ch => ASCII_MAP[ch] || '').join(' ')
}

function ichingEncode(text) {
  // Use trigram symbols for a few representative chars
  const trigrams = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷']
  return text.replace(/ /g, '').split('').map((ch, i) => trigrams[i % trigrams.length]).join(' ')
}

function drawPhaseLabel(ctx, phaseLabels, screenW, screenH) {
  if (!phaseLabels.enabled) return
  const fontSize = screenW > 768 ? 20 : 13
  const spacing = screenW > 768 ? 5 : 3.5
  const x = 28, y = screenH - 24
  for (const label of phaseLabels.labels) {
    if (label.opacity <= 0) continue
    ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'

    // Draw name text (fades out as morphT increases)
    if (label.morphT < 1) {
      ctx.save()
      ctx.globalAlpha = label.opacity * 0.7 * (1 - label.morphT)
      ctx.fillStyle = 'white'
      let cx = x
      for (const ch of label.text) {
        ctx.fillText(ch, cx, y)
        cx += ctx.measureText(ch).width + spacing
      }
      ctx.restore()
    }

    // Draw encoded text (fades in as morphT increases)
    if (label.morphT > 0 && label.encoded) {
      ctx.save()
      ctx.globalAlpha = label.opacity * 0.7 * label.morphT
      ctx.fillStyle = 'white'
      let cx = x
      for (const ch of label.encoded) {
        ctx.fillText(ch, cx, y)
        cx += ctx.measureText(ch).width + spacing
      }
      ctx.restore()
    }
  }
}

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const spin = spinRef.current
    if (spin.active) {
      spin.angle += spin.speed
    }
    const rings = ringsRef.current
    if (rings.active) {
      for (let i = 0; i < 5; i++) {
        rings.angles[i] += rings.speeds[i]
      }
    }
    const screenCX = canvas.width / dpr / 2
    const screenCY = canvas.height / dpr / 2

    const braille = brailleRef.current
    const brailleLayout = braille.gridLayout

    for (const s of stateRef.current) {
      if (s.opacity <= 0) continue

      // Phase 8: I Ching
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

      // ASCII column (settled or fading in during crossfade)
      if (s.asciiT > 0 && particlesRef.current.asciiLayout) {
        drawAsciiColumn(ctx, s, ASCII_MAP[s.char], particlesRef.current.asciiLayout)
        continue
      }

      // Skip individual braille drawing while particles are active
      if (particlesRef.current.active && s.brailleT >= 1) continue

      // Braille phase: draw in screen space, skip everything else
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

      // Rings transition/final: draw in screen space, skip normal transform
      if (s.ringsT > 0) {
        drawRingsTransition(ctx, s, BAUDOT_MAP[s.char], rings._radii || [], rings.angles, rings._dotRadius || 0, screenCX, screenCY, rings._baudotScale || 1)
        if (s.ringsT >= 1) continue
        // During transition (0 < ringsT < 1), also draw baudot labels fading out
      }

      const code = MORSE_MAP[s.char]
      ctx.save()
      if (s.radial && spin.angle !== 0) {
        // Rotate the whole circle around screen center
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
        // During transition, only draw the label part (dots are drawn by ringsTransition above)
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

    // I Ching grid + reveal
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

  useGSAP(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const centerX = w / 2
    const centerY = h / 2

    const isScroll = mode === 'scroll' || mode === 'parallax'

    const { positions, finalScale } = computeTablePositions(w, h)

    // Scale intro animation to fit small screens
    const introScale = Math.min(1, Math.min(w, h) / 800)

    const states = CHAR_SEQUENCE.map((char, i) => {
      const pos = positions.get(char)
      return {
        char,
        charIndex: i,
        centerX,
        centerY,
        scale: introScale,
        opacity: 0,
        glowAmount: 1,
        morseProgress: 0,
        morseOpacity: 1,
        labelOpacity: 0,
        rotation: 0,
        radial: false,
        baudot: false,
        baudotOpacity: 0,
        ringsT: 0,
        ringAngle: 0,
        baudotDotScreenX: [],
        baudotDotScreenY: [],
        brailleT: 0,
        morphRadius: 1,
        brailleCellX: 0,
        brailleCellY: 0,
        brailleOpacity: 1,
        brailleLabelOpacity: 0,
        dot6Flash: 0,
        iChingOpacity: 0,
        asciiT: 0,
        asciiLabelOpacity: 0,
        dot7Flash: 0,
        asciiCellX: 0,
        asciiCellY: 0,
        hovered: false,
        ringDotScreenX: [],
        ringDotScreenY: [],
        settled: false,
        bit7Shrink: 1,
        ichingT: 0,
        hexLines: asciiToHexLines(char),
        ichingGridX: 0,
        ichingGridY: 0,
        ichingOpacity: 1,
        finalX: pos.x,
        finalY: pos.y,
        labelSide: pos.labelSide,
        slotWidth: pos.slotWidth,
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

    if (skipMorseIntro) {
      // Direct fade-in at table position
      states.forEach((s) => {
        const code = MORSE_MAP[s.char]
        s.centerX = s.finalX
        s.centerY = s.finalY
        s.scale = finalScale
        s.glowAmount = 0
        s.morseProgress = morseSymbolCount(code)
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
      // Morse phase label
      master.to(phaseLabelsRef.current.labels[0], { opacity: 1, duration: 0.8, ease: 'power2.out' })
      master.to(phaseLabelsRef.current.labels[0], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, '+=0.6')
    } else {
      states.forEach((s, i) => {
        const code = MORSE_MAP[s.char]
        const numSymbols = morseSymbolCount(code)
        const sub = gsap.timeline()

        // 1. Fade in
        sub.to(s, { opacity: 1, duration: 0.1, ease: 'none' })

        // 2. Morse writes L→R with smooth fade per symbol
        sub.to(s, {
          morseProgress: numSymbols,
          duration: numSymbols * 0.25,
          ease: 'none',
        })

        // 3. Label appears
        sub.to(s, { labelOpacity: 1, duration: 0.15, ease: 'none' }, '-=0.05')

        // 4. Pause
        sub.to(s, { duration: 0.3 })

        // 5. Shrink + fly to table
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
      // Morse phase label
      master.to(phaseLabelsRef.current.labels[0], { opacity: 1, duration: 0.8, ease: 'power2.out' })
      master.to(phaseLabelsRef.current.labels[0], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, '+=0.6')
    }

    // --- Phase 2: Table → Circle ---
    const { positions: circlePositions } = computeCirclePositions(w, h, finalScale)

    // 2a. Pause to let the table breathe
    master.to({}, { duration: 1.0 })

    // 2b. Fade out morse codes (all together, quick)
    states.forEach((s, i) => {
      master.to(s, {
        morseOpacity: 0,
        duration: 0.5,
        ease: 'power2.in',
      }, 'fadeMorse+=' + (i * 0.01))
    })

    // 2c. Switch all to radial mode and compensate label offset so there's no visual jump
    // Precompute label offsets for the radial switch (at finalScale, which is the scale at table position)
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
        states.forEach((s, i) => {
          s.centerX += labelOffsets[i]
          s.radial = true
        })
      },
      onReverseComplete: () => {
        states.forEach((s, i) => {
          s.centerX -= labelOffsets[i]
          s.radial = false
        })
      },
    })

    // 2d. Flow letters into circle — staggered, one by one
    states.forEach((s, i) => {
      const cp = circlePositions.get(s.char)
      master.to(s, {
        centerX: cp.x,
        centerY: cp.y,
        rotation: cp.angle,
        opacity: 1,
        duration: 2.0,
        ease: 'power2.inOut',
      }, 'toCircle+=' + (i * 0.08))
    })

    // 2e. Fade in morse codes radially
    states.forEach((s, i) => {
      master.to(s, {
        morseOpacity: 1,
        duration: 0.8,
        ease: 'power2.out',
      }, 'showMorse+=' + (i * 0.03))
    })

    if (isScroll) {
      // 2f. Scroll-driven rotation: tween the angle directly
      master.to(spinRef.current, { angle: Math.PI * 2, duration: 2, ease: 'none' })
    } else {
      // 2f. Start slow continuous spin
      master.call(() => { spinRef.current.active = true })
    }

    // --- Phase 3: Morse Circle → Baudot Tape ---
    const { positions: baudotPositions } = computeBaudotPositions(w, h, finalScale)

    if (!isScroll) {
      // 3a. Let circle spin briefly, then decelerate
      master.to({}, { duration: 2.0 })
      master.to(spinRef.current, {
        speed: 0,
        duration: 1.5,
        ease: 'power2.out',
      })
    }

    // 3b. Fade out radial morse codes
    states.forEach((s, i) => {
      master.to(s, {
        morseOpacity: 0,
        duration: 0.5,
        ease: 'power2.in',
      }, 'fadeMorse3+=' + (i * 0.01))
    })

    // Phase label: MORSE → BAUDOT
    master.to(phaseLabelsRef.current.labels[0], { opacity: 0, morphT: 0, duration: 0.6, ease: 'power2.in' }, 'explode')
    master.to(phaseLabelsRef.current.labels[1], { opacity: 1, duration: 0.8, ease: 'power2.out' }, 'explode+=0.3')
    master.to(phaseLabelsRef.current.labels[1], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, 'explode+=1.8')

    // 3c. Explode to baudot rows
    states.forEach((s, i) => {
      const bp = baudotPositions.get(s.char)
      const cp = circlePositions.get(s.char)
      const prevLabelSide = s.labelSide
      const prevSlotWidth = s.slotWidth
      master.to(s, {
        centerX: bp.x,
        centerY: bp.y,
        rotation: 0,
        scale: finalScale,
        duration: 1.2,
        ease: 'back.out(1.2)',
        onStart: () => {
          s.baudot = true
          s.radial = false
          s.labelSide = bp.labelSide
          s.slotWidth = bp.slotWidth
        },
        onReverseComplete: () => {
          s.baudot = false
          s.radial = true
          s.labelSide = prevLabelSide
          s.slotWidth = prevSlotWidth
        },
      }, 'explode+=' + (i * 0.04))
    })

    // 3d. Fade in baudot bits
    states.forEach((s, i) => {
      master.to(s, {
        baudotOpacity: 1,
        duration: 0.6,
        ease: 'power2.out',
      }, 'baudotFade+=' + (i * 0.03))
    })

    // --- Phase 4: Baudot Grid → Concentric Rings ---
    const ringsLayout = computeRingsLayout(w, h, finalScale)
    // Store layout data on the ref so the draw loop can access it
    ringsRef.current._radii = ringsLayout.ringRadii
    ringsRef.current._dotRadius = ringsLayout.dotRadius
    ringsRef.current._baudotScale = finalScale

    // 4a. Fade out baudot labels
    states.forEach((s, i) => {
      master.to(s, {
        labelOpacity: 0,
        duration: 0.4,
        ease: 'power2.in',
      }, 'fadeLabels4+=' + (i * 0.01))
    })

    // 4b. Transition baudot dots → ring positions (smooth interpolation)
    states.forEach((s, i) => {
      master.to(s, {
        ringsT: 1,
        duration: 2.0,
        ease: 'expo.inOut',
        onStart: () => {
          // Capture each dot's current screen position in the baudot grid
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
            s.baudotDotScreenY[j] = s.centerY // localY = 0
          }
          s.ringAngle = ringsLayout.positions.get(s.char).angle
        },
        onReverseComplete: () => {
          s.ringsT = 0
        },
      }, 'toRings+=' + (i * 0.03))
    })

    // 4c. Start independent ring rotation
    if (isScroll) {
      for (let i = 0; i < 5; i++) {
        master.to(ringsRef.current.angles, {
          [i]: Math.PI * 2 * (1 + i * 0.2),
          duration: 3,
          ease: 'none',
        }, 'ringsRotate')
      }
    } else {
      master.call(() => { ringsRef.current.active = true })
    }

    // --- Phase 5: Concentric Rings → Braille Grid + I Ching Overlay ---
    const brailleLayout = computeBrailleGridLayout(w, h)
    brailleRef.current.gridLayout = brailleLayout

    // 5a. Stop ring rotation
    if (!isScroll) {
      master.to({}, { duration: 1.5 })
      ringsRef.current.speeds.forEach((_, i) => {
        master.to(ringsRef.current.speeds, {
          [i]: 0,
          duration: 1.0,
          ease: 'power2.out',
        }, 'stopRings')
      })
    }

    // Phase label: BAUDOT → BRAILLE
    master.to(phaseLabelsRef.current.labels[1], { opacity: 0, morphT: 0, duration: 0.6, ease: 'power2.in' }, 'toBraille')
    master.to(phaseLabelsRef.current.labels[2], { opacity: 1, duration: 0.8, ease: 'power2.out' }, 'toBraille+=0.5')
    master.to(phaseLabelsRef.current.labels[2], { morphT: 1, duration: 1.8, ease: 'power2.inOut' }, 'toBraille+=2.0')

    // 5b. Fly dots from rings to braille grid
    states.forEach((s, i) => {
      const bp = brailleLayout.positions.get(s.char)
      master.to(s, {
        brailleT: 1,
        duration: 2.5,
        ease: 'power3.inOut',
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

    // 5c. Morph: circle → square → circle (overlapping flight)
    states.forEach((s, i) => {
      const sub = gsap.timeline()
      sub.to(s, { morphRadius: 0, duration: 0.4, ease: 'power2.in' })
      sub.to(s, { duration: 1.5 })
      sub.to(s, { morphRadius: 1, duration: 0.5, ease: 'power2.out' })
      master.add(sub, 'toBraille+=' + (i * 0.04))
    })

    // 5d. Flash in 6th dot
    states.forEach((s, i) => {
      master.to(s, {
        dot6Flash: 1,
        duration: 0.3,
        ease: 'power2.out',
      }, 'flash6th+=' + (i * 0.02))
    })

    // 5e. Labels appear below cells
    states.forEach((s, i) => {
      master.to(s, {
        brailleLabelOpacity: 1,
        duration: 0.4,
      }, 'brailleLabels+=' + (i * 0.02))
    })

    // 5f. I Ching hexagrams fade in
    states.forEach((s, i) => {
      master.to(s, {
        iChingOpacity: 1,
        duration: 0.8,
      }, 'iching+=' + (i * 0.02))
    })

    // 5g. Activate breathing
    master.call(() => {
      brailleRef.current.active = true
    })

    // --- Phase 6: Braille Grid → ASCII Table via Bits Explosion ---
    const asciiLayout = computeAsciiTableLayout(w, h)
    particlesRef.current.asciiLayout = asciiLayout

    // Pre-set ASCII cell positions (stable, no call() needed later)
    states.forEach((s) => {
      const asciiPos = asciiLayout.positions.get(s.char)
      s.asciiCellX = asciiPos.x
      s.asciiCellY = asciiPos.y
    })

    // Pre-create particles at setup (stable random seeds across scroll scrubs)
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
          charIndex: ci, dotIndex: di,
          srcX, srcY,
          explodeX: srcX + Math.cos(angle) * dist,
          explodeY: srcY + Math.sin(angle) * dist,
          targetX: asciiPos.x,
          targetY: asciiPos.y - asciiLayout.columnHeight / 2 + di * asciiLayout.dotGap,
          chaosSeed: Math.random() * Math.PI * 2,
          radius: bl.dotRadius,
          targetRadius: asciiLayout.dotRadius,
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
        radius: bl.dotRadius * 0.5,
        targetRadius: asciiLayout.dotRadius,
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

    // 6a. Fade out I Ching + labels
    if (!isScroll) {
      master.to({}, { duration: 1.5 })
    }
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

    // 6b. Crossfade braille → particles + explosion
    states.forEach((s) => {
      master.to(s, { brailleOpacity: 0, duration: 0.5, ease: 'power2.in' }, 'explode6')
    })
    master.to(particlesRef.current, {
      globalOpacity: 1, duration: 0.5, ease: 'power2.out',
      onStart: () => { particlesRef.current.active = true },
      onReverseComplete: () => { particlesRef.current.active = false },
    }, 'explode6')
    master.to(particlesRef.current, { explosionT: 1, duration: 1.0, ease: 'power2.out' }, 'explode6')

    // 6c. Brief chaotic float
    master.to({}, { duration: 0.5 })

    // 6d. Regroup — float dampens while particles converge (simultaneous, no call() needed)
    master.to(particlesRef.current, { floatAmplitude: 0, duration: 0.8, ease: 'power2.out' }, 'regroup6')
    master.to(particlesRef.current, { reGroupT: 1, duration: 1.5, ease: 'power2.inOut' }, 'regroup6')

    // 6e. Smooth crossfade particles → ASCII columns
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

    // 6f. Labels + green flash
    states.forEach((s, i) => {
      master.to(s, {
        asciiLabelOpacity: 1,
        duration: 0.4,
      }, 'asciiLabels+=' + (i * 0.015))
    })

    // Green pulse on all 7th bits
    const flashProxy = { v: 0 }
    master.to(flashProxy, {
      v: 1,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => { states.forEach((s) => { s.dot7Flash = flashProxy.v }) },
    }, 'greenFlash')
    master.to(flashProxy, {
      v: 0,
      duration: 0.8,
      ease: 'power2.in',
      onUpdate: () => { states.forEach((s) => { s.dot7Flash = flashProxy.v }) },
    }, 'greenFlash+=0.6')

    // --- Phase 8: I Ching Hexagrams ---
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

    // 8a. Fade out ASCII labels
    if (!isScroll) { master.to({}, { duration: 1.5 }) }
    states.forEach((s, i) => {
      master.to(s, { asciiLabelOpacity: 0, duration: 0.4, ease: 'power2.in' }, 'fadeAsciiLabels+=' + (i * 0.01))
    })

    // 8b. Discard 7th bit
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

    // 8c. Dots to hexagram lines
    states.forEach((s, i) => {
      master.to(s, {
        ichingT: 1, duration: 1.5, ease: 'power2.inOut',
        onReverseComplete: () => { s.ichingT = 0 },
      }, 'toLines+=' + (i * 0.02))
    })

    // 8d. Fly to 8x8 grid
    master.to(ichingRef.current, { gridT: 1, duration: 2.0, ease: 'power3.inOut' }, 'toIChing')

    // 8e. Build extra hexagrams
    master.to(ichingRef.current, { extraOpacity: 1, duration: 1.0, ease: 'power2.out' }, 'fillGrid')
    master.to(ichingRef.current, { buildT: 1, duration: 1.5, ease: 'power2.out' }, 'fillGrid')

    // 8f. Breathe
    master.call(() => { ichingRef.current.breatheActive = true })
    if (!isScroll) { master.to({}, { duration: 2.0 }) }

    // Background color transitions
    if (mode !== 'parallax')
    BG_TRANSITIONS.forEach((t, i) => {
      const el = bgLayersRef.current[i]
      if (!el) return
      master.to(el, {
        clipPath: `circle(150% at ${t.origin})`,
        duration: 2.0,
        ease: 'power2.inOut',
      }, t.label)
    })

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

  }, { scope: mode !== 'auto' ? triggerRef : canvasRef })

  // 'i' key toggle: I Ching overlay
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

  // I Ching hover tooltip
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
