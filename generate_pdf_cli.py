"""
CLI helper to generate PDF using Playwright in an isolated process.
Avoids any Windows asyncio event loop conflicts with FastAPI/Uvicorn.

Resilient to Playwright browser updates: falls back to a system
Microsoft Edge / Google Chrome executable when the bundled
Chromium headless-shell is missing (e.g. after `pip install -U playwright`
without `playwright install`).
"""

import sys
import os
import tempfile
import asyncio
import glob
from playwright.async_api import async_playwright


def find_system_browser() -> str | None:
    """Locate a system Chromium-based browser on Windows (or $PATH)."""
    candidates = []
    # Env override
    env_exe = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH") or os.environ.get("CHROME_PATH")
    if env_exe:
        candidates.append(env_exe)

    # Well-known Windows locations (64/32-bit, Edge/Chrome)
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))

    candidates += [
        os.path.join(program_files, r"Microsoft\Edge\Application\msedge.exe"),
        os.path.join(program_files_x86, r"Microsoft\Edge\Application\msedge.exe"),
        os.path.join(program_files, r"Google\Chrome\Application\chrome.exe"),
        os.path.join(program_files_x86, r"Google\Chrome\Application\chrome.exe"),
        os.path.join(local_app_data, r"Google\Chrome\Application\chrome.exe"),
        os.path.join(local_app_data, r"Microsoft\Edge\Application\msedge.exe"),
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]

    for path in candidates:
        if path and os.path.isfile(path):
            return path

    # Playwright-managed Chromium (full Chrome for Testing, usable with headless?)
    # Glob any chromium-*/chrome-win*/chrome.exe under ms-playwright
    pw_root = os.path.join(local_app_data, "ms-playwright")
    if os.path.isdir(pw_root):
        for pattern in (
            os.path.join(pw_root, "chromium-*", "chrome-win*", "chrome.exe"),
            os.path.join(pw_root, "chromium-*", "chrome-win64", "chrome.exe"),
            os.path.join(pw_root, "chromium-*", "chrome-win", "*.exe"),
        ):
            hits = glob.glob(pattern)
            for h in hits:
                if os.path.isfile(h):
                    return h

    return None


def playwright_browser_installed() -> bool:
    """Check whether Playwright's headless-shell / chromium executable exists."""
    local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
    pw_root = os.path.join(local_app_data, "ms-playwright")
    if not os.path.isdir(pw_root):
        return False
    # Any chrome-headless-shell.exe or chrome.exe inside
    for pattern in (
        os.path.join(pw_root, "chromium_headless_shell-*", "**", "chrome-headless-shell.exe"),
        os.path.join(pw_root, "chromium-*", "**", "chrome.exe"),
    ):
        if glob.glob(pattern, recursive=True):
            return True
    return False


async def launch_context(p, user_data_dir: str):
    base_args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--disable-background-networking',
        '--disable-sync'
    ]

    # 1) Try Playwright's bundled Chromium first (default behaviour)
    try:
        return await p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=True,
            args=base_args,
        )
    except Exception as e:
        msg = str(e)
        is_missing_exe = ("Executable doesn't exist" in msg) or ("executable doesn't exist" in msg.lower())
        if not is_missing_exe:
            raise

    # 2) Fallback: use a system Edge/Chrome so PDF gen keeps working
    #    even when `playwright install` hasn't been re-run after an update.
    sys_exe = find_system_browser()
    if not sys_exe:
        raise RuntimeError(
            "Playwright Chromium executable not found and no system Chrome/Edge found. "
            "Run 'python -m playwright install chromium' (requires internet) or install "
            "Google Chrome / Microsoft Edge. Original error: Playwright browser missing "
            "(chromium_headless_shell-*/chrome-headless-shell.exe). "
            "See https://playwright.dev/python/docs/cli"
        )

    # launch_persistent_context with explicit executable_path.
    # NOTE: some branded Edge/Chrome builds need --headless=new? Playwright handles headless.
    try:
        return await p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=True,
            executable_path=sys_exe,
            args=base_args,
        )
    except Exception as fallback_err:
        raise RuntimeError(
            f"Playwright Chromium missing and system browser fallback failed ({sys_exe}). "
            f"Run 'python -m playwright install chromium' to install the bundled browser. "
            f"Original: {fallback_err}"
        ) from fallback_err


async def main():
    if len(sys.argv) < 3:
        print("Usage: generate_pdf_cli.py <input_html_file> <output_pdf_file> [page_format] [landscape] [footer_text]")
        sys.exit(1)

    input_html_file = sys.argv[1]
    output_pdf_file = sys.argv[2]
    page_format = sys.argv[3] if len(sys.argv) > 3 else "A4"
    landscape = sys.argv[4].lower() == "true" if len(sys.argv) > 4 else False
    footer_text = sys.argv[5] if len(sys.argv) > 5 else "Gemini Canvas Extractor"

    with open(input_html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()

    cache_dir = os.path.join(tempfile.gettempdir(), "gemini_canvas_chromium_cache")
    os.makedirs(cache_dir, exist_ok=True)

    async with async_playwright() as p:
        context = await launch_context(p, cache_dir)
        try:
            page = context.pages[0] if context.pages else await context.new_page()

            await page.set_content(html_content, wait_until='load', timeout=15000)
            await page.wait_for_timeout(100)

            # Ensure output directory exists
            out_dir = os.path.dirname(os.path.abspath(output_pdf_file))
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)

            await page.pdf(
                path=output_pdf_file,
                format=page_format,
                landscape=landscape,
                margin={
                    'top': '18mm',
                    'bottom': '18mm',
                    'left': '16mm',
                    'right': '16mm'
                },
                display_header_footer=True,
                header_template='<div style="font-size: 8px; color: #94a3b8; width: 100%; text-align: right; padding-right: 16mm;">' + footer_text + '</div>',
                footer_template='<div style="font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm;"><span>Gemini Canvas Export</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
                print_background=True
            )
        finally:
            await context.close()
        print("SUCCESS")


if __name__ == "__main__":
    asyncio.run(main())
