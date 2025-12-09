import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from "react-router-dom";
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import axios from 'axios';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// --- НАЛАШТУВАННЯ ВИГЛЯДУ ---
const simpleStyles = [
  // 1. Лінії (сині)
  {
    "id": "gl-draw-line",
    "type": "line",
    "filter": ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": {
      "line-color": "#4F46E5",
      "line-width": 4
    }
  },
  // 2. Статичні лінії (коли не редагуємо)
  {
    "id": "gl-draw-line-static",
    "type": "line",
    "filter": ["all", ["==", "$type", "LineString"], ["==", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": {
      "line-color": "#4F46E5",
      "line-width": 4
    }
  },
  // 3. АКТИВНА ТОЧКА (ЧЕРВОНА) - Ту, яку ми зараз видалимо
  {
      "id": "gl-draw-polygon-and-line-vertex-active",
      "type": "circle",
      "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["==", "active", "true"]],
      "paint": {
          "circle-radius": 8,
          "circle-color": "#ff0000", // ЧЕРВОНИЙ = ВИБРАНО
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff"
      }
  },
  // 4. НЕАКТИВНА ТОЧКА (Прихована, бо у нас є свій шар "тучок")
  {
      "id": "gl-draw-polygon-and-line-vertex-inactive",
      "type": "circle",
      "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "active", "true"]],
      "paint": { "circle-radius": 0 } // Ховаємо стандартні
  }
];

