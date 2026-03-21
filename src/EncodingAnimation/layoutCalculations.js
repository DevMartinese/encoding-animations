import { MORSE_MAP, CHAR_SEQUENCE, DOT_RADIUS, DASH_WIDTH, DASH_HEIGHT, SYMBOL_GAP, LABEL_GAP, LABEL_FONT_SIZE } from './encodingData'

// Baselines (designed for ~1200px+ wide desktop)
const SYMBOL_SCALED_HEIGHT = 18
const ROW_HEIGHT = SYMBOL_SCALED_HEIGHT + 24
const COL_GAP = 120
const SECTION_GAP = 50
const LABEL_CHAR_WIDTH = LABEL_FONT_SIZE * 0.65

export function morseWidth(code) {
  let w = 0
  for (let i = 0; i < code.length; i++) {
    if (i > 0) w += SYMBOL_GAP
    w += code[i] === '.' ? DOT_RADIUS * 2 : DASH_WIDTH
  }
  return w
}

function slotWidth(maxMorseW) {
  return LABEL_CHAR_WIDTH + LABEL_GAP + maxMorseW
}

// Responsive gaps shared by table and baudot layouts
function responsiveGaps(canvasW, canvasH) {
  const colGap = Math.min(COL_GAP, Math.max(20, canvasW * 0.06))
  const sectionGap = Math.min(SECTION_GAP, Math.max(15, canvasH * 0.06))
  const rowHeight = Math.min(ROW_HEIGHT, (canvasH - sectionGap - 40) / 18)
  return { colGap, sectionGap, rowHeight }
}

export function computeCirclePositions(canvasW, canvasH, finalScale) {
  const cx = canvasW / 2
  const cy = canvasH / 2
  const minDim = Math.min(canvasW, canvasH)
  const maxCodeExtent = finalScale * (5 * DASH_WIDTH + 4 * SYMBOL_GAP + LABEL_FONT_SIZE / 2 + LABEL_GAP)
  // Floor the radius so it never goes negative on small screens
  const radius = Math.max(minDim * 0.2, minDim / 2 - maxCodeExtent - 30)
  const positions = new Map()

  CHAR_SEQUENCE.forEach((char, i) => {
    const angle = (i / CHAR_SEQUENCE.length) * Math.PI * 2
    positions.set(char, {
      x: cx + radius * Math.sin(angle),
      y: cy - radius * Math.cos(angle),
      angle,
    })
  })

  return { positions, radius }
}

export function computeTablePositions(canvasW, canvasH) {
  const letters = CHAR_SEQUENCE.slice(0, 26)
  const numbers = CHAR_SEQUENCE.slice(26)

  const leftLetters = letters.slice(0, 13)
  const rightLetters = letters.slice(13)
  const leftNumbers = numbers.slice(0, 5)
  const rightNumbers = numbers.slice(5)

  const maxMorseW = (chars) => Math.max(...chars.map(c => morseWidth(MORSE_MAP[c])))
  const maxMorseLeft = Math.max(maxMorseW(leftLetters), maxMorseW(leftNumbers))
  const maxMorseRight = Math.max(maxMorseW(rightLetters), maxMorseW(rightNumbers))

  const slotLeft = slotWidth(maxMorseLeft)
  const slotRight = slotWidth(maxMorseRight)

  // Responsive: adapt scale and gaps to fit screen
  const { colGap, sectionGap, rowHeight } = responsiveGaps(canvasW, canvasH)
  const desiredScale = SYMBOL_SCALED_HEIGHT / DASH_HEIGHT
  const maxScaleH = (canvasW - colGap - 20) / (slotLeft + slotRight)
  const maxScaleV = (rowHeight - 4) / DASH_HEIGHT
  const finalScale = Math.min(desiredScale, maxScaleH, maxScaleV)
  const fs = finalScale

  // Center based on labels: inner edges of both columns are symmetric around screen center
  const centerX = canvasW / 2
  const leftSlotCenterX = centerX - colGap / 2 - (slotLeft * fs) / 2
  const rightSlotCenterX = centerX + colGap / 2 + (slotRight * fs) / 2

  const letterRows = 13
  const numberRows = 5
  const totalHeight = letterRows * rowHeight + sectionGap + numberRows * rowHeight
  const startY = (canvasH - totalHeight) / 2

  const positions = new Map()

  function placeLeft(chars, rowOffset) {
    chars.forEach((ch, i) => {
      positions.set(ch, {
        x: leftSlotCenterX,
        y: rowOffset + i * rowHeight + rowHeight / 2,
        labelSide: 'right',
        slotWidth: slotLeft,
      })
    })
  }

  function placeRight(chars, rowOffset) {
    chars.forEach((ch, i) => {
      positions.set(ch, {
        x: rightSlotCenterX,
        y: rowOffset + i * rowHeight + rowHeight / 2,
        labelSide: 'left',
        slotWidth: slotRight,
      })
    })
  }

  const numberStartY = startY + letterRows * rowHeight + sectionGap

  placeLeft(leftLetters, startY)
  placeRight(rightLetters, startY)
  placeLeft(leftNumbers, numberStartY)
  placeRight(rightNumbers, numberStartY)

  return { positions, finalScale }
}

