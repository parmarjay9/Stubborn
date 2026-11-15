"""Load the sample account history onto a device: four weeks of hours, with
pay stubs already checked for the first three. The newest week (43.5 hours,
Nov 8 to Nov 14) is left unchecked for the live demo.

    python demo/seed_week.py                       # local API on :8787
    python demo/seed_week.py --api https://xxxx.execute-api.us-west-2.amazonaws.com

The app does this by itself when someone opens the sample account, so this
script is only needed to load sample data from the command line. Each log is
locked to the secret that first used it, so by default this makes a new
device id and secret and prints them.
The data lives in backend/src/common/sample.py.
"""
import argparse
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=os.environ.get("STUBBORN_API", "http://localhost:8787"))
    parser.add_argument("--device", default=str(uuid.uuid4()))
    parser.add_argument("--secret", default=secrets.token_urlsafe(32),
                        help="the secret that owns --device (a new one is made if omitted)")
    args = parser.parse_args()

    request = urllib.request.Request(
        args.api.rstrip("/") + "/shifts/demo",
        data=json.dumps({"deviceId": args.device, "action": "seed"}).encode(),
        headers={"Content-Type": "application/json", "X-Device-Secret": args.secret}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode())
    except urllib.error.HTTPError as err:
        sys.exit(f"Seeding failed: {err.code} {err.read().decode()}")
    print(f"Seeded {result['count']} entries (chain valid: {result['valid']})")
    print(f"device: {args.device}")
    print(f"secret: {args.secret}  (keep this private)")


if __name__ == "__main__":
    main()
