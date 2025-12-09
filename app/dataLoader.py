import boto3
import dotenv
import os

dotenv.load_dotenv("../.env")

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY_ID= os.getenv("AWS_SECRET_KEY_ID")
AWS_ENDPOINT_URL= os.getenv("AWS_ENDPOINT_URL")

s3_client = boto3.client(
    service_name='s3',
    endpoint_url=AWS_ENDPOINT_URL,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key= AWS_SECRET_KEY_ID,
    region_name='auto',
    config=boto3.session.Config(signature_version='s3v4')
)