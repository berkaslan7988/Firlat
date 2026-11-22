#!/usr/bin/env python3
"""Make the README screenshots in assets/screens/, light and dark.

Starts its own Fırlat on 127.0.0.1 with throwaway folders, pairs a phone and a tablet,
fills the board with sample parcels and captures the host, the phone, the pairing screen
and a transfer in flight. Your real board and Downloads folder are never touched.

    pip install playwright && playwright install chromium
    python tools/screenshots.py            # English UI
    python tools/screenshots.py --lang tr  # Turkish UI
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "screens"
PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
TABLET_UA = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HOST_ME = {"id": "5d0c5d0c5d0c5d0c", "name": "Study PC"}
PHONE_ME = {"id": "a1b2c3d4e5f6a7b8", "name": "Pixel 8"}
TABLET_ME = {"id": "c0ffee00c0ffee00", "name": "iPad"}

UPLOAD = """async ([name, type, body, me, batch, to]) => {
  const bin = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body);  // a number = that many zero bytes
  const q = new URLSearchParams({name, size: bin.length, type, from: me.id, fromName: me.name, batch, tid: 't' + Math.random(), to: to || ''});
  const r = await fetch('/api/upload?' + q, {method: 'PUT', headers: {'X-Firlat': '1', 'Content-Type': 'application/octet-stream'}, body: bin});
  return r.status; }"""
TEXT = """async ([text, me, to]) => (await fetch('/api/text', {method: 'POST', headers: {'X-Firlat': '1', 'Content-Type': 'application/json'},
  body: JSON.stringify({text, from: me, to: to || null})})).status"""


def photo(sky: str, sun: str, hill: str) -> str:
    """A small landscape as SVG, so the board shows real previews without any image library."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{sky}"/><stop offset="1" stop-color="#2b2b2b"/></linearGradient></defs>'
            f'<rect width="320" height="240" fill="url(#g)"/><circle cx="220" cy="80" r="30" fill="{sun}"/>'
            f'<path d="M0 240 110 130 220 240Z" fill="{hill}"/><path d="M120 240 230 150 320 240Z" fill="#1f2a24"/></svg>')


