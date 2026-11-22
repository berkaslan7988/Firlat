"""Fırlat — yerel ağda hızlı dosya aktarımı.

Yalnızca Python standart kütüphanesi. Bir bilgisayarda çalışır; aynı ağdaki
her cihaz tarayıcıdan bağlanır (QR ya da adres + 6 haneli eşleşme kodu).

Ortam değişkenleri:
  FIRLAT_PORT   dinlenecek port (varsayılan 8600, doluysa sonrakiler denenir)
  FIRLAT_DIR    gelen dosyaların klasörü (varsayılan ~/Downloads/Fırlat)
  FIRLAT_OPEN=1 eşleşme kodunu kapatır (ağdaki herkes bağlanabilir)
  FIRLAT_NO_BROWSER=1  açılışta tarayıcıyı açma
  FIRLAT_BIND   dinlenecek arayüz (varsayılan 0.0.0.0 = tüm ağ)
  FIRLAT_LANG   konsol dili: tr ya da en (varsayılan: sistem dili)
"""

from __future__ import annotations

import json
import mimetypes
import os
import queue
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import unicodedata
import zipfile
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA = Path(os.environ.get("FIRLAT_DATA", ROOT / "data"))
SAVE_DIR = Path(os.environ.get("FIRLAT_DIR", Path.home() / "Downloads" / "Fırlat"))
PORT = int(os.environ.get("FIRLAT_PORT", "8600"))
OPEN = os.environ.get("FIRLAT_OPEN") == "1"
BIND = os.environ.get("FIRLAT_BIND", "0.0.0.0")
# Ana bilgisayar sayılan Host adları (test için daraltılabilir)
HOST_NAMES = set(os.environ.get("FIRLAT_HOST_NAMES", "localhost,127.0.0.1,::1").split(","))

CHUNK = 1 << 20  # 1 MiB
SOCK_BUF = 4 << 20
COOKIE = "firlat"
HOSTNAME = socket.gethostname()

DATA.mkdir(parents=True, exist_ok=True)
SAVE_DIR.mkdir(parents=True, exist_ok=True)

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/heic", ".heic")


# ---------------------------------------------------------------- güvenlik
def _load_secret() -> str:
    p = DATA / "secret.txt"
    if p.exists():
        s = p.read_text("utf-8").strip()
        if len(s) >= 32:
            return s
    s = secrets.token_urlsafe(32)
    p.write_text(s, "utf-8")
    return s


SECRET = _load_secret()
PAIR_CODE = f"{secrets.randbelow(1_000_000):06d}"
_fails: dict[str, list[float]] = {}
_fails_lock = threading.Lock()


def pair_blocked(ip: str) -> bool:
    now = time.time()
    with _fails_lock:
        arr = [t for t in _fails.get(ip, []) if now - t < 300]
        _fails[ip] = arr
        return len(arr) >= 8


def pair_failed(ip: str) -> None:
    with _fails_lock:
        _fails.setdefault(ip, []).append(time.time())


