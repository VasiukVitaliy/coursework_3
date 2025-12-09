import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import GiveCoordsForUpdate from './GiveCoordsForUpdate'
import TaskDashboard from './TaskBoard/TaskDashBoard'
import MapCanvas from './Map/MapCanvas'


function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <div className='w-full h-screen'>
        <Routes>
          <Route path="/" element={<TaskDashboard />} />
          <Route path="/addTask" element={<GiveCoordsForUpdate />} />
          <Route path="/editResult/:task_id" element={<MapCanvas />} />
        </Routes>
      </div>
</BrowserRouter>
  )
}

export default App
