# Gemini Canvas Extractor

Paste a Gemini canvas share link and get a faithful document. Export PDF, Word, or print — math, tables, and diagrams intact.

Google Docs export and print-to-PDF from the Gemini web app often come out broken or blank. This app extracts the canvas content via the Gemini RPC endpoint and renders it cleanly, preserving Markdown, tables, ASCII diagrams, and math exactly as authored.

## Features

- Paste a Gemini share link → clean, faithful document in seconds
- One-click **PDF** export (high-resolution, via headless Chromium)
- One-click **Word (.docx)** export with math support (OMML)
- Exact **print** output plus copy-Markdown-to-clipboard
- Light and dark themes, per-diagram ASCII paper/terminal themes
- Local extraction **history** with search, reopen, and per-item export
- Monochrome, minimal interface — no accounts, no tracking

## Quickstart (run it on your machine)

**Requirements:** Python 3.10+, Google Chrome or Chromium (for PDF export).

```bash
# 1. Clone the repository
git clone https://github.com/sanirudh17/gemini-canvas-extractor.git
cd gemini-canvas-extractor

# 2. (Recommended) create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Install the headless browser used for PDF export
playwright install chromium

# 5. Start the local server
# Windows:
start.bat
# macOS / Linux:
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000** in your browser, paste a public Gemini share link, and hit **Extract**.

To stop the server on Windows, double-click `stop.bat` (or press `Ctrl+C` in the terminal).

## How it works

1. In the Gemini web app, open your canvas and create a share link.
2. Paste the link into the extractor and hit **Extract**.
3. The backend (`extractor.py`) pulls the conversation turns and canvas artifacts through the Gemini RPC endpoint, then renders Markdown + KaTeX math + monospace diagrams.
4. Export to **PDF** (`pdf_generator.py`, headless Chromium), **Word** (`docx_generator.py`, python-docx with MathML→OMML via `MML2OMML.XSL`), **print**, or copy the Markdown.

Every extraction is saved to a local history (`data/history.json`, created automatically). History never leaves your machine.

## API

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `POST` | `/api/extract` | Extract content from a share URL (`{"url": "..."}`) |
| `POST` | `/api/generate-pdf` | Render title + Markdown to PDF |
| `POST` | `/api/generate-docx` | Render title + Markdown to `.docx` |
| `GET` / `POST` | `/api/history` | List / save history entries |
| `DELETE` | `/api/history` `/api/history/{id}` | Clear all / delete one entry |
| `GET` | `/api/health` | Health check |

## Project structure

```
gemini-canvas-extractor/
├── app.py               # FastAPI server + API routes
├── extractor.py         # Gemini share-link RPC extraction
├── pdf_generator.py     # Markdown → HTML → PDF (Playwright Chromium)
├── docx_generator.py    # Markdown → .docx (python-docx + OMML math)
├── history_manager.py   # Local JSON history store (data/, auto-created)
├── MML2OMML.XSL         # MathML → OMML transform for Word exports
├── static/
│   ├── index.html       # UI markup
│   ├── style.css        # Monochrome light/dark design system
│   └── app.js           # Extraction, rendering, export, history logic
├── requirements.txt
├── start.bat / stop.bat # Windows helpers
└── README.md
```

## Privacy

Everything runs locally. Share links you paste are sent to Google's public endpoints only to fetch the shared content. Extraction history is stored in `data/history.json` on your machine and is git-ignored by default — it never ships with the repo.
