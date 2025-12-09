import os
import json
import cv2
import io
import numpy as np
from dotenv import load_dotenv
from celery import Celery
import skimage.morphology as morphology
import sknw
import httpx

load_dotenv("../.env")

brokerHost = os.getenv("BROKERHOST")
brokerPort = os.getenv("BROKERPORT")
brokerDBWrite = os.getenv("BROKERDBWRITEPOSTPROCESS")
brokerDBRead = os.getenv("BROKERDBREADPOSTPROCESS")

app = Celery("model_prediction", 
        broker=f"redis://{brokerHost}:{brokerPort}/{brokerDBWrite}",
        backend=f"redis://{brokerHost}:{brokerPort}/{brokerDBRead}")


def pixel_to_gps(row, col, bbox, width, height):
    """
    Переводить пікселі в GPS координати.
    """
    west, south, east, north = bbox
    
    x_res = (east - west) / width
    y_res = (north - south) / height 
    
    # +0.5 для центру пікселя
    lon = west + (col + 0.5) * x_res
    lat = north - (row + 0.5) * abs(y_res) 
    
    return lon, lat

@app.task(name="postprocessing_worker.postprocess", ignore_result=False)
def postprocess(npy_mask_url, geojson_meta=False):
    if not geojson_meta:
        return json.dumps({"type": "FeatureCollection", "features": []})
    
    # 1. Завантаження
    try:
        with httpx.Client() as client:
            img_npy = client.get(npy_mask_url)
            img_npy = img_npy.content
    except:
        raise Exception("Cannot load mask from server")

    # 2. Метадані
    try:
        bbox = geojson_meta.get('bbox')
        if not bbox and 'properties' in geojson_meta:
             bbox = geojson_meta['properties'].get('bbox')
        
        meta_width, meta_height = geojson_meta['properties']['dimensions']
    except (KeyError, TypeError, AttributeError):
        return json.dumps({"type": "FeatureCollection", "features": []})

    # 3. Декодування
    try:
        buf = io.BytesIO(img_npy)
        mask_2d = np.load(buf)
        h, w = mask_2d.shape[:2]
        if w != meta_width or h != meta_height:
            meta_width, meta_height = w, h
    except Exception:
        return json.dumps({"type": "FeatureCollection", "features": []})

    if mask_2d.dtype != np.float32:
        mask_2d = mask_2d.astype(np.float32)

    # 4. Скелетонізація
    ret, binary_mask = cv2.threshold(mask_2d, 0.5, 1.0, cv2.THRESH_BINARY)
    vectorized_mask = morphology.skeletonize(binary_mask > 0)
    
    graph = sknw.build_sknw(vectorized_mask.astype(np.uint16), iso=False)

    raw_segments = []
    EPSILON = 2.0

    # 5. Обробка
    for (s, e, data) in graph.edges(data=True):
        pts = data['pts']

        if len(pts) < 2:
            continue
        
        curve = np.array(pts, dtype=np.float32).reshape(-1, 1, 2)
        simplified_curve = cv2.approxPolyDP(curve, epsilon=EPSILON, closed=False)

        line_coords = []
        for point in simplified_curve:
            row, col = point[0]
            
            lon, lat = pixel_to_gps(row, col, bbox, meta_width, meta_height)
            
            # --- КРИТИЧНЕ ВИПРАВЛЕННЯ ТУТ ---
            line_coords.append([float(lon), float(lat)]) 
        
        if len(line_coords) >= 2:
            raw_segments.append(line_coords)
            
    # 6. Формування JSON
    features = []
    for line in raw_segments:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": line
            },
            "properties": {
                "confidence": 1.0,
                "image_id": geojson_meta.get('_id', 'unknown'),
                "provider": geojson_meta.get('properties', {}).get('provider', 'unknown')
            }
        }
        features.append(feature)
            
    final_geojson = {
        "type": "FeatureCollection",
        "bbox": bbox,
        "crs": {
            "type": "name",
            "properties": {
                "name": geojson_meta.get('properties', {}).get('crs', 'EPSG:4326')
            }
        },
        "features": features
    }
    
    return json.dumps(final_geojson)