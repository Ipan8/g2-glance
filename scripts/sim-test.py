#!/usr/bin/env python3
"""Headless simulator test harness for the G2 glance app.
Boots Vite dev server + simulator under Xvfb with the automation control
plane, waits for the app ready marker, screenshots the glasses framebuffer,
sends an input action, screenshots again, and asserts lit pixels.
Usage: python3 sim-test.py [actions...]  (default: click)
Screenshots land in ~/workspace/even-realities-g2/shots/
"""
import json, os, signal, subprocess, sys, time, urllib.request

BASE = "http://127.0.0.1:9898"
APP_DIR = os.path.expanduser("~/workspace/even-realities-g2/glance-app")
SHOTS = os.path.expanduser("~/workspace/even-realities-g2/shots")
READY_MARKER = "[glance] ready"

def http(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()

def lit_pixels(png_bytes):
    # Minimal PNG decode via zlib: parse IHDR + IDAT, unfilter, count alpha>0.
    import struct, zlib
    pos = 8
    w = h = None
    idat = b""
    while pos < len(png_bytes):
        ln, typ = struct.unpack(">I4s", png_bytes[pos:pos+8])
        data = png_bytes[pos+8:pos+8+ln]
        if typ == b"IHDR":
            w, h, bd, ct = struct.unpack(">IIBB", data[:10])
            assert ct == 6, f"expected RGBA, got color type {ct}"
        elif typ == b"IDAT":
            idat += data
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * 4 + 1
    lit = 0
    prev = bytearray(w * 4)
    for y in range(h):
        row = bytearray(raw[y*stride+1:(y+1)*stride])
        f = raw[y*stride]
        for x in range(len(row)):
            a = row[x-4] if x >= 4 else 0
            b = prev[x]
            c = prev[x-4] if x >= 4 else 0
            if f == 1: row[x] = (row[x] + a) & 255
            elif f == 2: row[x] = (row[x] + b) & 255
            elif f == 3: row[x] = (row[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                row[x] = (row[x] + pr) & 255
        prev = row
        lit += sum(1 for i in range(3, len(row), 4) if row[i] > 0)
    return lit

def main():
    actions = sys.argv[1:] or ["click"]
    os.makedirs(SHOTS, exist_ok=True)
    vite = subprocess.Popen(["npm", "run", "dev", "--", "--port", "5173", "--strictPort"],
                            cwd=APP_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            start_new_session=True)
    # Wait for Vite to answer before starting the simulator: the sim loads
    # the URL once at startup and a too-early load leaves a blank canvas.
    for _ in range(60):
        try:
            with urllib.request.urlopen("http://localhost:5173/", timeout=2) as r:
                if r.status == 200: break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        print("FAIL: vite dev server never came up"); return 1
    sim = subprocess.Popen(["xvfb-run", "-a", "evenhub-simulator",
                            "http://localhost:5173", "--automation-port", "9898"],
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                           start_new_session=True)
    try:
        # wait for ping
        for _ in range(40):
            try:
                if http("GET", "/api/ping") in (b"pong", b'{"message":"pong"}'):
                    break
            except Exception:
                pass
            time.sleep(0.5)
        else:
            print("FAIL: simulator control plane never came up"); return 1
        # wait for ready marker in console
        since = 0
        ready = False
        for _ in range(60):
            try:
                data = json.loads(http("GET", f"/api/console?since_id={since}"))
                for e in data.get("entries", []):
                    since = max(since, e["id"])
                    if READY_MARKER in e.get("message", ""):
                        ready = True
            except Exception:
                pass
            if ready: break
            time.sleep(0.5)
        print("ready marker:", ready)
        time.sleep(1)
        shot0 = http("GET", "/api/screenshot/glasses")
        open(f"{SHOTS}/boot.png", "wb").write(shot0)
        print("boot lit pixels:", lit_pixels(shot0))
        for i, act in enumerate(actions):
            http("POST", "/api/input", {"action": act})
            time.sleep(2.5)
            shot = http("GET", "/api/screenshot/glasses")
            open(f"{SHOTS}/after-{act}-{i}.png", "wb").write(shot)
            print(f"after {act}: lit pixels:", lit_pixels(shot))
        console = json.loads(http("GET", "/api/console"))
        errs = [e for e in console.get("entries", [])
                if e.get("level") in ("error",) or "error" in e.get("message", "").lower()][:5]
        print("console errors:", len(errs))
        for e in errs: print("  ", e.get("message", "")[:200])
        print("OK" if ready and lit_pixels(shot0) > 100 else "CHECK FAILED")
        return 0 if ready and lit_pixels(shot0) > 100 else 1
    finally:
        # Kill whole process groups: npm/xvfb-run spawn grandchildren that
        # plain terminate() would orphan (they keep holding :5173/:9898).
        for p in (sim, vite):
            try: os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except Exception: pass

if __name__ == "__main__":
    sys.exit(main())
