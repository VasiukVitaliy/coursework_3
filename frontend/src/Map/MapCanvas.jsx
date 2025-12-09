import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from "react-router-dom";
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import axios from 'axios';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import MapControls from './MapControls';
import MapLibreMap from './MapLibreMap';
import { simpleStyles } from './MapStyles';

const MapCanvas = () => {
    const [activeTool, setActiveTool] = useState('edit');
    const [loading, setLoading] = useState(true);
    const { task_id } = useParams();
    
    const mapContainerRef = useRef(null);
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

                let fetchedImgUrl = null;
                try {
                    const oamRes = await axios.get(`/oam-api/meta?bbox=${bbox.join(',')}`);
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
                            ...(fetchedImgUrl ? [{ id: 'satellite-layer', type: 'raster', source: 'prediction-source', paint: { 'raster-opacity': 0.7 } }] : []),
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
                    if (e.features.length === 0) setActiveTool('edit');
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
            <MapControls 
                activeTool={activeTool} 
                onToolClick={handleToolClick} 
                onSave={handleSave} 
            />
            <MapLibreMap 
                ref={mapContainerRef} 
                loading={loading} 
            />
        </div>
    );
};

export default MapCanvas;