from fastapi import FastAPI, UploadFile, File, Response, status, HTTPException, Query, Body, Path
from typing import List
from typing_extensions import Annotated 
from dotenv import load_dotenv
from celery import Celery
import os
import io
from PIL import Image
import httpx
import base64
import cv2
import json
from db import engine
from sqlalchemy import text
import numpy as np
from dataLoader import s3_client
from fastapi.middleware.cors import CORSMiddleware

load_dotenv("../.env")

brokerHost = os.getenv("BROKERHOST")
brokerPort = os.getenv("BROKERPORT")
brokerDBWrite = os.getenv("BROKERDBWRITE")
brokerDBRead = os.getenv("BROKERDBREAD")
brokerBdWritePostprocess = os.getenv("BROKERDBWRITEPOSTPROCESS")
brokerBdReadPostprocess = os.getenv("BROKERDBREADPOSTPROCESS")

mapAPI = os.getenv("MAPAPI")

bucketName = os.getenv("BUCKET_NAME")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
celery_app = Celery("model_prediction", 
        broker=f"redis://{brokerHost}:{brokerPort}/{brokerDBWrite}",
        backend=f"redis://{brokerHost}:{brokerPort}/{brokerDBRead}")

celery_postprocess = Celery("model_prediction", 
        broker=f"redis://{brokerHost}:{brokerPort}/{brokerBdWritePostprocess}",
        backend=f"redis://{brokerHost}:{brokerPort}/{brokerBdReadPostprocess}")

celery_postprocess.conf.update(
    result_expires=3600 
)

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

@app.put("/status/{task_id}")
async def get_status_task(task_id: str, post: Annotated[bool, Query()] = False):
    worker = celery_app
    if post: worker = celery_postprocess
    task_res = worker.AsyncResult(task_id)

    if task_res.state == "SUCCESS":
        raw_result = task_res.result

        if post:
            query = text('''UPDATE jobs SET status 
                     = 'SUCCESS' WHERE task_id = :tid''')
        else:
            query = text('''UPDATE jobs SET status 
                     = 'SUCCESS', path = :pth WHERE task_id = :tid''')
        

        with engine.connect() as conn:
            conn.execute(query, {"pth": raw_result, "tid": task_id})
            conn.commit()

        return {"status": "SUCCESS"}

    elif task_res.state == "FAILURE":
        query = text("UPDATE jobs SET status = 'ERROR' WHERE task_id = :tid")

        with engine.connect() as conn:
            conn.execute(query, {"tid": task_id})
            conn.commit()

        return {"status": "FAILURE", "error": str(task_res.result)}

    else:
        return {"status": task_res.state}
    
@app.post("/predict-by-coord/")
async def predict_by_coord(bbox: List[float] = Query(...)):
    try:
        min_lon, min_lat, max_lon, max_lat = bbox
        async with httpx.AsyncClient() as client:
           url = f"https://api.openaerialmap.org/meta?bbox={min_lon},{min_lat},{max_lon},{max_lat}"
           resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Помилка при отриманні знімків з OpenAerialMap")
        resp.raise_for_status()
        data = resp.json()
        if not data.get("results"):
            raise HTTPException(status_code=404, detail="Немає знімків у цій області")

        bbox = data["results"][0]["geojson"]['bbox']
        props = data["results"][0]["properties"]
        img_url = props.get("thumbnail") or props.get("download")
        if not img_url:
            raise HTTPException(status_code=400, detail="Знімок не має доступної картинки")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    task = celery_app.send_task("model_prediction.predict", args=[img_url, bbox])
    query = text("""
        INSERT INTO jobs (task_id, status, bbox)
        VALUES (:task_id, :status, :bbox)
        RETURNING task_id, status, bbox;
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {
            "task_id": task.id,
            "status": "PENDING",
            "bbox": bbox
        })
        new_task = result.mappings().first()
        conn.commit()
        
    return new_task

@app.post("/vec-by-task/{task_id}")
async def vec_by_task(task_id: str):
    query = text("""
        SELECT task_id, status, bbox, path
        FROM jobs
        WHERE task_id = :task_id;
    """)

    with engine.connect() as conn:
        result = conn.execute(query, {"task_id": task_id}).mappings().first()
        conn.commit()
    if not result:
        raise HTTPException(404, "Task not found")

    if result.status != "SUCCESS":
        raise HTTPException(400, "Завдання ще не виконано або виникла помилка")
    
    bbox = result['bbox']
    
    #task_res = celery_app.AsyncResult(task_id)
    #if task_res.state != "SUCCESS":
       #raise HTTPException(400, "Завдання ще не виконано або виникла помилка")

    
    img_meta_url = f"https://api.openaerialmap.org/meta?bbox={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(img_meta_url)
        meta = resp.json()["results"][0]
        
    mask_url = s3_client.generate_presigned_url(
            "get_object",
            Params={                 
                "Bucket": bucketName, 
                "Key": result.path #path,
            },                       
        ExpiresIn=3600 
    )

    task_vec = celery_postprocess.send_task(
        "postprocessing_worker.postprocess",
        args=[mask_url, meta]
    )
    
    insert_job_query = text("""
        INSERT INTO public.jobs 
        (task_id, status) 
        VALUES (:child_id, 'PENDING')
        RETURNING task_id, status 
    """)

    insert_rel_query = text("""
        INSERT INTO task_relationships 
        (parent_task_id, child_task_id) 
        VALUES (:parent_id, :child_id)
    """)

    with engine.connect() as conn:
        updated = conn.execute(insert_job_query, {
            "child_id": task_vec.id, 
        }).mappings().first()
        
        conn.execute(insert_rel_query, {
            "parent_id": task_id,
            "child_id": task_vec.id
        })
        conn.commit()
        
    #task_res.forget()

    return updated

# @app.post("load-map-db")
# async def load_map(data = Body(...)):
#     try:
#         task_id = data.get("task_id")
#         task_id_vec = data.get("task_id_vec")
#         geojson = data.get("geojson")
        
#         query = text("""
#             INSERT INTO maps (task_id, geojson)
#             VALUES (:task_id, :geojson)
#             RETURNING map_id, task_id;
#         """)
        
#         with engine.connect() as conn:
#             updated = conn.execute(query, {"tid": task_id}).mappings().first()
#         conn.commit()
        
#         task_id_vec.forget()
        
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


@app.get("/tasks/")
async def get_tasks():
    query = text("""
                SELECT 
                parent.task_id, 
                parent.status, 
                parent.created_at,
                child.task_id AS child_id,
                child.status AS child_status,
                child.created_at AS child_created_at
                FROM jobs parent
                LEFT JOIN task_relationships tr ON parent.task_id = tr.parent_task_id
                LEFT JOIN jobs child ON tr.child_task_id = child.task_id
                WHERE parent.task_id NOT IN (SELECT child_task_id FROM task_relationships)
                ORDER BY parent.created_at DESC;
    """)
    with engine.connect() as conn:
        results = conn.execute(query).mappings().all()
        
    return results

@app.get("/maps/{task_id}")
async def get_map_by_task(task_id: str):
    task_res = celery_postprocess.AsyncResult(task_id)
    
    if task_res.state != "SUCCESS":
        raise HTTPException(400, "Завдання ще не виконано або виникла помилка")
    raw_result = task_res.result
    return json.loads(raw_result)