import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import axios from 'axios';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const SERVER_URL = import.meta.env.VITE_API_URL;


const simpleStyles = [

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
  {
      "id": "gl-draw-polygon-and-line-vertex-active",
      "type": "circle",
      "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["==", "active", "true"]],
      "paint": {
          "circle-radius": 8,
          "circle-color": "#ff0000", 
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff"
      }
  },
  {
      "id": "gl-draw-polygon-and-line-vertex-inactive",
      "type": "circle",
      "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "active", "true"]],
      "paint": { "circle-radius": 0 } 
  }
];

const MapLibreMap = ({ 
    taskId, 
    mapRef, 
    drawRef, 
    setLoading, 
    updatePointsLayer, 
    setActiveTool,
    setBbox 
}) => {
    const mapContainerRef = useRef(null);

    useEffect(() => {
        const initMap = async () => {
            if (mapRef.current) return;

            try {
                setLoading(true);
                const res = await axios.get(`${SERVER_URL}/maps/${taskId}`);
                const mapData = res.data;
                const bbox = mapData.bbox;
                if (setBbox) {
                    setBbox(bbox);
                }

                const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];

                let fetchedImgUrl = null;
                try {
                    const oamRes = await axios.get(`https://api.openaerialmap.org/meta?bbox=${bbox.join(',')}`);
                    if (oamRes.data.results?.length > 0) {
                        fetchedImgUrl = oamRes.data.results[0].properties.thumbnail;
                    }
                } catch (e) { 
                    console.warn("OAM Error (Satellite image not found)", e); 
                }

                const imageCoords = [[bbox[0], bbox[3]], [bbox[2], bbox[3]], [bbox[2], bbox[1]], [bbox[0], bbox[1]]];

                mapRef.current = new maplibregl.Map({
                    container: mapContainerRef.current,
                    center: center,
                    zoom: 14,
                    style: {
                        version: 8,
                        sources: {

                            'osm-tiles': { 
                                type: 'raster', 
                                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], 
                                tileSize: 256 
                            },
                            ...(fetchedImgUrl ? { 
                                'prediction-source': { 
                                    type: 'image', 
                                    url: fetchedImgUrl, 
                                    coordinates: imageCoords 
                                } 
                            } : {}),
                            'helper-points': { 
                                type: 'geojson', 
                                data: { type: 'FeatureCollection', features: [] } 
                            }
                        },
                        layers: [
                            { id: 'osm-layer', type: 'raster', source: 'osm-tiles' },
                            ...(fetchedImgUrl ? [{ 
                                id: 'satellite-layer', 
                                type: 'raster', 
                                source: 'prediction-source', 
                                paint: { 'raster-opacity': 0.6 } 
                            }] : []),
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
                    mapRef.current.addLayer({
                        'id': 'bbox-debug', 
                        'type': 'line',
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
                        mapRef.current.fitBounds(
                            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]], 
                            { padding: 50, animate: false }
                        );
                    }
                });
                mapRef.current.on('draw.create', updatePointsLayer);
                mapRef.current.on('draw.delete', updatePointsLayer);
                mapRef.current.on('draw.update', updatePointsLayer);
                mapRef.current.on('draw.selectionchange', (e) => {
                    if (e.features.length === 0) {
                        setActiveTool('edit');
                    }
                });

            } catch (err) {
                console.error("Map Initialization Error:", err);
                setLoading(false);
            }
        };

        initMap();
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [taskId, mapRef, drawRef, setLoading, updatePointsLayer, setActiveTool, setBbox]);

    return (
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
    );
};

export default MapLibreMap;