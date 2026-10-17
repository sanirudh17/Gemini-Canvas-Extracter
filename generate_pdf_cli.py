"""
CLI helper to generate PDF using Playwright in an isolated process.
Avoids any Windows asyncio event loop conflicts with FastAPI/Uvicorn.
"""

import sys
import os
import tempfile
import asyncio
from playwright.async_api import async_playwright

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
        context = await p.chromium.launch_persistent_context(
            user_data_dir=cache_dir,
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-extensions',
                '--no-first-run',
                '--disable-background-networking',
                '--disable-sync'
            ]
        )
        page = context.pages[0] if context.pages else await context.new_page()
        
        await page.set_content(html_content, wait_until='load', timeout=15000)
        await page.wait_for_timeout(100)
        
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
        await context.close()
        print("SUCCESS")

if __name__ == "__main__":
    asyncio.run(main())
