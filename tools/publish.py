"""Publish the committed site to Cloudflare Pages (the link to share) and GitHub Pages.

  https://shrmtrivia.pages.dev         Cloudflare Pages
  https://qwendor.github.io/trivia     GitHub Pages (updates on git push)

Only files tracked by git are published (so the dev cert never goes online). Commit first.

Usage: python tools/publish.py
"""
import io
import os
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = "shrmtrivia"
# wrangler is installed with the OpenAI Toolbox project and signed in to Cloudflare.
# Its login lives in %APPDATA%\xdg.config\.wrangler; wrangler sometimes reads ~/.wrangler instead,
# so the login file is mirrored there if missing.
WRANGLER = Path.home() / "Desktop" / "openai-toolbox-mcp" / "node_modules" / "wrangler" / "bin" / "wrangler.js"


def run(cmd, cwd):
    print(">", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, cwd=cwd, check=True)


def ensure_login():
    src = Path(os.environ.get("APPDATA", "")) / "xdg.config" / ".wrangler" / "config" / "default.toml"
    dst = Path.home() / ".wrangler" / "config" / "default.toml"
    if src.exists() and (not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)


def main() -> None:
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    if dirty:
        raise SystemExit("There are uncommitted changes. Commit them first:\n" + dirty)
    ensure_login()
    run(["git", "push", "origin", "main"], ROOT)
    dist = Path(tempfile.mkdtemp(prefix="trivia-pages-"))
    try:
        archive = subprocess.run(["git", "archive", "main"], cwd=ROOT, capture_output=True, check=True).stdout
        tarfile.open(fileobj=io.BytesIO(archive)).extractall(dist)
        (dist / ".gitignore").unlink(missing_ok=True)
        run(["node", str(WRANGLER), "pages", "deploy", ".", "--project-name", PROJECT, "--branch", "main", "--commit-dirty=true"], dist)
    finally:
        shutil.rmtree(dist, ignore_errors=True)
    print(f"\nLive at https://{PROJECT}.pages.dev")


if __name__ == "__main__":
    main()
