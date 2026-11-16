"""Smoke test: load every view in headless Chromium (phone + desktop, normal + reduced motion),
collect console errors, and check the obvious layout traps.

    python tools/smoke.py [base-url]        default http://localhost:4366
"""
import sys, time, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4366"
problems = []


def check(cond, msg):
    if not cond:
        problems.append(msg)
    print(("ok   " if cond else "FAIL ") + msg)


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for motion in ("no-preference", "reduce"):
            for name, vp in (("phone", {"width": 375, "height": 667}), ("desktop", {"width": 1280, "height": 720})):
                ctx = b.new_context(viewport=vp, reduced_motion=motion, is_mobile=(name == "phone"), has_touch=(name == "phone"))
                page = ctx.new_page()
                errors = []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))

                # Landing
                page.goto(BASE + "/")
                page.wait_for_selector("#codeIn")
                time.sleep(1)
                q = page.evaluate("() => { const q = document.querySelector('.bg .qmark'); const cs = getComputedStyle(q); return {dur: cs.animationDuration, iter: cs.animationIterationCount, name: cs.animationName}; }")
                if motion == "reduce":
                    check(q["name"] == "none" or q["iter"] == "1", f"[{name}/{motion}] question mark does not loop under reduced motion ({q})")
                else:
                    check(q["dur"] == "14s", f"[{name}/{motion}] question mark floats slowly ({q['dur']})")
                box = page.locator("#codeIn").bounding_box()
                page.locator("#codeIn").scroll_into_view_if_needed()
                box2 = page.locator("#codeIn").bounding_box()
                check(box2 and 0 <= box2["y"] and box2["y"] + box2["height"] <= vp["height"], f"[{name}/{motion}] join code field reachable on the landing page")
                sw = page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
                check(sw, f"[{name}/{motion}] no horizontal overflow on landing")

                # Host (desktop only)
                if name == "desktop":
                    page.goto(BASE + "/?host=1&bots=6&fast")
                    page.wait_for_function("() => window.TRIVIA && TRIVIA.state().code", timeout=30000)
                    time.sleep(1)
                    check(page.evaluate("() => !!document.querySelector('#qr img, #qr canvas')"), f"[{name}/{motion}] host QR drawn")
                    check(page.evaluate("() => document.querySelectorAll('.pcard').length") == 6, f"[{name}/{motion}] host roster shows bots")
                    page.evaluate("() => TRIVIA.next()")
                    page.wait_for_function("() => TRIVIA.state().phase === 'ask'", timeout=20000)
                    page.wait_for_function("() => TRIVIA.state().phase === 'reveal'", timeout=20000)
                    check(page.evaluate("() => document.querySelectorAll('.opt .wall .mini').length") > 0, f"[{name}/{motion}] avatar wall filled on reveal")
                    page.evaluate("() => TRIVIA.next()")
                    page.wait_for_function("() => TRIVIA.state().phase === 'board'", timeout=10000)
                    check(page.evaluate("() => document.querySelectorAll('.row').length") == 6, f"[{name}/{motion}] leaderboard rows")
                    page.evaluate("() => TRIVIA.jumpToEnd()")
                    page.wait_for_function("() => TRIVIA.state().winnerDone", timeout=30000)
                    page.evaluate("() => TRIVIA.podium()")
                    time.sleep(0.5)
                    page.evaluate("() => TRIVIA.awards()")
                    time.sleep(0.5)
                    check(page.evaluate("() => TRIVIA.state().phase") == "awards", f"[{name}/{motion}] reached superlatives")

                # Player join screen (phone only)
                if name == "phone":
                    page.goto(BASE + "/#ZZZZ")
                    page.wait_for_selector("#nameIn")
                    time.sleep(1)
                    sw = page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
                    check(sw, f"[{name}/{motion}] no horizontal overflow on the join screen")
                    page.locator("button[type=submit]").scroll_into_view_if_needed()
                    bb = page.locator("button[type=submit]").bounding_box()
                    check(bb and bb["y"] + bb["height"] <= vp["height"], f"[{name}/{motion}] join button reachable")

                real = [e for e in errors if "peer" not in e.lower() and "websocket" not in e.lower() and "net::" not in e.lower()]
                check(not real, f"[{name}/{motion}] no console errors" + (": " + " | ".join(real)[:300] if real else ""))
                ctx.close()
        b.close()
    print("\n" + ("ALL GOOD" if not problems else f"{len(problems)} problem(s)"))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
