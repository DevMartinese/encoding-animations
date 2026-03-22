import { lazy } from 'react'
import EncodingPreview from './EncodingAnimation/EncodingPreview'
import MorsePatternsPreview from './MorsePatterns/MorsePatternsPreview'
import MorseHeroPreview from './MorseHero/MorseHeroPreview'

const EncodingPage = lazy(() => import('./EncodingAnimation/EncodingPage'))
const MorsePatternsPage = lazy(() => import('./MorsePatterns/MorsePatternsPage'))
const MorseHeroPage = lazy(() => import('./MorseHero/MorseHeroPage'))

export const explorations = [
  {
    id: 'encoding-animation',
    title: 'Encoding Animation',
    description: 'Morse → Baudot → Braille → ASCII → I Ching. A visual journey through character encoding systems.',
    color: '#a67cf7',
    component: EncodingPage,
    Preview: EncodingPreview,
  },
  {
    id: 'morse-patterns',
    title: 'Morse Patterns',
    description: 'Geometric arrangements of morse code. Radial bursts, spirals, waves, and constellations.',
    color: '#38d0f2',
    component: MorsePatternsPage,
    Preview: MorsePatternsPreview,
  },
  {
    id: 'morse-hero',
    title: 'Morse Hero',
    description: 'A hero section built from morse code. Circle and table patterns animate into an ambient background.',
    color: '#6cd868',
    component: MorseHeroPage,
    Preview: MorseHeroPreview,
  },
]