# ---------------------------------------------------------------- ağ
def lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(HOSTNAME, None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    ips = [ip for ip in ips if not ip.startswith(("127.", "169.254.", "0."))]

    def rank(ip: str) -> int:
        if ip.startswith("192.168."):
            return 0
        if ip.startswith("10."):
            return 1
        return 2

    primary = ips[:1]
    rest = sorted(ips[1:], key=rank)
    return primary + rest


# ---------------------------------------------------------------- dosya adları
_BAD = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


def clean_part(name: str) -> str:
    name = unicodedata.normalize("NFC", name)
    name = _BAD.sub("_", name).strip().rstrip(". ")
    if not name or name in {".", ".."}:
        name = "dosya"
    if name.split(".")[0].upper() in _RESERVED:
        name = "_" + name
    if len(name) > 180:
        stem, dot, ext = name.rpartition(".")
        if dot and len(ext) <= 12:
            name = stem[: 180 - len(ext) - 1] + "." + ext
        else:
            name = name[:180]
    return name


def unique_path(folder: Path, name: str, is_dir: bool = False) -> Path:
    p = folder / name
    if not p.exists() and not Path(str(p) + ".part").exists():
        return p
    stem, ext = (name, "") if is_dir else os.path.splitext(name)
    i = 2
    while True:
        p = folder / f"{stem} ({i}){ext}"
        if not p.exists() and not Path(str(p) + ".part").exists():
            return p
        i += 1


# ---------------------------------------------------------------- durum
class Hub:
    """Pano öğeleri, çevrimiçi cihazlar ve canlı olay yayını."""

    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.index_path = DATA / "index.json"
        self.items: list[dict] = []
        self.devices: dict[str, dict] = {}  # id -> {id,name,kind,host,conns,seen}
        self.subs: dict[int, tuple[str, queue.Queue]] = {}
        self.batch_roots: dict[tuple[str, str], str] = {}
        self.ever_remote = False
        self._load()

    # --- kalıcılık
    def _load(self) -> None:
        try:
            items = json.loads(self.index_path.read_text("utf-8"))
        except (OSError, ValueError):
            items = []
        keep = []
        for it in items:
            if it.get("kind") == "file" and not (SAVE_DIR / it.get("path", "")).is_file():
                continue
            keep.append(it)
        self.items = keep
        # Yarım kalmış yüklemeleri temizle
        for part in SAVE_DIR.rglob("*.part"):
            try:
                part.unlink()
            except OSError:
                pass

    def _save(self) -> None:
        tmp = self.index_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.items, ensure_ascii=False), "utf-8")
        os.replace(tmp, self.index_path)

    # --- görünürlük
    @staticmethod
    def visible(it: dict, dev: str, host: bool) -> bool:
        return host or not it.get("to") or it["to"] == dev or it["from"]["id"] == dev

    def items_for(self, dev: str, host: bool) -> list[dict]:
        with self.lock:
            return [self.public(it) for it in self.items if self.visible(it, dev, host)]

    @staticmethod
    def public(it: dict) -> dict:
        return {k: v for k, v in it.items() if k != "path"}

    def device_list(self) -> list[dict]:
        with self.lock:
            return [
                {"id": d["id"], "name": d["name"], "kind": d["kind"], "host": d["host"]}
                for d in self.devices.values()
                if d["conns"] > 0
            ]

    # --- yayın
    def subscribe(self, dev: str) -> tuple[int, queue.Queue]:
        q: queue.Queue = queue.Queue(maxsize=500)
        key = id(q)
        with self.lock:
            self.subs[key] = (dev, q)
        return key, q

    def unsubscribe(self, key: int) -> None:
        with self.lock:
            self.subs.pop(key, None)

    def emit(self, event: str, data: dict, only=None) -> None:
        """only: None (herkes) ya da fonksiyon(dev_id, is_host) -> bool"""
        msg = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()
        with self.lock:
            targets = list(self.subs.values())
            hosts = {d["id"] for d in self.devices.values() if d["host"]}
        for dev, q in targets:
            if only is not None and not only(dev, dev in hosts):
                continue
            try:
                q.put_nowait(msg)
            except queue.Full:
                pass

    def emit_for_item(self, event: str, it: dict, data: dict) -> None:
        self.emit(event, data, only=lambda dev, host: self.visible(it, dev, host))

    # --- cihazlar
    def connect(self, dev: str, name: str, kind: str, host: bool) -> None:
        with self.lock:
            d = self.devices.get(dev)
            if d is None:
                d = self.devices[dev] = {"id": dev, "name": name, "kind": kind, "host": host, "conns": 0}
            d.update(name=name, kind=kind, host=host)
            d["conns"] += 1
            d["seen"] = time.time()
            if not host:
                self.ever_remote = True
        self.emit("devices", {"devices": self.device_list()})

    def disconnect(self, dev: str) -> None:
        with self.lock:
            d = self.devices.get(dev)
            if d:
                d["conns"] = max(0, d["conns"] - 1)
        self.emit("devices", {"devices": self.device_list()})

    def rename(self, dev: str, name: str) -> None:
        changed = []
        with self.lock:
            if dev in self.devices:
                self.devices[dev]["name"] = name
            for it in self.items:
                if it["from"]["id"] == dev:
                    it["from"]["name"] = name
                    changed.append(it)
            if changed:
                self._save()
        self.emit("devices", {"devices": self.device_list()})
        self.emit("renamed", {"id": dev, "name": name})

    # --- öğeler
    def add(self, it: dict) -> None:
        with self.lock:
            self.items.insert(0, it)
            self._save()
        self.emit_for_item("item", it, {"item": self.public(it)})

    def get(self, iid: str) -> dict | None:
        with self.lock:
            for it in self.items:
                if it["id"] == iid:
                    return it
        return None

    def remove(self, iid: str) -> dict | None:
        with self.lock:
            for i, it in enumerate(self.items):
                if it["id"] == iid:
                    self.items.pop(i)
                    self._save()
                    break
            else:
                return None
        self.emit("removed", {"id": iid})
        return it

    def batch_root(self, batch: str, top: str) -> str:
        """Klasör yüklemelerinde en üst klasörü bir kez benzersizleştir."""
        with self.lock:
            key = (batch, top)
            if key not in self.batch_roots:
                if len(self.batch_roots) > 2000:
                    self.batch_roots.clear()
                self.batch_roots[key] = unique_path(SAVE_DIR, top, is_dir=True).name
            return self.batch_roots[key]


