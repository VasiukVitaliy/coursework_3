from fastapi import FastAPI, UploadFile, File, Response, status, HTTPException, Query
from typing import List
from typing_extensions import Annotated 
from dotenv import load_dotenv
from celery import Celery
import os
import io
from PIL import Image
import httpx
import base64

load_dotenv("../.env")

brokerHost = os.getenv("BROKERHOST")
brokerPort = os.getenv("BROKERPORT")
brokerDBWrite = os.getenv("BROKERDBWRITE")
brokerDBRead = os.getenv("BROKERDBREAD")
mapAPI = os.getenv("MAPAPI")

app = FastAPI()
celery_app = Celery("model_prediction", 
        broker=f"redis://{brokerHost}:{brokerPort}/{brokerDBWrite}",
        backend=f"redis://{brokerHost}:{brokerPort}/{brokerDBRead}")

@app.post("/predict")
async def send_predict(
    img: UploadFile = File(...), 
    response: Response = None
):
    print("start")
    try:
        if img is None:
            return Response(
                content='{"error": "No image provided"}',
                media_type="application/json",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        print("before decoding")
        content = await img.read()

        print("before predicting")
        task = celery_app.send_task("model_prediction.predict", args=[content])
        print("end")
        return {"status": "success", "task_id": task.id}

    except Exception as e:
        return Response(
            content=f'{{"error": "{str(e)}"}}',
            media_type="application/json",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@app.get("/status/{task_id}")
async def get_status_task(task_id: str):
    task_res = celery_app.AsyncResult(f"{task_id}")
    if task_res.state == "SUCCESS":
        result = task_res.result
        task_res.forget()
        result = base64.b64encode(result).decode('utf-8')
        return {"status": "SUCCESSFUL", "result": result}
    elif task_res.state == "FAILURE":
        result = str(task_res.result)
        task_res.forget()
        return {"status": "failed", "error": str(task_res.result)}
    else: return {"status": task_res.state}

async def get_oam_image_buffer(minLat: float, maxLat: float, minLon: float, maxLon: float):
    url = f"https://api.openaerialmap.org/meta?bbox={minLon},{minLat},{maxLon},{maxLat}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    if not data.get("results"):
        raise HTTPException(status_code=404, detail="Немає знімків у цій області")

    props = data["results"][0]["properties"]
    img_url = props.get("thumbnail") or props.get("download")
    if not img_url:
        raise HTTPException(status_code=400, detail="Знімок не має доступної картинки")

    async with httpx.AsyncClient() as client:
        resp_img = await client.get(img_url)
        resp_img.raise_for_status()
        img_data = resp_img.content

    image = Image.open(io.BytesIO(img_data)).convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    buf.seek(0)
    
    print("exit load func")

    return buf, data

    
@app.get("/predict-by-coord/")
async def predict_by_coord(bbox: List[float] = Query(...)):
    try:
        minLat, maxLat, minLon, maxLon = bbox
        image, data = await get_oam_image_buffer(minLat, maxLat, minLon, maxLon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    image = image.getvalue()
    task = celery_app.send_task("model_prediction.predict", args=[image])
    
    handfix = {
        "mask_task_id": task.id,
        "properties": data["results"][0]["properties"]
    }

    return handfix
    

    # for item in model_output:
    #     point_feature = {
    #         "type": "Feature",
    #         "geometry": {
    #             "type": "Point",
    #             "coordinates": [minLat, maxLat,minLon,maxLon]
    #         },
    #         "properties": item
    #     }
    #     geojson["features"].append(point_feature)
    #     geojson["properties"].append(data["result"][0]["properties"])

    # return geojson