const MapCanvas = () => {
  const [activeTool, setActiveTool] = useState('edit');
  const [loading, setLoading] = useState(true);
  const { task_id } = useParams();
  
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);

  // --- Функція, яка малює "Тучки" поверх ліній ---
  const updatePointsLayer = useCallback(() => {
      if (!mapRef.current || !drawRef.current) return;

      const data = drawRef.current.getAll();
      const points = [];
      
      // Перетворюємо лінії в точки
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

      // Оновлюємо шар точок
      const source = mapRef.current.getSource('helper-points');
      if (source) {
          source.setData({ type: 'FeatureCollection', features: points });
      }
  }, []);

  // --- ГОЛОВНА ЛОГІКА КНОПОК ---
  const handleToolClick = (toolName) => {
    if (!drawRef.current) return;

    if (toolName === 'draw_line') {
      // 1. Почати малювати
      drawRef.current.changeMode('draw_line_string');
      setActiveTool('draw_line');
    } 
    else if (toolName === 'edit') {
      // 2. Просто вибирати / Стоп малювання
      const selected = drawRef.current.getSelectedIds();
      
      if (selected.length === 1) {
          // Якщо лінія вже вибрана -> показуємо її точки для редагування
          drawRef.current.changeMode('direct_select', { featureId: selected[0] });
      } else {
          // Якщо нічого не вибрано -> просто режим кліку
          drawRef.current.changeMode('simple_select');
      }
      setActiveTool('edit');
    } 
    else if (toolName === 'delete') {
      // 3. ВИДАЛЕННЯ (Найважливіше!)
      const selectedPoints = drawRef.current.getSelectedPoints();
      const selectedIds = drawRef.current.getSelectedIds();

      if (selectedPoints.features.length > 0) {
          // А) Якщо вибрана ТОЧКА (червона) -> видаляємо точку
          drawRef.current.trash();
      } else if (selectedIds.length > 0) {
          // Б) Якщо вибрана ЛІНІЯ (синя) -> питаємо, чи видаляти всю дорогу
          if (window.confirm("Видалити всю дорогу?")) {
              drawRef.current.trash();
          }
      } else {
          alert("Виберіть точку або лінію, щоб видалити.");
      }
      // Оновлюємо "тучки"
      updatePointsLayer();
    }
  };

  const handleSave = () => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
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
  };

  useEffect(() => {
    const init = async () => {
      if (mapRef.current) return;

      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:8000/maps/${task_id}`);
        const mapData = res.data;
        const bbox = mapData.bbox || [30.5, 50.4, 30.6, 50.5];
        const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];

        // Отримання фонового зображення
        let fetchedImgUrl = null;
        try {
            const oamRes = await axios.get(`https://api.openaerialmap.org/meta?bbox=${bbox.join(',')}`);
            if (oamRes.data.results?.length > 0) fetchedImgUrl = oamRes.data.results[0].properties.thumbnail;
        } catch (e) { console.warn("OAM Error", e); }

        const imageCoords = [[bbox[0], bbox[3]], [bbox[2], bbox[3]], [bbox[2], bbox[1]], [bbox[0], bbox[1]]];

        mapRef.current = new maplibregl.Map({
            container: mapContainerRef.current,
            center: center,
            zoom: 14,
            style: {
              version: 8,
              sources: {
                'osm-tiles': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
                ...(fetchedImgUrl ? { 'prediction-source': { type: 'image', url: fetchedImgUrl, coordinates: imageCoords } } : {}),
                'helper-points': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
              },
              layers: [
                { id: 'osm-layer', type: 'raster', source: 'osm-tiles' },
                ...(fetchedImgUrl ? [{ id: 'satellite-layer', type: 'raster', source: 'prediction-source', paint: { 'raster-opacity': 0.6 } }] : []),
                // Шар білих "тучок"
                {
                    id: 'helper-points-layer',
                    type: 'circle',
                    source: 'helper-points',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#ffffff', 
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#4F46E5' 
                    }
                }
              ]
            }
        });

        drawRef.current = new MapboxDraw({
            displayControlsDefault: false,
            styles: simpleStyles,
            clickBuffer: 10,
            defaultMode: 'simple_select'
        });
        mapRef.current.addControl(drawRef.current);

        mapRef.current.on('load', () => {
           setLoading(false);
           // Червоний квадрат bbox
           mapRef.current.addLayer({
               'id': 'bbox-debug', 'type': 'line',
               'source': {
                   'type': 'geojson',
                   'data': {
                       'type': 'Feature',
                       'geometry': {
                           'type': 'Polygon',
                           'coordinates': [[ [bbox[0], bbox[3]], [bbox[2], bbox[3]], [bbox[2], bbox[1]], [bbox[0], bbox[1]], [bbox[0], bbox[3]] ]]
                       }
                   }
               },
               'paint': { 'line-color': '#ff0000', 'line-width': 2 }
           });

           if (mapData && mapData.features) {
               drawRef.current.add(mapData);
               updatePointsLayer();
               mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 50, animate: false });
           }
        });
        mapRef.current.on('draw.create', updatePointsLayer);
        mapRef.current.on('draw.delete', updatePointsLayer);
        mapRef.current.on('draw.update', updatePointsLayer);

        mapRef.current.on('draw.selectionchange', (e) => {
            if (e.features.length === 0) setActiveTool('edit'); // Скидаємо інструмент, якщо зняли виділення
        });

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    init();

    return () => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
    };
  }, [task_id, updatePointsLayer]);

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-gray-100">
      <aside className="w-80 bg-white flex flex-col border-r border-gray-200 shadow-xl z-10">
        <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Road Editor</h2>
        </div>
        <div className="p-4 space-y-3">
            <button onClick={() => handleToolClick('draw_line')} className={`w-full py-3 px-4 rounded-lg border font-bold flex items-center gap-3 ${activeTool === 'draw_line' ? 'bg-blue-100 text-blue-700 border-blue-500' : 'bg-white'}`}>
                ✏️ Малювати
            </button>
            <button onClick={() => handleToolClick('edit')} className={`w-full py-3 px-4 rounded-lg border font-bold flex items-center gap-3 ${activeTool === 'edit' ? 'bg-blue-100 text-blue-700 border-blue-500' : 'bg-white'}`}>
                ✋ Вибір / Стоп
            </button>
            <button onClick={() => handleToolClick('delete')} className="w-full py-3 px-4 rounded-lg border font-bold flex items-center gap-3 bg-white text-red-600 border-red-200 hover:bg-red-50">
                🗑️ Видалити
            </button>
            
            <div className="mt-4 pt-4 border-t">
                <button onClick={handleSave} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">💾 Зберегти JSON</button>
            </div>
            
            <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                <b>Як видалити точку:</b><br/>
                1. Клікніть на лінію.<br/>
                2. Натисніть "✋ Вибір" (з'являться точки).<br/>
                3. Клікніть на точку (вона стане <span className="text-red-500 font-bold">червоною</span>).<br/>
                4. Натисніть "🗑️ Видалити".
            </div>
        </div>
      </aside>

      <main className="flex-1 relative bg-gray-200">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">Loading...</div>}
      </main>
    </div>
  );
};

export default MapCanvas;