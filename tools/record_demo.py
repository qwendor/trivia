"""Record a short demo video of Trivia Night: the big screen and one phone side by side.

    python tools/record_demo.py            -> Desktop/SHRM-Trivia-Demo.mp4

Needs the local server running (python serve.py) and Playwright for Python with Chromium.
"""
import os, sys, time, glob, shutil, subprocess
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4366"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_video")
DESKTOP = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
if not os.path.isdir(DESKTOP):
    DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")
FINAL = os.path.join(DESKTOP, "SHRM-Trivia-Demo.mp4")


def host_state(page):
    return page.evaluate("() => { const w = document.getElementById('host').contentWindow; return w.TRIVIA ? JSON.parse(JSON.stringify({phase: w.TRIVIA.state().phase, qi: w.TRIVIA.state().qi, c: (w.TRIVIA.state().qs[w.TRIVIA.state().qi]||{}).c, done: !!w.TRIVIA.state().winnerDone})) : null; }")


def wait_phase(page, phase, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = host_state(page)
        if st and st["phase"] == phase:
            return st
        time.sleep(0.2)
    raise RuntimeError("timed out waiting for phase " + phase)


def draw_face(page, box):
    """Scribble a smiley on the phone canvas with real mouse moves."""
    import math
    cx, cy, r = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, box["width"] * 0.3
    page.mouse.move(cx + r, cy)
    page.mouse.down()
    for i in range(1, 41):
        a = i / 40 * math.pi * 2
        page.mouse.move(cx + math.cos(a) * r, cy + math.sin(a) * r)
        time.sleep(0.012)
    page.mouse.up()
    for ex in (-0.35, 0.35):
        page.mouse.move(cx + ex * r, cy - 0.3 * r); page.mouse.down(); page.mouse.move(cx + ex * r + 2, cy - 0.3 * r + 2); page.mouse.up()
        time.sleep(0.1)
    page.mouse.move(cx - 0.45 * r, cy + 0.25 * r); page.mouse.down()
    for i in range(1, 21):
        a = math.pi * 0.2 + i / 20 * math.pi * 0.6
        page.mouse.move(cx + math.cos(a) * r * 0.6, cy + math.sin(a) * r * 0.6)
        time.sleep(0.012)
    page.mouse.up()


def main():
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx = browser.new_context(viewport={"width": 1600, "height": 900}, record_video_dir=OUT_DIR,
                                  record_video_size={"width": 1600, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(BASE + "/tools/demo.html")
        page.wait_for_function("() => document.getElementById('phone').src.indexOf('#') > 0", timeout=30000)
        host = page.frame_locator("#host")
        phone = page.frame_locator("#phone")
        time.sleep(2.5)

        # Phone: name + drawing + join
        phone.locator("#nameIn").click()
        page.keyboard.type("Cooper", delay=90)
        time.sleep(0.6)
        box = phone.locator(".pad").bounding_box()
        draw_face(page, box)
        time.sleep(0.8)
        phone.locator("button[type=submit]").click()
        time.sleep(5)

        # Host: start the game
        host.locator("#startBtn").click()

        def play_question(pick_correct, react=True):
            st = wait_phase(page, "ask", 40)
            phone.locator(".pbtn").first.wait_for(timeout=15000)
            time.sleep(1.6)
            choice = st["c"] if pick_correct else (st["c"] + 1) % 4
            phone.locator(".pbtn").nth(choice).click()
            wait_phase(page, "reveal", 40)
            time.sleep(4.2)
            host.locator("#nextBtn").click()
            wait_phase(page, "board", 20)
            if react:
                time.sleep(1.4)
                for i in (0, 3, 1):
                    phone.locator("#rxbar button").nth(i).click()
                    time.sleep(0.7)
            time.sleep(2.4)
            host.locator("#nextBtn").click()

        play_question(True)
        play_question(False)
        play_question(True, react=False)

        # Skip to the end: winner reveal, podium, superlatives
        page.evaluate("() => document.getElementById('host').contentWindow.TRIVIA.jumpToEnd()")
        t0 = time.time()
        while time.time() - t0 < 30 and not host_state(page)["done"]:
            time.sleep(0.3)
        time.sleep(3.2)
        host.locator("#nextBtn").click()          # podium
        time.sleep(5.5)
        host.locator("#nextBtn").click()          # superlatives
        time.sleep(6.5)
        page.close()
        ctx.close()
        browser.close()

    webm = glob.glob(os.path.join(OUT_DIR, "*.webm"))[0]
    ff = shutil.which("ffmpeg")
    if ff:
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", FINAL], check=True)
    else:
        shutil.copy(webm, FINAL.replace(".mp4", ".webm"))
    print("saved", FINAL)


if __name__ == "__main__":
    main()
