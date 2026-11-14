"""Load the sample account history onto a device: four weeks of hours, with
pay stubs already checked for the first three. The newest week (43.5 hours,
Nov 8 to Nov 14) is left unchecked for the live demo.

    python demo/seed_week.py                       # local API on :8787
    python demo/seed_week.py --api https://xxxx.execute-api.us-west-2.amazonaws.com

The app does this by itself when someone opens the sample account, so this
script is only needed to reset a specific device from the command line.
The data lives in backend/src/common/sample.py.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "src"))
from common.config import DEMO_DEVICE_ID  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=os.environ.get("STUBBORN_API", "http://localhost:8787"))
    parser.add_argument("--device", default=DEMO_DEVICE_ID)
    args = parser.parse_args()

    request = urllib.request.Request(
        args.api.rstrip("/") + "/shifts/demo",
        data=json.dumps({"deviceId": args.device, "action": "seed"}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode())
    except urllib.error.HTTPError as err:
        sys.exit(f"Seeding failed: {err.code} {err.read().decode()}")
    print(f"Seeded {result['count']} entries for device {args.device} (chain valid: {result['valid']})")


if __name__ == "__main__":
    main()