def start_server(tmp: Path, lang: str):
    env = dict(os.environ, FIRLAT_BIND="127.0.0.1", FIRLAT_HOST_NAMES="localhost", FIRLAT_NO_BROWSER="1",
               FIRLAT_DATA=str(tmp / "data"), FIRLAT_DIR=str(tmp / "Downloads" / "Fırlat"), FIRLAT_PORT="8600",
               FIRLAT_LANG="en", PYTHONIOENCODING="utf-8")
    proc = subprocess.Popen([sys.executable, "-u", str(ROOT / "server.py")], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8")
    for line in proc.stdout:
        m = re.search(r"http://localhost:(\d+)", line)
        if m:
            return proc, int(m.group(1))
    raise SystemExit("server did not start")


def context(browser, kind: str, theme: str, lang: str, me=None):
    opts = {"color_scheme": theme}
    if kind == "phone":
        opts.update(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=PHONE_UA)
    elif kind == "tablet":
        opts.update(viewport={"width": 820, "height": 1180}, user_agent=TABLET_UA)
    else:
        opts.update(viewport={"width": 1440, "height": 900})
    ctx = browser.new_context(**opts)
    js = f"localStorage.setItem('firlat.lang', JSON.stringify('{lang}'));if(!localStorage.getItem('firlat.theme'))localStorage.setItem('firlat.theme', JSON.stringify('{theme}'));"
    if me:
        js += f"if(!localStorage.getItem('firlat.me'))localStorage.setItem('firlat.me', JSON.stringify({json.dumps(me)}));"
    ctx.add_init_script(js)
    return ctx


def set_theme(page, theme: str) -> None:
    page.evaluate(f"localStorage.setItem('firlat.theme', JSON.stringify('{theme}'))")
    page.reload(wait_until="load")
    page.wait_for_timeout(1400)


def hide_toasts(page) -> None:
    page.evaluate("document.querySelectorAll('.toast .icon-btn').forEach(b => b.click())")
    page.wait_for_timeout(400)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--lang", choices=["en", "tr"], default="en")
    lang = ap.parse_args().lang
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="firlat-shots-"))
    proc, port = start_server(tmp, lang)
    host_url, remote = f"http://localhost:{port}", f"http://127.0.0.1:{port}"
    en = lang == "en"
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            code = json.loads(b.new_page().goto(host_url + "/api/state").text())["server"]["pair_code"]
            host = context(b, "desktop", "light", lang, HOST_ME).new_page()
            host.goto(host_url + "/", wait_until="load")
            phone = context(b, "phone", "light", lang, PHONE_ME).new_page()
            phone.goto(remote + f"/?pair={code}", wait_until="load")
            tablet = context(b, "tablet", "light", lang, TABLET_ME).new_page()
            tablet.goto(remote + f"/?pair={code}", wait_until="load")
            phone.wait_for_timeout(1500)

            # the board: oldest first
            host.evaluate(UPLOAD, ["slides-final-v3.pptx" if en else "sunum-final-v3.pptx", "application/vnd.ms-powerpoint", 12_600_000, HOST_ME, "b1", TABLET_ME["id"]])
            tablet.evaluate(UPLOAD, ["lecture-notes.pdf" if en else "ders-notlari.pdf", "application/pdf", 5_800_000, TABLET_ME, "b2", ""])
            for i, (sky, sun, hill) in enumerate((("#f4b478", "#ffe9c4", "#3f5a48"), ("#7ab0e0", "#fff6d8", "#4b6b52"), ("#c98bb9", "#ffd9a8", "#5a4a63"))):
                phone.evaluate(UPLOAD, [f"IMG_204{i + 1}.svg", "image/svg+xml", photo(sky, sun, hill), PHONE_ME, "b3", ""])
            phone.evaluate(UPLOAD, ["holiday-video.mp4" if en else "tatil-videosu.mp4", "video/mp4", 17_200_000, PHONE_ME, "b4", HOST_ME["id"]])
            tablet.evaluate(TEXT, ["https://en.wikipedia.org/wiki/Shipping_label", TABLET_ME, ""])

            for theme in ("light", "dark"):
                set_theme(host, theme)
                # one parcel lands while we watch, so the board shows a fresh label
                phone.evaluate(TEXT, ["Wi-Fi password: coffee-2026" if en else "Wi-Fi şifresi: kahve-2026", PHONE_ME, ""])
                host.wait_for_timeout(1600)
                hide_toasts(host)
                host.screenshot(path=str(OUT / f"board-{theme}.png"))
                set_theme(phone, theme)
                hide_toasts(phone)
                phone.screenshot(path=str(OUT / f"phone-{theme}.png"))
                pair = context(b, "phone", theme, lang).new_page()
                pair.goto(remote + "/", wait_until="load")
                pair.wait_for_timeout(1000)
                pair.keyboard.type("7497")
                pair.wait_for_timeout(300)
                pair.screenshot(path=str(OUT / f"pair-{theme}.png"))
                pair.context.close()
                # remove the extra text so the next theme shows the same board
                ids = host.evaluate("async () => (await (await fetch('/api/state')).json()).items.filter(i => i.kind === 'text' && i.text.startsWith('Wi-Fi')).map(i => i.id)")
                for i in ids:
                    host.evaluate("async (id) => fetch('/api/item/' + id, {method: 'DELETE', headers: {'X-Firlat': '1'}})", i)

            # a transfer in flight: throttle the phone's upload and catch both ends
            cdp = phone.context.new_cdp_session(phone)
            cdp.send("Network.enable")
            cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 20, "downloadThroughput": -1, "uploadThroughput": 2_500_000})
            for theme in ("light", "dark"):
                set_theme(phone, theme)
                set_theme(host, theme)
                files = [{"name": n, "mimeType": "application/octet-stream", "buffer": bytes(s)} for n, s in (("concert-4k.mp4", 30_000_000), ("raw-photos.zip", 14_000_000))]
                phone.locator("input[type=file][multiple]").set_input_files(files)
                phone.wait_for_timeout(3500)
                hide_toasts(phone)
                hide_toasts(host)
                phone.screenshot(path=str(OUT / f"sending-{theme}.png"))
                host.screenshot(path=str(OUT / f"receiving-{theme}.png"))
                phone.locator('button[aria-label="Stop all"], button[aria-label="Hepsini durdur"]').first.click()
                phone.wait_for_timeout(800)
            b.close()
    finally:
        proc.terminate()
        proc.wait(timeout=10)
        shutil.rmtree(tmp, ignore_errors=True)
    for f in sorted(OUT.glob("*.png")):
        print(f"{f.relative_to(ROOT)}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
