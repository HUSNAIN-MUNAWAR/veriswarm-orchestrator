"""Render Mermaid sources to committed SVG assets using a real browser renderer."""

from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "docs" / "architecture"
OUTPUT_DIR = ROOT / "docs" / "assets" / "architecture"
MERMAID_URL = os.environ.get(
    "VERISWARM_MERMAID_URL",
    "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs",
)


def safe_id(name: str) -> str:
    return "diagram_" + re.sub(r"[^a-zA-Z0-9_]", "_", name)


async def render_all() -> None:
    sources = sorted(SOURCE_DIR.glob("*.mmd"))
    if not sources:
        raise SystemExit("No Mermaid sources found")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1800, "height": 1200})
        await page.set_content(
            f"""<!doctype html>
            <html><body><div id="stage"></div>
            <script type="module">
              import mermaid from "{MERMAID_URL}";
              mermaid.initialize({{ startOnLoad: false, securityLevel: "loose", theme: "dark" }});
              window.renderMermaid = async (id, source) => {{
                const result = await mermaid.render(id, source);
                document.querySelector('#stage').innerHTML = result.svg;
                return result.svg;
              }};
            </script></body></html>""",
            wait_until="domcontentloaded",
        )
        await page.wait_for_function("window.renderMermaid !== undefined", timeout=30000)

        manifest = []
        for source_path in sources:
            source = source_path.read_text(encoding="utf-8")
            svg = await page.evaluate(
                """async ({id, source}) => await window.renderMermaid(id, source)""",
                {"id": safe_id(source_path.stem), "source": source},
            )
            if not svg or "<svg" not in svg:
                raise RuntimeError(f"Mermaid returned no SVG for {source_path.name}")
            output_path = OUTPUT_DIR / f"{source_path.stem}.svg"
            output_path.write_text(svg, encoding="utf-8")
            manifest.append({"source": str(source_path.relative_to(ROOT)), "output": str(output_path.relative_to(ROOT))})

        (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        await browser.close()
    print(json.dumps({"rendered": len(manifest), "output": str(OUTPUT_DIR.relative_to(ROOT))}))


if __name__ == "__main__":
    asyncio.run(render_all())
