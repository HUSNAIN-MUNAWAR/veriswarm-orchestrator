"""Capture distinct screenshots from the running VeriSwarm UI.

This script only captures DOM rendered by the repository's own API and browser
application. It does not synthesize task cards or paint annotations over them.
"""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "demo" / "screenshots"
BASE_URL = os.environ.get("VERISWARM_BASE_URL", "http://127.0.0.1:4317")


def wait_for_text(page: Page, text: str) -> None:
    page.get_by_text(text, exact=True).wait_for(state="visible", timeout=15_000)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        browser = playwright.chromium.launch(headless=True, executable_path=executable)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page.goto(BASE_URL, wait_until="networkidle")
        wait_for_text(page, "Recent runs")

        page.get_by_role("button", name="Live execution").click()
        wait_for_text(page, "DURABLE RUN QUEUE")
        page.locator("#run-create").click()
        page.get_by_role("button", name="Create and queue").click()
        wait_for_text(page, "Task graph")
        page.wait_for_timeout(1200)
        page.locator("#refresh-run").click()
        page.wait_for_timeout(300)

        page.get_by_role("button", name="Live execution").click()
        wait_for_text(page, "DURABLE RUN QUEUE")
        page.screenshot(path=str(OUTPUT / "live-execution.png"), full_page=True)
        page.locator("[data-run]").first.click()
        wait_for_text(page, "Task graph")

        task_graph = page.locator("article.card").filter(has_text="Task graph").first
        execution_events = page.locator("article.card").filter(has_text="Execution events").first
        task_graph.screenshot(path=str(OUTPUT / "task-dag.png"))
        execution_events.screenshot(path=str(OUTPUT / "agent-trace.png"))

        page.screenshot(path=str(OUTPUT / "run-detail.png"), full_page=True)
        browser.close()
    print(f"Captured live execution, task DAG, and agent trace evidence in {OUTPUT}")


if __name__ == "__main__":
    main()
