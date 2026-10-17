"""
PDF Generator using Playwright Chromium
Renders HTML/Markdown with KaTeX, styled tables, ASCII diagrams, and custom themes to PDF.
"""

import asyncio
import json
import os
import sys
import tempfile
import subprocess
from typing import Optional

_VENDOR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "vendor")

def _read_vendor_asset(filename: str) -> str:
    p = os.path.join(_VENDOR_DIR, filename)
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            pass
    return ""

_CACHED_MARKED_JS = _read_vendor_asset("marked.min.js")
_CACHED_KATEX_JS = _read_vendor_asset("katex.min.js")
_CACHED_KATEX_CSS = _read_vendor_asset("katex.min.css")
def build_export_html(
    title: str,
    markdown_content: str,
    theme: str = "light",
    font_size: str = "medium",
    include_header: bool = True,
    ascii_light_theme: bool = True,
    metadata: Optional[dict] = None
) -> str:
    """Builds a complete, self-contained HTML page ready for PDF rendering."""
    
    font_size_map = {
        "small": "12px",
        "medium": "14px",
        "large": "16px"
    }
    base_font_size = font_size_map.get(font_size, "14px")
    
    # ASCII diagram styling based on ascii_light_theme
    if ascii_light_theme:
        ascii_css = "pre { background: #f8fafc !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; border-left: 3px solid #3b82f6 !important; }"
    else:
        ascii_css = "pre { background: #090d16 !important; color: #38bdf8 !important; border: 1px solid #1e293b !important; border-left: 3px solid #3b82f6 !important; }"
    
    theme_css = f"""
      body {{ background-color: #ffffff; color: #1f2937; }}
      .header-bar {{ border-bottom: 2px solid #3b82f6; }}
      table th {{ background-color: #f1f5f9; color: #0f172a; }}
      table tr:nth-child(even) {{ background-color: #f8fafc; }}
      table td, table th {{ border-color: #cbd5e1; }}
      {ascii_css}
      blockquote {{ border-left-color: #3b82f6; background-color: #eff6ff; color: #1e3a8a; }}
      .katex {{ font-size: 1.05em; }}
    """
    if theme == "dark":
        theme_css = f"""
          body {{ background-color: #0b0f19; color: #e2e8f0; }}
          .header-bar {{ border-bottom: 2px solid #60a5fa; }}
          table th {{ background-color: #1e293b; color: #f8fafc; }}
          table tr:nth-child(even) {{ background-color: #111827; }}
          table td, table th {{ border-color: #334155; }}
          {ascii_css}
          blockquote {{ border-left-color: #60a5fa; background-color: #172554; color: #93c5fd; }}
          h1, h2, h3, h4, h5, h6 {{ color: #f8fafc; }}
          .katex {{ color: #f8fafc; font-size: 1.05em; }}
        """
    elif theme == "sepia":
        theme_css = """
          body { background-color: #fbf0d9; color: #433422; }
          .header-bar { border-bottom: 2px solid #b45309; }
          table th { background-color: #eedcc0; color: #433422; }
          table tr:nth-child(even) { background-color: #f5e6ce; }
          table td, table th { border-color: #d7c1a2; }
          pre { background: #2d241e; color: #fef3c7; border: 1px solid #45372b; }
          blockquote { border-left-color: #b45309; background-color: #f5e5cc; color: #78350f; }
          .katex { font-size: 1.05em; }
        """

    meta_html = ""
    if include_header and metadata:
        meta_items = []
        if metadata.get("share_id"):
            meta_items.append(f"<span><strong>Share ID:</strong> {metadata['share_id']}</span>")
        if metadata.get("filename"):
            meta_items.append(f"<span><strong>File:</strong> {metadata['filename']}</span>")
        if metadata.get("word_count"):
            meta_items.append(f"<span><strong>Words:</strong> {metadata['word_count']:,}</span>")
        if metadata.get("ascii_count"):
            meta_items.append(f"<span><strong>ASCII Diagrams:</strong> {metadata['ascii_count']}</span>")
            
        meta_html = f"""
        <div class="header-bar" style="margin-bottom: 24px; padding-bottom: 12px; display: flex; justify-content: space-between; font-size: 11px; opacity: 0.85; flex-wrap: wrap; gap: 12px;">
            <div>
                <span style="font-weight: 700; color: #3b82f6; font-size: 13px;">Gemini Canvas Artifact</span>
                <span style="margin-left: 8px; color: #64748b;">• Exported Document</span>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                {' '.join(meta_items)}
            </div>
        </div>
        """

    safe_markdown_json = json.dumps(markdown_content).replace("</", "<\\/").replace("<!--", "<\\!--")
    if _CACHED_MARKED_JS and _CACHED_KATEX_JS and _CACHED_KATEX_CSS:
        vendor_scripts_html = f"""<style>{_CACHED_KATEX_CSS}</style>
<script>{_CACHED_MARKED_JS}</script>
<script>{_CACHED_KATEX_JS}</script>"""
    else:
        vendor_scripts_html = """<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
{vendor_scripts_html}
<style>
  @page {{
    size: A4 portrait;
    margin: 15mm 15mm 18mm 15mm;
  }}
  * {{
    box-sizing: border-box;
  }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: {base_font_size};
    line-height: 1.65;
    padding: 0;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}
  {theme_css}
  
  h1, h2, h3, h4, h5, h6 {{
    font-weight: 700;
    line-height: 1.3;
    margin-top: 1.6em;
    margin-bottom: 0.5em;
    page-break-after: avoid;
    break-after: avoid;
  }}
  h1 {{ font-size: 1.75em; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }}
  h2 {{ font-size: 1.4em; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }}
  h3 {{ font-size: 1.18em; }}
  h4 {{ font-size: 1.05em; }}
  
  p, ul, ol {{
    margin-top: 0;
    margin-bottom: 1em;
  }}
  li {{
    margin-bottom: 0.35em;
  }}
  
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1.4em 0;
    page-break-inside: avoid;
    break-inside: avoid;
    font-size: 0.9em;
  }}
  th, td {{
    border: 1px solid;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
  }}
  th {{
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.8em;
    letter-spacing: 0.04em;
  }}
  
  pre {{
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-family: 'Consolas', 'Cascadia Code', 'Courier New', 'Segoe UI Symbol', monospace !important;
    font-size: 0.80em;
    line-height: 1.36;
    letter-spacing: 0px !important;
    font-variant-ligatures: none !important;
    white-space: pre !important;
    word-break: normal;
    word-wrap: normal;
    page-break-inside: avoid;
    break-inside: avoid;
    margin: 1.3em 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }}
  code {{
    font-family: 'Consolas', 'Cascadia Code', 'Courier New', 'Segoe UI Symbol', monospace !important;
    font-size: 0.9em;
  }}
  p > code, li > code {{
    background: rgba(148, 163, 184, 0.18);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.88em;
  }}
  
  blockquote {{
    border-left: 4px solid;
    margin: 1.2em 0;
    padding: 10px 18px;
    border-radius: 0 6px 6px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }}
  
  .katex-display-wrapper {{
    margin: 1.3em 0;
    text-align: center;
    overflow-x: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }}
  
  hr {{
    border: 0;
    height: 1px;
    background: #cbd5e1;
    margin: 2em 0;
  }}
</style>
</head>
<body>
{meta_html}
<div id="content"></div>
<script>
(function() {{
  const rawMarkdown = {safe_markdown_json};

  function renderRobustMarkdown(markdownText) {{
    const codeBlocks = [];
    const inlineCodes = [];
    const mathBlocks = [];
    
    // 1. Protect fenced code blocks (```...```)
    let text = markdownText.replace(/```([\\s\\S]*?)```/g, (match) => {{
      const id = `%%CODE_BLOCK_${{codeBlocks.length}}%%`;
      codeBlocks.push({{ id, code: match }});
      return id;
    }});
    
    // 2. Protect inline code (`...`)
    text = text.replace(/`([^`\\n]+?)`/g, (match) => {{
      const id = `%%INLINE_CODE_${{inlineCodes.length}}%%`;
      inlineCodes.push({{ id, code: match }});
      return id;
    }});
    
    // 3. Protect display math ($$...$$)
    text = text.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, (match, math) => {{
      const id = `%%KATEX_BLOCK_${{mathBlocks.length}}%%`;
      try {{
        const rendered = katex.renderToString(math.trim(), {{ displayMode: true, throwOnError: false }});
        mathBlocks.push({{ id, html: `<div class="katex-display-wrapper">${{rendered}}</div>` }});
      }} catch (e) {{
        mathBlocks.push({{ id, html: `<div class="katex-display-wrapper katex-error">${{math}}</div>` }});
      }}
      return id;
    }});
    
    // 4. Protect inline math ($...$)
    text = text.replace(/\\$([^\\$\\n\\r]+?)\\$/g, (match, math) => {{
      if (!math.trim()) return match;
      const id = `%%KATEX_INLINE_${{mathBlocks.length}}%%`;
      try {{
        const rendered = katex.renderToString(math.trim(), {{ displayMode: false, throwOnError: false }});
        mathBlocks.push({{ id, html: rendered }});
      }} catch (e) {{
        mathBlocks.push({{ id, html: `<span>${{math}}</span>` }});
      }}
      return id;
    }});
    
    // 5. Restore code blocks
    codeBlocks.forEach(({{ id, code }}) => {{
      text = text.replaceAll(id, code);
    }});
    inlineCodes.forEach(({{ id, code }}) => {{
      text = text.replaceAll(id, code);
    }});
    
    // 6. Parse Markdown with marked
    marked.setOptions({{ gfm: true, breaks: true }});
    let html = marked.parse(text);
    
    // 7. Restore KaTeX rendered HTML
    mathBlocks.forEach(({{ id, html: mathHtml }}) => {{
      html = html.replaceAll(id, mathHtml);
    }});
    
    return html;
  }}

  const container = document.getElementById('content');
  if (container) {{
    container.innerHTML = renderRobustMarkdown(rawMarkdown);
  }}
}})();
</script>
</body>
</html>
"""
    return html


