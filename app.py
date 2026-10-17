"""
FastAPI Server for Gemini Canvas Artifact Extractor & Multi-Format Exporter
Supports PDF (Chromium High-Res), Word Document (.docx), Markdown, History Tracking & Print Optimization.
"""

import os
import io
import re
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import extractor
import pdf_generator
import docx_generator
import history_manager

app = FastAPI(
    title="Gemini Canvas Artifact Workbench",
    description="Extracts and renders complete text, Markdown tables, and ASCII art diagrams from Gemini Canvas share links with PDF, DOCX, and print export.",
    version="2.5.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# No-cache middleware to prevent browser from caching stale JS/CSS
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)


class ExtractRequest(BaseModel):
    url: str


class PDFExportRequest(BaseModel):
    title: str
    content: str
    theme: Optional[str] = "light"
    font_size: Optional[str] = "medium"
    page_format: Optional[str] = "A4"
    landscape: Optional[bool] = False
    include_header: Optional[bool] = True
    ascii_light_theme: Optional[bool] = True
    metadata: Optional[Dict[str, Any]] = None


class DocxExportRequest(BaseModel):
    title: str
    content: str
    ascii_light_theme: Optional[bool] = True
    metadata: Optional[Dict[str, Any]] = None


class HistoryItemRequest(BaseModel):
    id: Optional[str] = None
    share_id: Optional[str] = None
    url: Optional[str] = None
    title: str
    filename: Optional[str] = None
    word_count: Optional[int] = 0
    ascii_count: Optional[int] = 0
    table_count: Optional[int] = 0
    content: str
    timestamp: Optional[str] = None
    starred: Optional[bool] = False


@app.post("/api/extract")
async def extract_url(req: ExtractRequest):
    """
    Extracts all content, conversation turns, and Canvas artifacts from a Gemini share link.
    """
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Please provide a valid Gemini share URL or ID.")
        
    try:
        data = extractor.extract_gemini_content(url)
        
        # Automatically save to history
        if data.get("artifacts"):
            art = data["artifacts"][0]
            history_item = {
                "share_id": data.get("share_id", ""),
                "url": url,
                "title": art.get("title") or data.get("title") or "Gemini Canvas Artifact",
                "filename": art.get("filename") or "artifact.md",
                "word_count": art.get("word_count", 0),
                "ascii_count": data.get("ascii_count", 0),
                "table_count": data.get("table_count", 0),
                "content": art.get("content", ""),
            }
            saved_entry = history_manager.add_history_entry(history_item)
            data["history_id"] = saved_entry.get("id")
            data["starred"] = saved_entry.get("starred", False)
            
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/api/generate-pdf")
async def generate_pdf_endpoint(req: PDFExportRequest):
    """
    Converts extracted Markdown / Canvas artifact into a high-res vectorized PDF using Chromium.
    """
    try:
        html = pdf_generator.build_export_html(
            title=req.title,
            markdown_content=req.content,
            theme=req.theme or "light",
            font_size=req.font_size or "medium",
            include_header=req.include_header if req.include_header is not None else True,
            ascii_light_theme=bool(req.ascii_light_theme),
            metadata=req.metadata or {}
        )
        
        pdf_bytes = await pdf_generator.render_pdf_from_html(
            html_content=html,
            page_format=req.page_format or "A4",
            landscape=bool(req.landscape),
            footer_text=req.title
        )
        
        safe_filename = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', req.title or "gemini_canvas_export")
        if not safe_filename.lower().endswith(".pdf"):
            safe_filename += ".pdf"
            
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_filename}"'
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

@app.post("/api/export-html")
async def export_html_endpoint(req: PDFExportRequest):
    """
    Returns the complete, styled HTML document matching the PDF export for instant, exact print previews.
    """
    try:
        html = pdf_generator.build_export_html(
            title=req.title,
            markdown_content=req.content,
            theme=req.theme or "light",
            font_size=req.font_size or "medium",
            include_header=req.include_header if req.include_header is not None else True,
            ascii_light_theme=bool(req.ascii_light_theme),
            metadata=req.metadata or {}
        )
        return Response(content=html, media_type="text/html; charset=utf-8")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export HTML failed: {str(e)}")


@app.post("/api/generate-docx")
async def generate_docx_endpoint(req: DocxExportRequest):
    """
    Converts extracted Markdown / Canvas artifact into a formatted Microsoft Word (.docx) document.
    """
    try:
        docx_bytes = docx_generator.generate_docx(
            title=req.title,
            markdown_content=req.content,
            ascii_light_theme=bool(req.ascii_light_theme),
            metadata=req.metadata or {}
        )
        
        safe_filename = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', req.title or "gemini_canvas_export")
        if not safe_filename.lower().endswith(".docx"):
            safe_filename += ".docx"
            
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_filename}"'
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Word document generation failed: {str(e)}")


@app.get("/api/history")
async def get_history_endpoint():
    """Returns stored extraction history."""
    try:
        items = history_manager.get_history()
        return {"success": True, "history": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/history")
async def add_history_endpoint(item: HistoryItemRequest):
    """Saves or updates a history record."""
    try:
        saved = history_manager.add_history_entry(item.dict())
        return {"success": True, "item": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/history/{item_id}/star")
async def toggle_star_endpoint(item_id: str):
    """Toggles the starred/favorite status of a history item."""
    try:
        updated = history_manager.toggle_star_history_entry(item_id)
        if not updated:
            raise HTTPException(status_code=404, detail="History item not found")
        return {"success": True, "item": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/history/{item_id}")
async def delete_history_endpoint(item_id: str):
    """Deletes a specific history item."""
    try:
        deleted = history_manager.delete_history_entry(item_id)
        return {"success": True, "deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/history")
async def clear_history_endpoint():
    """Clears all stored history."""
    try:
        history_manager.clear_all_history()
        return {"success": True, "cleared": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/shutdown")
async def shutdown_server():
    """Gracefully shuts down the server process."""
    def kill_process():
        time.sleep(0.5)
        os.kill(os.getpid(), 9)
    import threading
    threading.Thread(target=kill_process, daemon=True).start()
    return {"success": True, "message": "Server is shutting down..."}



@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "gemini-canvas-extractor", "version": "2.5.0"}


# Mount static files and local KaTeX vendor fonts
FONTS_DIR = os.path.join(STATIC_DIR, "vendor", "fonts")
if os.path.exists(FONTS_DIR):
    app.mount("/fonts", StaticFiles(directory=FONTS_DIR), name="fonts")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
            cache_buster = f"?v={int(time.time())}"
            content = content.replace('/static/app.js', f'/static/app.js{cache_buster}')
            content = content.replace('/static/style.css', f'/static/style.css{cache_buster}')
            return content
    return "<h1>Gemini Canvas Extractor Frontend Building...</h1>"


if __name__ == "__main__":
    import uvicorn
    print("Starting Gemini Canvas Extractor server on http://localhost:8000 ...")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
