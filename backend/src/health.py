from common import config
from common.api import route

handler = route({"GET /health": lambda event: (200, {"ok": True, "service": "stubborn", "local": config.LOCAL})})
