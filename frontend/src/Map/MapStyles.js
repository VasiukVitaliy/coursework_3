export const simpleStyles = [
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