"""Capture genuine VeriSwarm screenshots and a browser walkthrough."""

from __future__ import annotations

import json
import hashlib
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None

ROOT = Path(__file__).resolve().parents[1]
PORT = 4321
BASE_URL = f"http://127.0.0.1:{PORT}"
SCREENSHOTS = ROOT / "docs" / "assets" / "screenshots"
DEMO_ASSETS = ROOT / "docs" / "assets" / "demo"
VIDEO_TMP = ROOT / "data" / "showcase-video"


def wait_for_api() -> None:
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            with urlopen(f"{BASE_URL}/api/health", timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("VeriSwarm API did not become healthy on port 4321")


def start_api() -> subprocess.Popen[str] | None:
    try:
        with urlopen(f"{BASE_URL}/api/health", timeout=1):
            return None
    except Exception:
        env = os.environ.copy()
        env.update({"PORT": str(PORT), "VERISWARM_PROVIDER": "mock", "VERISWARM_DATA_DIR": str(ROOT / "data" / "showcase")})
        return subprocess.Popen(["node", "node_modules/tsx/dist/cli.mjs", "apps/api/src/server.ts"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)


def assert_visible(page, text: str) -> None:
    try:
        page.get_by_text(text, exact=False).first.wait_for(state="visible", timeout=8000)
    except PlaywrightTimeoutError as error:
        raise AssertionError(f"Expected visible application content: {text}") from error


def click_view(page, label: str) -> None:
    page.locator(".nav-item", has_text=label).click()
    page.wait_for_timeout(250)


def seed(page, requires_approval: bool = False) -> str:
    response = page.request.post(f"{BASE_URL}/api/showcase/seed", data={"requiresApproval": requires_approval, "riskScore": 0.6})
    if not response.ok:
        raise RuntimeError(f"showcase seed failed: {response.status} {response.text()}")
    return response.json()["id"]


def media_duration(path: Path, ffmpeg: Path) -> float:
    probe = subprocess.run([str(ffmpeg), "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", probe.stderr)
    if not match:
        raise RuntimeError(f"Could not read media duration from {path}")
    hours, minutes, seconds = match.groups()
    return round(int(hours) * 3600 + int(minutes) * 60 + float(seconds), 2)


def main() -> None:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    DEMO_ASSETS.mkdir(parents=True, exist_ok=True)
    VIDEO_TMP.mkdir(parents=True, exist_ok=True)
    for existing in SCREENSHOTS.glob("*.png"):
        existing.unlink()
    for existing in VIDEO_TMP.glob("*.webm"):
        existing.unlink()
    api_process = start_api()
    wait_for_api()
    video_path = None
    console_errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900}, record_video_dir=str(VIDEO_TMP), record_video_size={"width": 1440, "height": 900})
            page = context.new_page()
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.goto(BASE_URL, wait_until="networkidle")
            assert_visible(page, "DEMO MODE")
            assert_visible(page, "Total experiments")

            run_id = seed(page)
            page.wait_for_timeout(1400)
            page.reload(wait_until="networkidle")
            assert_visible(page, "Recent experiment history")
            page.screenshot(path=str(SCREENSHOTS / "01-overview.png"), full_page=True)

            click_view(page, "Live execution")
            assert_visible(page, "Live execution state")
            page.locator("#run-select").select_option(run_id)
            page.wait_for_timeout(900)
            page.screenshot(path=str(SCREENSHOTS / "02-live-execution.png"), full_page=True)
            page.locator("[data-live-mode='dag']").click()
            assert_visible(page, "Task dependency graph")
            page.screenshot(path=str(SCREENSHOTS / "03-task-dag.png"), full_page=True)
            page.locator("[data-live-mode='trace']").click()
            assert_visible(page, "Agent trace / provenance")
            page.screenshot(path=str(SCREENSHOTS / "04-agent-trace.png"), full_page=True)

            seed(page, requires_approval=True)
            page.wait_for_timeout(900)
            click_view(page, "Approval center")
            assert_visible(page, "Pending decisions")
            assert_visible(page, "Approve")
            page.screenshot(path=str(SCREENSHOTS / "05-approval-center.png"), full_page=True)

            click_view(page, "Prompt lab")
            assert_visible(page, "Versioned agent instructions")
            page.screenshot(path=str(SCREENSHOTS / "06-prompt-lab.png"), full_page=True)

            click_view(page, "Evaluation lab")
            assert_visible(page, "Strategy comparison")
            page.screenshot(path=str(SCREENSHOTS / "07-evaluation-lab.png"), full_page=True)

            click_view(page, "Architecture")
            assert_visible(page, "Implemented architecture map")
            page.screenshot(path=str(SCREENSHOTS / "08-architecture.png"), full_page=True)

            click_view(page, "Reproducibility")
            assert_visible(page, "Experiment configuration")
            page.screenshot(path=str(SCREENSHOTS / "09-reproducibility.png"), full_page=True)

            click_view(page, "Evidence explorer")
            assert_visible(page, "Verifier record")
            page.screenshot(path=str(SCREENSHOTS / "10-evidence-inspector.png"), full_page=True)

            mobile = context.new_page()
            mobile.set_viewport_size({"width": 390, "height": 844})
            mobile.goto(BASE_URL, wait_until="networkidle")
            assert_visible(mobile, "DEMO MODE")
            mobile.screenshot(path=str(SCREENSHOTS / "11-mobile.png"), full_page=True)

            page.set_viewport_size({"width": 1440, "height": 900})
            page.goto(BASE_URL, wait_until="networkidle")
            page.wait_for_timeout(900)
            for label in ["Live execution", "Evidence explorer", "Evaluation lab", "Architecture", "Command center"]:
                click_view(page, label)
                page.wait_for_timeout(9000)
            context.close()
            video_path = page.video.path()
            browser.close()
    finally:
        if api_process:
            api_process.terminate()
            try:
                api_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                api_process.kill()

    if console_errors:
        raise RuntimeError("Browser console errors: " + " | ".join(console_errors[:5]))
    required = [SCREENSHOTS / f"{index:02d}-{name}.png" for index, name in [(1, "overview"), (2, "live-execution"), (3, "task-dag"), (4, "agent-trace"), (5, "approval-center"), (6, "prompt-lab"), (7, "evaluation-lab"), (8, "architecture"), (9, "reproducibility"), (10, "evidence-inspector"), (11, "mobile")]]
    missing = [str(path) for path in required if not path.exists() or path.stat().st_size < 10_000]
    if missing:
        raise RuntimeError("Screenshot capture incomplete: " + ", ".join(missing))
    screenshot_hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in required}
    focus_hashes = [screenshot_hashes[name] for name in ["02-live-execution.png", "03-task-dag.png", "04-agent-trace.png"]]
    if len(set(focus_hashes)) != 3:
        raise RuntimeError("Focused live/DAG/trace screenshots are not distinct: " + ", ".join(focus_hashes))
    if not video_path or not Path(video_path).exists():
        raise RuntimeError("Playwright did not produce a browser video")

    ffmpeg = Path(os.environ.get("VERISWARM_FFMPEG", "")) if os.environ.get("VERISWARM_FFMPEG") else Path(imageio_ffmpeg.get_ffmpeg_exe()) if imageio_ffmpeg else Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright" / "ffmpeg-1011" / "ffmpeg-win64.exe"
    if not ffmpeg.exists():
        ffmpeg = Path(shutil.which("ffmpeg") or "")
    if not ffmpeg.exists():
        raise RuntimeError("FFmpeg is required to encode the Playwright recording")
    mp4 = DEMO_ASSETS / "veriswarm-demo.mp4"
    gif = DEMO_ASSETS / "veriswarm-walkthrough.gif"
    poster = DEMO_ASSETS / "demo-poster.png"
    subprocess.run([str(ffmpeg), "-y", "-i", str(video_path), "-vf", "scale=1280:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)], check=True, capture_output=True)
    subprocess.run([str(ffmpeg), "-y", "-i", str(video_path), "-t", "12", "-vf", "fps=8,scale=900:-1:flags=lanczos", str(gif)], check=True, capture_output=True)
    subprocess.run([str(ffmpeg), "-y", "-ss", "00:00:03", "-i", str(video_path), "-frames:v", "1", str(poster)], check=True, capture_output=True)
    screenshot_evidence = [{"file": path.name, "sha256": screenshot_hashes[path.name], "intent": {"01-overview.png": "command center and truth banner", "02-live-execution.png": "persisted live execution state and transitions", "03-task-dag.png": "persisted dependency graph and task states", "04-agent-trace.png": "provider/tool provenance and independent verifier", "05-approval-center.png": "approval interruption", "06-prompt-lab.png": "versioned instructions", "07-evaluation-lab.png": "measured development comparison", "08-architecture.png": "implemented/proposed boundary", "09-reproducibility.png": "experiment contract and limits", "10-evidence-inspector.png": "artifact and verifier evidence", "11-mobile.png": "responsive control plane"}[path.name]} for path in required]
    video_duration = media_duration(mp4, ffmpeg)
    gif_duration = media_duration(gif, ffmpeg)
    manifest = {"capture": "Playwright Chromium", "baseUrl": BASE_URL, "viewport": "1440x900", "runId": run_id, "provider": "MockAgentProvider", "truth": "deterministic fixture evidence", "screenshotIdentityCheck": "02/03/04 SHA-256 values are required to differ", "screenshotEvidence": screenshot_evidence, "gifDurationSeconds": gif_duration, "videoDurationSeconds": video_duration, "mediaIntent": {"gif": "8-12 second README preview", "mp4": "60-90 second complete research walkthrough"}, "screenshots": [path.name for path in required], "video": str(mp4.relative_to(ROOT)), "gif": str(gif.relative_to(ROOT)), "poster": str(poster.relative_to(ROOT)), "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    (DEMO_ASSETS / "capture-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"screenshots": len(required), "video": str(mp4), "gif": str(gif), "poster": str(poster), "runId": run_id}, indent=2))


if __name__ == "__main__":
    main()