def _run_pdf_cli_sync(cli_args):
    """Executes the PDF generation CLI synchronously in a worker thread."""
    return subprocess.run(
        cli_args,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )


async def render_pdf_from_html(
    html_content: str,
    page_format: str = "A4",
    landscape: bool = False,
    footer_text: str = "Gemini Canvas Extractor"
) -> bytes:
    """
    Renders HTML to PDF using a worker thread executing Playwright CLI.
    Completely eliminates Windows asyncio event loop and SelectorEventLoop conflicts.
    """
    # Create temporary files
    with tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w', encoding='utf-8') as f_html:
        f_html.write(html_content)
        html_path = f_html.name
        
    pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
    os.close(pdf_fd)
    
    cli_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_pdf_cli.py")
    
    try:
        # Run CLI in a worker thread via asyncio.to_thread (works on ALL loops including Windows Selector)
        proc = await asyncio.to_thread(_run_pdf_cli_sync, [
            sys.executable,
            cli_path,
            html_path,
            pdf_path,
            page_format,
            str(landscape),
            footer_text
        ])
        
        if proc.returncode != 0:
            error_msg = proc.stderr or proc.stdout or "Unknown error"
            raise RuntimeError(f"PDF generator subprocess exited with code {proc.returncode}: {error_msg}")
            
        if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
            raise RuntimeError("PDF generator did not produce a valid output file.")
            
        with open(pdf_path, 'rb') as f_pdf:
            pdf_bytes = f_pdf.read()
            
        return pdf_bytes
        
    finally:
        # Clean up temp files
        for p in [html_path, pdf_path]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

