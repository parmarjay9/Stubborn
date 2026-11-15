"""Local dev server: runs the same Lambda handlers behind plain HTTP.

    python backend/local_server.py            # http://localhost:8787

Storage is a JSON file in backend/.local/. Textract, Bedrock and TinyFish are
used only if credentials are present; otherwise each endpoint falls back the
same way it does in production (manual entry, template letters, recorded run).
"""
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8787"))


def load_env():
    path = os.path.join(HERE, ".env")
    if os.path.isfile(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"'))


load_env()
os.environ["STUBBORN_LOCAL"] = "1"
os.environ.setdefault("LOCAL_API_URL", f"http://localhost:{PORT}")
sys.path.insert(0, os.path.join(HERE, "src"))

import health  # noqa: E402
from agent import start as agent_start, status as agent_status  # noqa: E402
from check import handler as check_handler  # noqa: E402
from letters import handler as letters_handler  # noqa: E402
from shifts import handler as shifts_handler  # noqa: E402
from share import handler as share_handler  # noqa: E402
from stub import handler as stub_handler  # noqa: E402
from waitlist import handler as waitlist_handler  # noqa: E402

ROUTES = [
    ("GET", r"/health", health.handler),
    ("POST", r"/shifts", shifts_handler.handler),
    ("GET", r"/shifts", shifts_handler.handler),
    ("GET", r"/shifts/verify", shifts_handler.handler),
    ("POST", r"/shifts/demo", shifts_handler.handler),
    ("POST", r"/stub/upload-url", stub_handler.handler),
    ("POST", r"/stub/extract", stub_handler.handler),
    ("POST", r"/check", check_handler.handler),
    ("GET", r"/history", check_handler.handler),
    ("GET", r"/usage", check_handler.handler),
    ("POST", r"/letters", letters_handler.handler),
    ("POST", r"/agent/start", agent_start.handler),
    ("GET", r"/agent/status/(?P<runId>[^/]+)", agent_status.handler),
    ("POST", r"/share", share_handler.handler),
    ("POST", r"/waitlist", waitlist_handler.handler),
    ("GET", r"/share/(?P<shareId>[^/]+)", share_handler.handler),
]
UPLOAD_RE = re.compile(r"^/local-upload/(stubs/[0-9a-f-]{36}/[0-9a-f]{32}\.(?:jpg|png))$")


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Device-Secret")

    def _send(self, status, body=b"", content_type="application/json"):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204)

    def do_PUT(self):
        match = UPLOAD_RE.match(urlparse(self.path).path)
        if not match:
            return self._send(404, b'{"error":"Not found"}')
        target = os.path.join(stub_handler.LOCAL_UPLOAD_DIR, match.group(1))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "wb") as fh:
            fh.write(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        self._send(200, b"{}")

    def _dispatch(self, method):
        url = urlparse(self.path)
        for route_method, pattern, handler in ROUTES:
            match = re.fullmatch(pattern, url.path)
            if route_method == method and match:
                template = re.sub(r"\(\?P<(\w+)>[^)]*\)", r"{\1}", pattern)
                length = int(self.headers.get("Content-Length", "0") or 0)
                result = handler({
                    "routeKey": f"{method} {template}",
                    "rawPath": url.path,
                    "queryStringParameters": dict(parse_qsl(url.query)),
                    "pathParameters": match.groupdict(),
                    "body": self.rfile.read(length).decode("utf-8") if length else None,
                    "headers": {k.lower(): v for k, v in self.headers.items()},
                })
                return self._send(result["statusCode"], result["body"].encode("utf-8"))
        self._send(404, b'{"error":"Not found"}')

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))


if __name__ == "__main__":
    print(f"Stubborn local API on http://localhost:{PORT} (JSON file storage in backend/.local/)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