HUB = Hub()


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id() -> str:
    return secrets.token_hex(6)


def free_space() -> int:
    try:
        return shutil.disk_usage(SAVE_DIR).free
    except OSError:
        return -1


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Firlat/2.0"
    timeout = 120

    # sessiz log
    def log_message(self, fmt, *args):  # noqa: N802
        pass

    def setup(self):
        super().setup()
        try:
            self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, SOCK_BUF)
            self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, SOCK_BUF)
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass

    # --- yardımcılar
    @property
    def client_ip(self) -> str:
        return self.client_address[0]

    def is_host(self) -> bool:
        if self.client_ip not in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
            return False
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        return host in HOST_NAMES

    def authed(self) -> bool:
        if OPEN or self.is_host():
            return True
        c = SimpleCookie()
        try:
            c.load(self.headers.get("Cookie") or "")
        except Exception:
            return False
        m = c.get(COOKIE)
        return bool(m) and secrets.compare_digest(m.value, SECRET)

    def send_json(self, obj, status=200, headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def err(self, status, code, msg=""):
        self.send_json({"error": code, "message": msg}, status)

    def read_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("too big")
        raw = self.rfile.read(n) if n else b""
        return json.loads(raw or b"{}")

    def drain(self):
        """Okunmamış gövdeyi atla ki bağlantı temiz kalsın."""
        n = int(self.headers.get("Content-Length") or 0)
        if n > 8 * CHUNK:
            self.close_connection = True
            return
        while n > 0:
            got = self.rfile.read(min(n, CHUNK))
            if not got:
                break
            n -= len(got)

    def csrf_ok(self) -> bool:
        return self.headers.get("X-Firlat") == "1"

    # --- yönlendirme
    def do_GET(self):  # noqa: N802
        url = urlsplit(self.path)
        path, q = url.path, parse_qs(url.query)
        if not path.startswith("/api/"):
            return self.serve_static(path)
        if not self.authed():
            return self.err(401, "pair")
        try:
            if path == "/api/state":
                return self.api_state(q)
            if path == "/api/events":
                return self.api_events(q)
            if path.startswith("/api/file/"):
                return self.api_file(path[len("/api/file/"):], q)
            if path == "/api/zip":
                return self.api_zip(q)
        except (ConnectionError, TimeoutError):
            self.close_connection = True
            return
        self.err(404, "not_found")

    def do_HEAD(self):  # noqa: N802
        self.err(405, "method")

    def do_POST(self):  # noqa: N802
        path = urlsplit(self.path).path
        if path == "/api/pair":
            return self.api_pair()
        if not self.csrf_ok():
            self.drain()
            return self.err(403, "csrf")
        if not self.authed():
            self.drain()
            return self.err(401, "pair")
        try:
            body = self.read_json()
        except ValueError:
            return self.err(400, "bad_json")
        if path == "/api/text":
            return self.api_text(body)
        if path == "/api/rename":
            return self.api_rename(body)
        if path == "/api/reveal":
            return self.api_reveal(body)
        if path == "/api/clear":
            return self.api_clear(body)
        self.err(404, "not_found")

    def do_PUT(self):  # noqa: N802
        url = urlsplit(self.path)
        if url.path != "/api/upload":
            self.drain()
            return self.err(404, "not_found")
        if not self.csrf_ok():
            self.close_connection = True
            return self.err(403, "csrf")
        if not self.authed():
            self.close_connection = True
            return self.err(401, "pair")
        try:
            return self.api_upload(parse_qs(url.query))
        except (ConnectionError, TimeoutError):
            self.close_connection = True

    def do_DELETE(self):  # noqa: N802
        url = urlsplit(self.path)
        if not self.csrf_ok():
            return self.err(403, "csrf")
        if not self.authed():
            return self.err(401, "pair")
        if url.path.startswith("/api/item/"):
            return self.api_delete(url.path[len("/api/item/"):], parse_qs(url.query))
        self.err(404, "not_found")

    # --- statik
    def serve_static(self, path: str):
        rel = unquote(path).lstrip("/") or "index.html"
        f = (STATIC / rel).resolve()
        if not str(f).startswith(str(STATIC.resolve())) or not f.is_file():
            f = STATIC / "index.html"
            if not f.is_file():
                return self.err(500, "no_build", "static/ yok: frontend'i derle (npm run build)")
        data = f.read_bytes()
        ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith(("javascript", "json", "svg+xml")):
            ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        cache = "public, max-age=31536000, immutable" if "/assets/" in path else "no-cache"
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(data)

    # --- API
    def api_pair(self):
        try:
            body = self.read_json()
        except ValueError:
            return self.err(400, "bad_json")
        ip = self.client_ip
        if pair_blocked(ip):
            return self.err(429, "slow_down", "Çok fazla deneme. 5 dakika sonra tekrar dene.")
        code = re.sub(r"\D", "", str(body.get("code", "")))
        if not (OPEN or secrets.compare_digest(code, PAIR_CODE)):
            pair_failed(ip)
            return self.err(403, "wrong_code", "Kod tutmadı.")
        cookie = f"{COOKIE}={SECRET}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax"
        name = str(body.get("name") or "Bir cihaz")[:40]
        HUB.emit("paired", {"name": name}, only=lambda dev, host: host)
        self.send_json({"ok": True}, headers={"Set-Cookie": cookie})

    def api_state(self, q):
        dev = (q.get("device") or [""])[0]
        host = self.is_host()
        server = {
            "name": HOSTNAME,
            "port": self.server.server_address[1],
            "ips": lan_ips(),
            "open": OPEN,
        }
        if host:
            server.update(
                pair_code=None if OPEN else PAIR_CODE,
                save_dir=str(SAVE_DIR),
                ever_remote=HUB.ever_remote,
                free=free_space(),
            )
        self.send_json(
            {
                "host": host,
                "server": server,
                "items": HUB.items_for(dev, host),
                "devices": HUB.device_list(),
            }
        )

    def api_events(self, q):
        dev = (q.get("device") or [""])[0][:40] or new_id()
        name = (q.get("name") or ["Cihaz"])[0][:40]
        kind = (q.get("kind") or ["desktop"])[0][:12]
        host = self.is_host()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        key, qq = HUB.subscribe(dev)
        HUB.connect(dev, name, kind, host)
        try:
            self.wfile.write(b"retry: 1500\n\n")
            while True:
                try:
                    msg = qq.get(timeout=15)
                except queue.Empty:
                    msg = b": ping\n\n"
                self.wfile.write(msg)
        except (OSError, ConnectionError):
            pass
        finally:
            HUB.unsubscribe(key)
            HUB.disconnect(dev)

    def api_upload(self, q):
        g = lambda k, d="": (q.get(k) or [d])[0]  # noqa: E731
        try:
            length = int(self.headers.get("Content-Length") or -1)
        except ValueError:
            length = -1
        if length < 0:
            self.close_connection = True
            return self.err(411, "length")
        free = free_space()
        if free >= 0 and length > free - 64 * CHUNK:
            self.close_connection = True
            return self.err(507, "disk_full", "Bilgisayarda yer kalmadı.")

        sender = {"id": g("from")[:40], "name": g("fromName", "Cihaz")[:40]}
        to = g("to")[:40] or None
        batch = g("batch")[:40] or new_id()
        rel = g("rel") or g("name") or "dosya"
        parts = [clean_part(p) for p in rel.replace("\\", "/").split("/") if p not in ("", ".", "..")]
        if not parts:
            parts = ["dosya"]
        folder = SAVE_DIR
        if len(parts) > 1:
            parts[0] = HUB.batch_root(batch, parts[0])
            folder = SAVE_DIR.joinpath(*parts[:-1])
            folder.mkdir(parents=True, exist_ok=True)
        with HUB.lock:
            final = unique_path(folder, parts[-1])
            part = Path(str(final) + ".part")
            part.touch()

        it = {
            "id": new_id(),
            "kind": "file",
            "name": final.name,
            "rel": "/".join([*parts[:-1], final.name]) if len(parts) > 1 else None,
            "size": length,
            "mime": g("type") or mimetypes.guess_type(final.name)[0] or "",
            "from": sender,
            "to": to,
            "batch": batch,
            "created": now_ms(),
            "path": str(final.relative_to(SAVE_DIR)),
        }
        tid = g("tid") or it["id"]
        progress = {"tid": tid, "name": it["name"], "size": length, "from": sender, "to": to}
        incoming = lambda dev, host: dev != sender["id"] and (host or not to or to == dev)  # noqa: E731

        done = 0
        ok = False
        last = 0.0
        t0 = time.time()
        buf = bytearray(CHUNK)
        mv = memoryview(buf)
        try:
            with open(part, "wb", buffering=0) as out:
                while done < length:
                    n = self.rfile.readinto(mv[: min(CHUNK, length - done)])
                    if not n:
                        break
                    out.write(mv[:n])
                    done += n
                    t = time.time()
                    if t - last > 0.3:
                        last = t
                        HUB.emit("progress", {**progress, "done": done, "rate": done / max(t - t0, 1e-3)}, only=incoming)
            ok = done == length
        except (OSError, ConnectionError, TimeoutError):
            ok = False
        finally:
            if not ok:
                try:
                    part.unlink()
                except OSError:
                    pass
                HUB.emit("progress_end", {"tid": tid, "ok": False}, only=incoming)
                self.close_connection = True

        if not ok:
            try:
                self.err(400, "incomplete")
            except OSError:
                pass
            return
        try:
            os.replace(part, final)
        except OSError as e:
            return self.err(500, "save_failed", str(e))
        HUB.emit("progress_end", {"tid": tid, "ok": True}, only=incoming)
        HUB.add(it)
        self.send_json({"item": HUB.public(it)})

    def api_text(self, body):
        text = str(body.get("text") or "")
        if not text.strip():
            return self.err(400, "empty")
        if len(text) > 200_000:
            return self.err(413, "too_long", "Metin çok uzun; dosya olarak gönder.")
        frm = body.get("from") or {}
        it = {
            "id": new_id(),
            "kind": "text",
            "text": text,
            "size": len(text.encode()),
            "from": {"id": str(frm.get("id", ""))[:40], "name": str(frm.get("name", "Cihaz"))[:40]},
            "to": (str(body.get("to") or "")[:40]) or None,
            "created": now_ms(),
        }
        HUB.add(it)
        self.send_json({"item": HUB.public(it)})

    def api_rename(self, body):
        dev = str(body.get("device") or "")[:40]
        name = re.sub(r"\s+", " ", str(body.get("name") or "")).strip()[:40]
        if not dev or not name:
            return self.err(400, "bad")
        HUB.rename(dev, name)
        self.send_json({"ok": True})

    def api_delete(self, iid, q):
        dev = (q.get("device") or [""])[0]
        it = HUB.get(iid)
        if not it:
            return self.err(404, "not_found")
        if not (self.is_host() or it["from"]["id"] == dev):
            return self.err(403, "not_owner", "Yalnızca gönderen ya da ana bilgisayar silebilir.")
        HUB.remove(iid)
        if it["kind"] == "file":
            remove_file(it)
        self.send_json({"ok": True})

    def api_clear(self, body):
        if not self.is_host():
            return self.err(403, "host_only")
        with HUB.lock:
            items = list(HUB.items)
        for it in items:
            HUB.remove(it["id"])
            if it["kind"] == "file" and body.get("files"):
                remove_file(it)
        self.send_json({"ok": True})

    def api_reveal(self, body):
        if not self.is_host():
            return self.err(403, "host_only")
        iid = body.get("id")
        target = SAVE_DIR
        if iid:
            it = HUB.get(str(iid))
            if not it or it["kind"] != "file":
                return self.err(404, "not_found")
            target = SAVE_DIR / it["path"]
        reveal(target)
        self.send_json({"ok": True})

    def api_file(self, iid, q):
        it = HUB.get(iid)
        if not it or it["kind"] != "file":
            return self.err(404, "not_found")
        p = SAVE_DIR / it["path"]
        try:
            f = open(p, "rb")
        except OSError:
            return self.err(404, "gone")
        with f:
            size = os.fstat(f.fileno()).st_size
            start, end = 0, size - 1
            status = 200
            rng = self.headers.get("Range")
            if rng:
                m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
                if m and (m.group(1) or m.group(2)):
                    if m.group(1):
                        start = int(m.group(1))
                        end = int(m.group(2)) if m.group(2) else size - 1
                    else:
                        start = max(0, size - int(m.group(2)))
                    end = min(end, size - 1)
                    if start > end or start >= size:
                        self.send_response(416)
                        self.send_header("Content-Range", f"bytes */{size}")
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                    status = 206
            inline = (q.get("inline") or ["0"])[0] == "1"
            ctype = it.get("mime") or mimetypes.guess_type(it["name"])[0] or "application/octet-stream"
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "private, max-age=3600")
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Disposition", disposition(it["name"], inline))
            self.end_headers()
            f.seek(start)
            left = end - start + 1
            buf = bytearray(CHUNK)
            mv = memoryview(buf)
            while left > 0:
                n = f.readinto(mv[: min(CHUNK, left)])
                if not n:
                    break
                self.wfile.write(mv[:n])
                left -= n

    def api_zip(self, q):
        ids = [i for i in (q.get("ids") or [""])[0].split(",") if i]
        dev = (q.get("device") or [""])[0]
        host = self.is_host()
        items = [it for it in (HUB.get(i) for i in ids) if it and it["kind"] == "file" and HUB.visible(it, dev, host)]
        if not items:
            return self.err(404, "not_found")
        stamp = time.strftime("%Y-%m-%d_%H-%M")
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", disposition(f"Fırlat_{stamp}.zip", False))
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        used: set[str] = set()
        with zipfile.ZipFile(_Sink(self.wfile), "w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
            for it in items:
                arc = it.get("rel") or it["name"]
                base, ext = os.path.splitext(arc)
                i = 2
                while arc in used:
                    arc = f"{base} ({i}){ext}"
                    i += 1
                used.add(arc)
                p = SAVE_DIR / it["path"]
                if p.is_file():
                    zf.write(p, arc)


class _Sink:
    """zipfile'ın akışa yazabilmesi için tell/seek'siz yazıcı."""

    def __init__(self, w):
        self.w = w

    def write(self, b):
        self.w.write(b)
        return len(b)

    def flush(self):
        pass


def disposition(name: str, inline: bool) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode() or "dosya"
    ascii_name = ascii_name.replace('"', "").replace("\\", "")
    kind = "inline" if inline else "attachment"
    return f"{kind}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"


def remove_file(it: dict) -> None:
    p = SAVE_DIR / it["path"]
    try:
        p.unlink()
    except OSError:
        return
    # Boşalan klasörleri (yalnızca SAVE_DIR içinde) temizle
    parent = p.parent
    root = SAVE_DIR.resolve()
    while parent.resolve() != root and root in parent.resolve().parents:
        try:
            parent.rmdir()
        except OSError:
            break
        parent = parent.parent


def reveal(target: Path) -> None:
    try:
        if sys.platform == "win32":
            if target.is_file():
                subprocess.Popen(["explorer", "/select,", str(target)])
            else:
                os.startfile(str(target))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", *(["-R"] if target.is_file() else []), str(target)])
        else:
            subprocess.Popen(["xdg-open", str(target if target.is_dir() else target.parent)])
    except OSError:
        pass


def console_lang() -> str:
    """Turkish console on a Turkish system, English everywhere else; FIRLAT_LANG overrides."""
    forced = os.environ.get("FIRLAT_LANG", "").strip().lower()
    if forced in ("tr", "en"):
        return forced
    import locale

    try:
        name = locale.getlocale()[0] or ""
    except ValueError:
        name = ""
    if not name and sys.platform == "win32":
        try:
            import ctypes

            name = locale.windows_locale.get(ctypes.windll.kernel32.GetUserDefaultUILanguage(), "")
        except (AttributeError, OSError):
            name = ""
    return "tr" if name.lower().startswith(("tr", "turkish")) else "en"


def say(tr: str, en: str) -> str:
    return tr if CONSOLE == "tr" else en


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64
    # Windows'ta SO_REUSEADDR aynı portu iki sürecin almasına izin verir; kapat.
    allow_reuse_address = sys.platform != "win32"


def serve() -> None:
    port = PORT
    for attempt in range(20):
        try:
            httpd = Server((BIND, port), Handler)
            break
        except OSError:
            port += 1
    else:
        print(say("Boş port bulunamadı.", "No free port found."))
        sys.exit(1)

    ips = lan_ips()
    line = "─" * 52
    print(f"\n  {say('Fırlat çalışıyor', 'Fırlat is running')}  ·  {HOSTNAME}\n  {line}")
    print(f"  {say('Bu bilgisayar  ', 'This computer  ')}: http://localhost:{port}")
    for ip in ips:
        print(f"  {say('Ağdaki cihazlar', 'Other devices  ')}: http://{ip}:{port}")
    if not OPEN:
        print(f"  {say('Eşleşme kodu   ', 'Pairing code   ')}: {PAIR_CODE[:3]} {PAIR_CODE[3:]}")
    print(f"  {say('Klasör         ', 'Folder         ')}: {SAVE_DIR}\n  {line}")
    print(say("  Kapatmak için bu pencereyi kapat ya da Ctrl+C.\n", "  Close this window or press Ctrl+C to stop.\n"))

    if os.environ.get("FIRLAT_NO_BROWSER") != "1":
        import webbrowser

        threading.Timer(0.6, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    try:
        httpd.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print(say("  Görüşürüz.", "  Bye."))
    finally:
        httpd.server_close()


CONSOLE = console_lang()

if __name__ == "__main__":
    serve()
