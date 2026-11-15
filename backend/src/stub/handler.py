"""POST /stub/upload-url and POST /stub/extract (Textract Queries)."""
import os
import re
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation

from common import config
from common.api import BadRequest, body_of, route
from shifts.handler import _device

QUERIES = [
    ("hourlyRate", "What is the hourly rate?", "money"),
    ("regularHoursPaid", "How many regular hours were paid?", "hours"),
    ("overtimeHoursPaid", "How many overtime hours were paid?", "hours"),
    ("grossPay", "What is the gross pay?", "money"),
    ("payPeriodStart", "What is the pay period start date?", "date"),
    ("payPeriodEnd", "What is the pay period end date?", "date"),
]
CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png"}
KEY_RE = re.compile(r"^stubs/[0-9a-f-]{36}/[0-9a-f]{32}\.(jpg|png)$")
DATE_FORMATS = ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y", "%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y")

LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", ".local", "uploads")


def normalize(kind, text):
    """Turn Textract's raw answer into the string the form field expects."""
    if not text:
        return None
    text = text.strip()
    if kind == "date":
        cleaned = re.sub(r"\s+", " ", text.replace(".", ""))
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(cleaned, fmt).date().isoformat()
            except ValueError:
                continue
        return None
    match = re.search(r"-?\d[\d,]*\.?\d*", text)
    if not match:
        return None
    try:
        return format(Decimal(match.group().replace(",", "")).quantize(Decimal("0.01")), "f")
    except InvalidOperation:
        return None


def parse_textract(response):
    """Map QUERY blocks to their QUERY_RESULT answers."""
    blocks = {b["Id"]: b for b in response.get("Blocks", [])}
    kinds = {alias: kind for alias, _, kind in QUERIES}
    fields = {alias: {"value": None, "confidence": 0, "raw": None} for alias in kinds}
    for block in blocks.values():
        if block.get("BlockType") != "QUERY":
            continue
        alias = block.get("Query", {}).get("Alias")
        if alias not in fields:
            continue
        for rel in block.get("Relationships", []):
            if rel.get("Type") != "ANSWER":
                continue
            for answer_id in rel.get("Ids", []):
                answer = blocks.get(answer_id, {})
                if answer.get("Confidence", 0) >= fields[alias]["confidence"]:
                    value = normalize(kinds[alias], answer.get("Text"))
                    fields[alias] = {
                        "value": value,
                        "confidence": round(answer.get("Confidence", 0), 1) if value else 0,
                        "raw": answer.get("Text"),
                    }
    return fields


def upload_url(event):
    body = body_of(event)
    device_id = _device(body.get("deviceId"))
    content_type = body.get("contentType")
    if content_type not in CONTENT_TYPES:
        raise BadRequest("Please use a JPEG or PNG photo.")
    key = f"stubs/{device_id}/{uuid.uuid4().hex}.{CONTENT_TYPES[content_type]}"
    if config.LOCAL:
        return 200, {"key": key, "uploadUrl": f"/local-upload/{key}"}
    import boto3
    from botocore.config import Config
    # Sign against the regional endpoint: a new bucket answers the global one
    # with a redirect, which a phone's PUT upload does not follow.
    region = os.environ.get("AWS_REGION", "us-west-2")
    s3 = boto3.client("s3", region_name=region, endpoint_url=f"https://s3.{region}.amazonaws.com",
                      config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": os.environ["STUB_BUCKET"], "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return 200, {"key": key, "uploadUrl": url}


def extract(event):
    body = body_of(event)
    _device(body.get("deviceId"))
    key = body.get("key")
    if not isinstance(key, str) or not KEY_RE.match(key) or key.split("/")[1] != body["deviceId"]:
        raise BadRequest("Unknown upload.")

    if config.LOCAL:
        path = os.path.join(LOCAL_UPLOAD_DIR, key)
        if not os.path.isfile(path):
            raise BadRequest("Unknown upload.")
        with open(path, "rb") as fh:
            document = {"Bytes": fh.read()}
    else:
        import boto3
        try:
            size = boto3.client("s3").head_object(Bucket=os.environ["STUB_BUCKET"], Key=key)["ContentLength"]
        except Exception:
            raise BadRequest("Unknown upload.")
        if size > 10 * 1024 * 1024:
            raise BadRequest("That photo is too large. Please use one under 10 MB.")
        document = {"S3Object": {"Bucket": os.environ["STUB_BUCKET"], "Name": key}}

    try:
        import boto3
        response = boto3.client("textract").analyze_document(
            Document=document,
            FeatureTypes=["QUERIES"],
            QueriesConfig={"Queries": [{"Text": text, "Alias": alias} for alias, text, _ in QUERIES]},
        )
    except Exception as err:
        print(f"Textract failed: {err!r}")
        return 200, {
            "ok": False,
            "message": "We could not read the stub automatically. Please type the numbers in.",
            "fields": {alias: {"value": None, "confidence": 0, "raw": None} for alias, _, _ in QUERIES},
        }
    return 200, {"ok": True, "fields": parse_textract(response)}


handler = route({"POST /stub/upload-url": upload_url, "POST /stub/extract": extract})
