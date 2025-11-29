import os
import torch
import cv2
import numpy as np
from dotenv import load_dotenv
from torchvision.transforms import v2
import segmentation_models_pytorch as smp
from monai.inferers import SlidingWindowInferer
from celery import Celery
import os
import base64

load_dotenv("../.env")

brokerHost = os.getenv("BROKERHOST")
brokerPort = os.getenv("BROKERPORT")
brokerDBWrite = os.getenv("BROKERDBWRITE")
brokerDBRead = os.getenv("BROKERDBREAD")
pathModel = os.getenv("PATHTOMODEL")

app = Celery("model_prediction", 
        broker=f"redis://{brokerHost}:{brokerPort}/{brokerDBWrite}",
        backend=f"redis://{brokerHost}:{brokerPort}/{brokerDBRead}")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = smp.DeepLabV3Plus(
    encoder_name="timm-mobilenetv3_large_100",
    encoder_weights="imagenet",
    in_channels=3,
    classes=1,
)

inferer = SlidingWindowInferer(
    roi_size=(512,512),
    sw_batch_size=4,
    overlap=0.5,
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

@app.task(name="model_prediction.predict", ignore_result=False)
def predict(image):
    if image is None:
        return {"status": 404}
    
    img = np.frombuffer(image, np.uint8)
    img = cv2.imdecode(img, cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = torch.from_numpy(img).permute(2,0,1)
    img = transform_gpu(img).unsqueeze(0).to(device)

    model.eval()
    with torch.no_grad():
        with torch.amp.autocast(device_type=device.type, dtype=torch.float16):
            res = inferer(inputs= img, network = model)
    res = res.squeeze().cpu().numpy()
    res_bytes = res.tobytes()
    return res_bytes