<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-333333.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/python-3.10%2B-333333.svg" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/built%20with-FastAPI-333333.svg" alt="Built with FastAPI" />
</p>

<h1 align="center">Gemini Canvas Extracter</h1>

<p align="center">
  <strong>Paste a Gemini canvas share link and get a faithful document.</strong><br/>
  Export PDF, Word, or print — math, tables, and diagrams intact. Everything runs locally.
</p>

---

## Overview

Gemini Canvas Extracter fixes the broken export path out of the Gemini web app, where Google Docs export mangles formatting and print-to-PDF comes out blank. Paste a canvas share link and get a clean document in seconds: Markdown, tables, ASCII diagrams, and math rendered exactly as authored, ready for PDF, Word (.docx), print, or clipboard.

The app is **local-first by design**. The server runs on your machine, extraction history lives in a local JSON file, and share links are sent to Google's public endpoints only to fetch the shared content — no accounts, no tracking.

> **New here?** Follow the [**Quickstart**](#quickstart) below — about five minutes, including the one-time browser download for PDF export.

## Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Quickstart](#quickstart)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Configuration & Data](#configuration--data)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

**Extract**

- **Paste a share link, get the document** — conversation turns and canvas artifacts pulled through the Gemini RPC endpoint.
- **Faithful rendering** — Markdown, GFM tables, KaTeX math, and monospace ASCII diagrams preserved exactly.
- **Copy Markdown** to the clipboard in one click, per-diagram copy included.

**Export**

- **PDF** — high-resolution vector output via headless Chromium, with exact print CSS.
- **Word (.docx)** — formatted document with MathML→OMML math via `MML2OMML.XSL`.
- **Print** — pixel-faithful print path that doesn't come out blank.

**Around the app**

- **History** with search, one-click reopen, and per-item PDF/Word export.
- **Light and dark themes**, plus per-diagram paper/terminal ASCII themes.
- **Monochrome, minimal interface** — single column, one primary action per row.

## How It Works

Everything between pasting a link and the document appearing runs as one pipeline:

```
  share link pasted
        │
        ▼
  extract ───────────────► Gemini RPC (ujx1Bf) returns turns + canvas artifacts
        │
        ▼
  render ────────────────► Markdown + KaTeX math + monospace diagrams in-page
        │
        ▼
  export ────────────────► PDF (headless Chromium) · Word (.docx + OMML) · print
        │
        ▼
  history ───────────────► saved to local data/history.json
```

Extraction history is written alongside every successful extract, so a document is never lost if you close the tab.

## Quickstart

**Requirements:** Python 3.10+.

```bash
# 1. Clone the repository
git clone https://github.com/sanirudh17/Gemini-Canvas-Extracted.git
cd Gemini-Canvas-Extracted

# 2. (Recommended) create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. One-time browser download for PDF export
playwright install chromium

# 5. Start the local server
# Windows:
start.bat
# macOS / Linux:
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000**, paste a public Gemini share link, and hit **Extract**. To stop the server on Windows, double-click `stop.bat` (or press `Ctrl+C` in the terminal).

## Tech Stack

- **Backend** — FastAPI + Uvicorn, Pydantic, httpx
- **PDF** — Playwright (headless Chromium) with dedicated print CSS
- **Word** — python-docx, MathML→OMML via `MML2OMML.XSL`
- **Frontend** — vanilla HTML/CSS/JS, Tailwind utilities, Marked, KaTeX, Lucide icons
- **Storage** — local JSON file (`data/history.json`, auto-created)

## Project Structure

```
Gemini-Canvas-Extracter/
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

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `POST` | `/api/extract` | Extract content from a share URL (`{"url": "..."}`) |
| `POST` | `/api/generate-pdf` | Render title + Markdown to PDF |
| `POST` | `/api/generate-docx` | Render title + Markdown to `.docx` |
| `GET` / `POST` | `/api/history` | List / save history entries |
| `DELETE` | `/api/history`, `/api/history/{id}` | Clear all / delete one entry |
| `GET` | `/api/health` | Health check |

## Configuration & Data

Everything lives next to the code — no config files, no environment variables:

- **History** — `data/history.json`, created automatically on first run. Delete the file (or use Clear all in the UI) to start fresh.
- **History never leaves your machine** and is git-ignored, so it never ships with the repo.

## Privacy

The server runs locally on `127.0.0.1`. Links you paste are fetched from Google's public share endpoints and nothing else. No accounts, no telemetry, no analytics.

## Troubleshooting

- **`playwright install chromium` fails** — install a system Chrome/Chromium instead and set `PLAYWRIGHT_BROWSERS_PATH`, or run `playwright install --with-deps chromium` on Linux for missing OS libraries.
- **PDF comes out blank** — make sure the Chromium download finished (`playwright install chromium`); check the server terminal for render errors.
- **Port 8000 already in use** — run `stop.bat`, or start on another port: `python -m uvicorn app:app --port 8001`.
- **Extraction failed / check the link is public** — the share link must be a public `share.gemini.google` link; private or expired links cannot be fetched.
- **Page shows stale styles after updating** — hard-refresh (`Ctrl+Shift+R`); the server sends no-cache headers, but the CDN scripts (Tailwind, KaTeX) need network access on first load.

## License

MIT — see [LICENSE](LICENSE).
