import { DOT_RADIUS, DASH_WIDTH, DASH_HEIGHT, SYMBOL_GAP, LABEL_GAP, LABEL_FONT_SIZE, KING_WEN_SEQUENCE } from './encodingData'
import { morseWidth } from './layoutCalculations'

export const LABEL_CHAR_W = LABEL_FONT_SIZE * 0.65

// Dot offsets relative to cell center for braille 2x3 grid
// dot0: (-dx, -dy)  dot3: (+dx, -dy)
// dot1: (-dx,   0)  dot4: (+dx,   0)
// dot2: (-dx, +dy)  dot5: (+dx, +dy)
export const BRAILLE_DOT_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [1, -1], [1, 0], [1, 1],
]

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

// Draw a group centered at origin.
// labelSide: 'left' = [label][gap][morse], 'right' = [morse][gap][label]
// slotWidth: fixed width so all items in a column align morse codes
export function drawGroup(ctx, s, code, morseProgress) {
  const visibleSymbols = Math.ceil(morseProgress)
  const fractional = morseProgress - Math.floor(morseProgress)
  const sw = s.slotWidth
  const halfSlot = sw / 2

  let morseStartX, labelCenterX

  if (s.labelSide === 'right') {
    labelCenterX = halfSlot - LABEL_CHAR_W / 2
    const mw = morseWidth(code)
    morseStartX = halfSlot - LABEL_CHAR_W - LABEL_GAP - mw
  } else {
    labelCenterX = -halfSlot + LABEL_CHAR_W / 2
    morseStartX = -halfSlot + LABEL_CHAR_W + LABEL_GAP
  }

  if (s.glowAmount > 0) {
    ctx.shadowBlur = 15 * s.glowAmount
    ctx.shadowColor = 'white'
  }

  let drawX = morseStartX
  for (let i = 0; i < visibleSymbols; i++) {
    const sym = code[i]
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
export function drawRadialGroup(ctx, s, code) {
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
export function drawBaudotGroup(ctx, s, baudotCode) {
  const sw = s.slotWidth
  const halfSlot = sw / 2
  const bitsWidth = 5 * DOT_RADIUS * 2 + 4 * SYMBOL_GAP

  let bitsStartX, labelCenterX

  if (s.labelSide === 'right') {
    labelCenterX = halfSlot - LABEL_CHAR_W / 2
    bitsStartX = halfSlot - LABEL_CHAR_W - LABEL_GAP - bitsWidth
  } else {
    labelCenterX = -halfSlot + LABEL_CHAR_W / 2
    bitsStartX = -halfSlot + LABEL_CHAR_W + LABEL_GAP
  }

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
export function drawRingsTransition(ctx, s, baudotCode, ringRadii, ringAngles, dotRadius, screenCX, screenCY, baudotDotScale) {
  const t = s.ringsT
  for (let i = 0; i < 5; i++) {
    const bit = baudotCode[i]
    const bitAlpha = bit === '1' ? 1 : 0.15 * (1 - t)
    if (bitAlpha <= 0.001) continue

    ctx.globalAlpha = s.opacity * bitAlpha
    ctx.fillStyle = 'white'

    const bx0 = s.baudotDotScreenX[i]
    const by0 = s.baudotDotScreenY[i]

    const bx1 = screenCX + ringRadii[i] * Math.sin(s.ringAngle + ringAngles[i])
    const by1 = screenCY - ringRadii[i] * Math.cos(s.ringAngle + ringAngles[i])

    const x = bx0 + (bx1 - bx0) * t
    const y = by0 + (by1 - by0) * t

    const r0 = DOT_RADIUS * baudotDotScale
    const r1 = dotRadius
    const r = r0 + (r1 - r0) * t

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawRingsToBrailleTransition(ctx, s, baudotCode, brailleCode, layout, ringsRef) {
  const t = s.brailleT
  const { dx, dy, dotRadius: targetDotR } = layout
  const srcDotR = ringsRef._dotRadius || targetDotR

  for (let i = 0; i < 5; i++) {
    const baudotBit = baudotCode[i]
    const brailleBit = brailleCode[i]
    const baudotAlpha = baudotBit === '1' ? 1 : 0.12
    const brailleAlpha = brailleBit === '1' ? 1 : 0.12
    const alpha = baudotAlpha + (brailleAlpha - baudotAlpha) * t

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

export function drawBrailleCell(ctx, s, brailleCode, layout, breatheScale) {
  const { dx, dy, dotRadius, labelOffsetY } = layout

  ctx.save()
  ctx.translate(s.brailleCellX, s.brailleCellY)
  ctx.scale(breatheScale, breatheScale)

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

export function drawAsciiParticles(ctx, pRef) {
  const { explosionT, reGroupT, floatAmplitude, particles, globalOpacity } = pRef
  const now = performance.now() * 0.001
  const alpha = globalOpacity != null ? globalOpacity : 1
  if (alpha <= 0) return

  for (const p of particles) {
    let x, y, r
    r = p.radius + (p.targetRadius - p.radius) * clamp01(reGroupT)

    const opacity = p.srcOpacity + (p.targetOpacity - p.srcOpacity) * clamp01(reGroupT * 3)
    if (opacity <= 0) continue

    const floatOffX = Math.sin(now * 1.3 + p.chaosSeed) * floatAmplitude * 30
    const floatOffY = Math.cos(now * 0.9 + p.chaosSeed * 1.7) * floatAmplitude * 30

    if (reGroupT > 0) {
      const floatX = p.explodeX + floatOffX
      const floatY = p.explodeY + floatOffY
      const delay = (p.charIndex * 7 + p.dotIndex) / (36 * 7) * 0.15
      const localT = clamp01((reGroupT - delay) / (1 - delay))
      const ease = localT * localT * (3 - 2 * localT)
      x = floatX + (p.targetX - floatX) * ease
      y = floatY + (p.targetY - floatY) * ease
    } else if (explosionT >= 1) {
      x = p.explodeX + floatOffX
      y = p.explodeY + floatOffY
    } else {
      const ease = 1 - Math.pow(1 - explosionT, 3)
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

export function drawAsciiColumn(ctx, s, asciiCode, layout) {
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

export function drawIChingOverlay(ctx, s, brailleCode, layout) {
  const { dx, dy } = layout
  const lineW = dx * 3
  const lineH = dy * 0.3
  const gapW = lineW * 0.2

  ctx.save()
  ctx.translate(s.brailleCellX, s.brailleCellY)
  ctx.globalAlpha = s.iChingOpacity * 0.6 * s.opacity

  for (let i = 0; i < 6; i++) {
    const bit = brailleCode[i]
    const yOff = (2.5 - i) * (lineH + dy * 0.5)

    ctx.fillStyle = 'white'
    if (bit === '1') {
      ctx.fillRect(-lineW / 2, yOff - lineH / 2, lineW, lineH)
    } else {
      ctx.fillRect(-lineW / 2, yOff - lineH / 2, (lineW - gapW) / 2, lineH)
      ctx.fillRect(gapW / 2, yOff - lineH / 2, (lineW - gapW) / 2, lineH)
    }
  }

  ctx.restore()
}

export function drawHexagram(ctx, x, y, lines, layout, opacity, buildT) {
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

export function drawAsciiToIChing(ctx, s, asciiCode, hexLines, asciiLayout, ichingLayout) {
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

export function drawIChingGrid(ctx, iching, states) {
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

export function drawIChingTooltip(ctx, tip) {
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

export function drawPhaseLabel(ctx, phaseLabels, screenW, screenH) {
  if (!phaseLabels.enabled) return
  const fontSize = screenW > 768 ? 20 : 13
  const spacing = screenW > 768 ? 5 : 3.5
  const x = 28, y = screenH - 24
  for (const label of phaseLabels.labels) {
    if (label.opacity <= 0) continue
    ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'

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
