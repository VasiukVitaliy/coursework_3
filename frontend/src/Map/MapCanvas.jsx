import React, { useState, useRef, useCallback } from 'react';
import { useParams } from "react-router-dom";
import axios from 'axios';
import MapControls from './MapControls'; 
import MapLibreMap from './MapLibreMap';

const SERVER_URL = import.meta.env.VITE_BACKEND;

const MapCanvas = () => {
  const [activeTool, setActiveTool] = useState('edit');
  const [loading, setLoading] = useState(true);
  const [bbox, setBbox] = useState(null); 
  const { task_id } = useParams();
  
  const mapRef = useRef(null);
  const drawRef = useRef(null);

  const updatePointsLayer = useCallback(() => {
      if (!mapRef.current || !drawRef.current) return;

      const data = drawRef.current.getAll();
      const points = [];
      
      data.features.forEach(feature => {
          if (feature.geometry.type === 'LineString') {
              feature.geometry.coordinates.forEach(coord => {
                  points.push({
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: coord },
                      properties: {}
                  });
              });
          }
      });

      const source = mapRef.current.getSource('helper-points');
      if (source) {
          source.setData({ type: 'FeatureCollection', features: points });
      }
  }, []);

  const handleToolClick = (toolName) => {
    if (!drawRef.current) return;

    if (toolName === 'draw_line') {
      drawRef.current.changeMode('draw_line_string');
      setActiveTool('draw_line');
    } 
    else if (toolName === 'edit') {
      const selected = drawRef.current.getSelectedIds();
      if (selected.length === 1) {
          drawRef.current.changeMode('direct_select', { featureId: selected[0] });
      } else {
          drawRef.current.changeMode('simple_select');
      }
      setActiveTool('edit');
    } 
    else if (toolName === 'delete') {
      const selectedPoints = drawRef.current.getSelectedPoints();
      const selectedIds = drawRef.current.getSelectedIds();

      if (selectedPoints.features.length > 0) {
          drawRef.current.trash();
      } else if (selectedIds.length > 0) {
          if (window.confirm("Видалити всю дорогу?")) {
              drawRef.current.trash();
          }
      } else {
          alert("Виберіть точку або лінію, щоб видалити.");
      }
      updatePointsLayer();
    }
  };

  const handleSave = async () => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    if (bbox) {
        data["bbox"] = bbox;
    }
    
    try {
        await axios.post(`${SERVER_URL}/load-map-db/${task_id}`, data);
        
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `roads_${task_id}.json`; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log("Saved successfully");
    } catch (e) {
        console.error("Save error", e);
        alert("Помилка при збереженні");
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-gray-100">
      
      <MapControls 
        activeTool={activeTool}
        onToolClick={handleToolClick}
        onSave={handleSave}
      />

      <main className="flex-1 relative bg-gray-200">
        <MapLibreMap 
            taskId={task_id}
            mapRef={mapRef}
            drawRef={drawRef}
            setLoading={setLoading}
            updatePointsLayer={updatePointsLayer}
            setActiveTool={setActiveTool}
            // 3. Передаємо сеттер вниз
            setBbox={setBbox} 
        />
        
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
                Loading...
            </div>
        )}
      </main>
    </div>
  );
};

export default MapCanvas;