export function computeRingsLayout(canvasW, canvasH, scale) {
  const maxR = Math.min(canvasW, canvasH) / 2 - 30
  const minR = maxR * 0.45
  const ringRadii = []
  for (let i = 0; i < 5; i++) {
    // i=0 is outermost (bit 0), i=4 is innermost (bit 4)
    ringRadii.push(maxR - i * (maxR - minR) / 4)
  }
  const dotRadius = DOT_RADIUS * scale
  const positions = new Map()
  CHAR_SEQUENCE.forEach((char, i) => {
    const angle = (i / CHAR_SEQUENCE.length) * Math.PI * 2
    positions.set(char, { angle })
  })
  return { ringRadii, dotRadius, positions }
}

export function computeBrailleGridLayout(canvasW, canvasH) {
  // Full charset: 6 columns × 6 rows (36 cells for A-Z + 0-9)
  const cols = 6
  const rows = 6
  const cellW = canvasW / (cols + 2)
  const cellH = canvasH / (rows + 1.5)
  const gridLeft = (canvasW - cols * cellW) / 2
  const gridTop = (canvasH - rows * cellH) / 2

  // Dot sizing — compact cell, dots close together like real braille
  const dotRadius = Math.min(cellW, cellH) * 0.07
  const dx = dotRadius * 1.6
  const dy = dotRadius * 3

  const positions = new Map()
  CHAR_SEQUENCE.forEach((char, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.set(char, {
      x: gridLeft + col * cellW + cellW / 2,
      y: gridTop + row * cellH + cellH / 2,
      col,
      row,
    })
  })

  return { positions, cellW, cellH, dx, dy, dotRadius, labelOffsetY: dy + dotRadius + 14 }
}

export function computeAsciiTableLayout(canvasW, canvasH) {
  const cols = 9
  const rows = 4
  const dotRadius = Math.min(canvasW, canvasH) * 0.005
  const dotGap = dotRadius * 2.8
  const columnHeight = 6 * dotGap   // 7 dots -> 6 gaps

  const cellW = canvasW / (cols + 1.5)
  const cellH = canvasH / (rows + 0.8)
  const gridLeft = (canvasW - cols * cellW) / 2
  const gridTop = (canvasH - rows * cellH) / 2

  const positions = new Map()
  CHAR_SEQUENCE.forEach((char, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.set(char, {
      x: gridLeft + col * cellW + cellW / 2,
      y: gridTop + row * cellH + cellH / 2,
      col, row,
    })
  })

  const fontSize = Math.max(13, dotGap * 1.6)

  return { positions, cellW, cellH, dotRadius, dotGap, columnHeight, fontSize,
           labelOffsetX: dotRadius + fontSize * 0.8 }
}

export function computeBaudotPositions(canvasW, canvasH, scale) {
  const fs = scale
  const labelCharW = LABEL_FONT_SIZE * 0.6

  const letters = CHAR_SEQUENCE.slice(0, 26)
  const numbers = CHAR_SEQUENCE.slice(26)
  const leftLetters = letters.slice(0, 13)
  const rightLetters = letters.slice(13)
  const leftNumbers = numbers.slice(0, 5)
  const rightNumbers = numbers.slice(5)

  // Baudot: 5 dots per row, same DOT_RADIUS and SYMBOL_GAP as morse
  const bitsWidth = 5 * DOT_RADIUS * 2 + 4 * SYMBOL_GAP
  // Slot = label + gap + 5 bits
  const slotW = labelCharW + LABEL_GAP + bitsWidth

  const letterRows = 13
  const numberRows = 5

  // Responsive gaps matching table layout
  const { colGap, sectionGap, rowHeight } = responsiveGaps(canvasW, canvasH)

  const totalHeight = letterRows * rowHeight + sectionGap + numberRows * rowHeight
  const startY = (canvasH - totalHeight) / 2
  const centerX = canvasW / 2

  const leftSlotCenterX = centerX - colGap / 2 - (slotW * fs) / 2
  const rightSlotCenterX = centerX + colGap / 2 + (slotW * fs) / 2

  const positions = new Map()

  function placeCol(chars, x, rowOffset, side) {
    chars.forEach((ch, i) => {
      positions.set(ch, {
        x,
        y: rowOffset + i * rowHeight + rowHeight / 2,
        labelSide: side,
        slotWidth: slotW,
      })
    })
  }

  const numberStartY = startY + letterRows * rowHeight + sectionGap
  placeCol(leftLetters, leftSlotCenterX, startY, 'right')
  placeCol(rightLetters, rightSlotCenterX, startY, 'left')
  placeCol(leftNumbers, leftSlotCenterX, numberStartY, 'right')
  placeCol(rightNumbers, rightSlotCenterX, numberStartY, 'left')

  return { positions, slotWidth: slotW }
}

export function computeIChingGridLayout(canvasW, canvasH) {
  const cols = 8
  const rows = 8
  const cellW = canvasW / (cols + 2)
  const cellH = canvasH / (rows + 1.5)
  const gridLeft = (canvasW - cols * cellW) / 2
  const gridTop = (canvasH - rows * cellH) / 2
  const lineW = cellW * 0.55
  const lineH = Math.max(2, cellH * 0.04)
  const lineGap = cellH * 0.08
  const gapW = lineW * 0.22

  const positions = []
  for (let i = 0; i < 64; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.push({
      x: gridLeft + col * cellW + cellW / 2,
      y: gridTop + row * cellH + cellH / 2,
      col, row,
    })
  }

  return { positions, cellW, cellH, lineW, lineH, lineGap, gapW }
}
