import axios from 'axios'
import { useState } from 'react'


export default function GiveCoordsForUpdate() {
  const [minLat, setMinLat] = useState('')
  const [maxLat, setMaxLat] = useState('')
  const [minLon, setMinLon] = useState('')
  const [maxLon, setMaxLon] = useState('')

  const SERVER_URL = import.meta.env.REACT_APP_SERVER_URL;

  const names = [
    ["Верхня широта", setMaxLat],
    ["Нижня широта", setMinLat],
    ["Ліва довгота", setMinLon],
    ["Права довгота", setMaxLon]
  ]

    const sendCoords = async () => {
        const response = await axios.get(
            `${SERVER_URL}/predict-by-coord/
            ?bbox=${minLat}bbox=${maxLat}bbox=${minLon}bbox=${maxLon}`)
        
    }

  return (
    <div className="flex justify-center items-center h-full">
    <div className="flex flex-col justify-center items-center p-6 bg-white rounded-2xl shadow-xl max-h-[60%]">
      <h2 className="text-black text-2xl font-semibold mb-6">Введіть координати для оновлення</h2>
      {names.map(([name, setState]) => (
        <div 
          className="flex flex-col md:flex-row items-center w-full max-w-md mb-4" 
          key={name}
        >
          <label className="text-black font-medium md:w-1/3 mb-1 md:mb-0">{name}:</label>
          <input
            type="text"
            className="w-full md:w-2/3 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-sm"
            onChange={(e) => setState(e.target.value)}
            pattern="^-?\d+(\.\d+)?$"
            placeholder="Наприклад 50.4481"
          />
        </div>
      ))}
        <button onClick={()=>sendCoords()}> Надіслати </button>
    </div>
    </div>
  )
}
