import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import GiveCoordsForUpdate from './GiveCoordsForUpdate'


function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <div className='w-full h-screen'>
        <Routes>
          <Route path="/" element={<GiveCoordsForUpdate />} />
        </Routes>
      </div>
</BrowserRouter>
  )
}

export default App
