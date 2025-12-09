import os
import torch
import cv2
import numpy as np
from dotenv import load_dotenv
from torchvision.transforms import v2
import segmentation_models_pytorch as smp
from monai.inferers import SlidingWindowInferer
from celery import Celery
import PIL.Image as Image
import os
import base64
import io
import httpx
from dataLoader import s3_client

load_dotenv("../.env")

brokerHost = os.getenv("BROKERHOST")
brokerPort = os.getenv("BROKERPORT")
brokerDBWrite = os.getenv("BROKERDBWRITE")
brokerDBRead = os.getenv("BROKERDBREAD")
pathModel = os.getenv("PATHTOMODEL")
bucketName = os.getenv("BUCKET_NAME")

app = Celery("model_prediction", 
        broker=f"redis://{brokerHost}:{brokerPort}/{brokerDBWrite}",
        backend=f"redis://{brokerHost}:{brokerPort}/{brokerDBRead}")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = smp.DeepLabV3Plus(
    encoder_name="timm-mobilenetv3_large_100",
    encoder_weights="imagenet",
    in_channels=3,
    classes=1,
    activation="sigmoid"
)

inferer = SlidingWindowInferer(
    roi_size=(512,512),
    sw_batch_size=8,
    overlap=0.25,
    mode="gaussian",
    device=device
)

state_dict = torch.load(pathModel, map_location="cpu")
model.load_state_dict(state_dict)
model.to(device)
#model = torch.compile(model)

transform_gpu = v2.Compose([
    v2.ToDtype(torch.float32, scale=True),
    v2.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225))
])

def get_oam_image_array(img_url: str):
    headers = {"User-Agent": "Mozilla/5.0"}
    
    with httpx.Client(timeout=30.0) as client:
        resp_img = client.get(img_url, headers=headers)
        resp_img.raise_for_status()
        img_data = resp_img.content
    Image.MAX_IMAGE_PIXELS = None

    image = Image.open(io.BytesIO(img_data)).convert("RGB")
    return np.array(image)

@app.task(name="model_prediction.predict", ignore_result=False)
def predict(image_url: str, bbox: list):
    if image_url is None:
        return {"status": 404}
    try:
        img = get_oam_image_array(image_url)
    except Exception:
        raise Exception("Cannot download file")

    #scale = 0.5
    #img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    img_tensor = torch.from_numpy(img).permute(2, 0, 1)
    img_tensor = transform_gpu(img_tensor).unsqueeze(0).to(device)

    model.eval()
    with torch.no_grad():
        with torch.amp.autocast(device_type=device.type, dtype=torch.float16):
            res = inferer(inputs=img_tensor, network=model)

    res = res.squeeze().cpu().numpy()

    out_buf = io.BytesIO()
    data_size = out_buf.getbuffer().nbytes
    np.save(out_buf, res)
    out_buf.seek(0)
    
    bbox_str = "_".join(map(str, bbox)) 
    s3_key = f"masks/{bbox_str}.npy"

    try:
        s3_client.upload_fileobj(out_buf, bucketName, s3_key)
        print(f"Uploaded to: {s3_key}")
    except Exception as e:
        print(f"S3 Upload failed: {e}")
        raise Exception("Cannot download file to cloud")
    return s3_key