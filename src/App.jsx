import { useControls } from 'leva'
import EncodingAnimation from './EncodingAnimation/EncodingAnimation'

function App() {
  const { mode, scrollDuration, skipMorseIntro, showPhaseLabels } = useControls({
    mode: { value: 'scroll', options: ['auto', 'scroll', 'parallax'] },
    scrollDuration: { value: 1.2, min: 0.2, max: 5, step: 0.1 },
    skipMorseIntro: true,
    showPhaseLabels: { value: true, label: 'Phase Labels' },
  })

  return <EncodingAnimation key={`${mode}-${skipMorseIntro}`} mode={mode} scrollDuration={scrollDuration} skipMorseIntro={skipMorseIntro} showPhaseLabels={showPhaseLabels} />
}

export default App
