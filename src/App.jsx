import { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ExplorationsGrid from './ExplorationsGrid'
import { explorations } from './explorations'

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<ExplorationsGrid />} />
          {explorations.map((exp) => (
            <Route key={exp.id} path={`/${exp.id}`} element={<exp.component />} />
          ))}
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
