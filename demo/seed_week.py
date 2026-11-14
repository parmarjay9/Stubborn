"""Seed the demo device with a realistic week: 43.5 hours across 5 days.

    python demo/seed_week.py                       # local API on :8787
    python demo/seed_week.py --api https://xxxx.execute-api.us-west-2.amazonaws.com

Clears the demo device first, then appends entries through the real API, so
every hash is checked by the server exactly like a phone's would be.
Note: serverTs on seeded entries is the time of seeding, not the shift time.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "src"))
from common.config import DEMO_DEVICE_ID  # noqa: E402
from common.hashchain import ZERO_HASH, hash_entry  # noqa: E402

# Monday Nov 9 to Friday Nov 13, 2026 (Arizona time, UTC-7, no daylight saving).
# 9 + 9.5 + 8.5 + 8.5 + 8 = 43.5 hours. Pay period on the demo stub: Nov 8 to Nov 14.
WEEK = [
    ("2026-11-09", "08:02:00", "17:02:00"),
    ("2026-11-10", "08:00:00", "17:30:00"),
    ("2026-11-11", "07:58:00", "16:28:00"),
    ("2026-11-12", "08:00:00", "16:30:00"),
    ("2026-11-13", "08:05:00", "16:05:00"),
]
# A made-up warehouse spot in Tempe, with a little GPS wobble per entry.
BASE_LAT, BASE_LNG = 33.4142, -111.9093


def post(api, path, payload):
    request = urllib.request.Request(
        api.rstrip("/") + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as err:
        sys.exit(f"{path} failed: {err.code} {err.read().decode()}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=os.environ.get("STUBBORN_API", "http://localhost:8787"))
    parser.add_argument("--device", default=DEMO_DEVICE_ID)
    args = parser.parse_args()

    post(args.api, "/shifts/demo", {"deviceId": args.device, "action": "reset"})
    prev, seq = ZERO_HASH, 0
    for day, start, end in WEEK:
        for kind, clock in (("IN", start), ("OUT", end)):
            entry = {
                "deviceId": args.device, "seq": seq, "type": kind,
                "clientTs": f"{day}T{clock}-07:00",
                "lat": round(BASE_LAT + ((seq * 37) % 11 - 5) * 0.00001, 6),
                "lng": round(BASE_LNG + ((seq * 53) % 13 - 6) * 0.00001, 6),
                "accuracyM": 8 + (seq * 7) % 9,
                "prevHash": prev,
            }
            entry["hash"] = prev = hash_entry(entry)
            post(args.api, "/shifts", entry)
            seq += 1
    print(f"Seeded {seq} entries (43.5 hours) for device {args.device}")
    print("Open the app with ?demo=1 to use this device.")


if __name__ == "__main__":
    main()
