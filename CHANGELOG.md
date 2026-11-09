# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.1] - 2026-11-09

### Fixed
- **PDF generation crashed with `Executable doesn't exist ... chrome-headless-shell.exe`** after Playwright was updated (`1.61.0`) without re-running `playwright install`. Reinstalled Chromium (`python -m playwright install chromium`) and hardened `generate_pdf_cli.py`:
  - Falls back to a system Microsoft Edge / Google Chrome (`executable_path`) when the bundled Chromium headless-shell is missing.
  - Honors `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` / `CHROME_PATH` overrides.
  - Returns a clear `Run: python -m playwright install chromium` hint instead of a raw 500 stack trace.
- **Actionable PDF errors** (`pdf_generator.py`): missing-browser detection with 600-char details and trimmed UI-facing message.
- **`/health` returned 404** (only `/api/health` existed): added `GET /health` alias returning the same health payload.
- **Favicon 404 noise**: added `GET /favicon.ico → 204`.

### Changed
- Bumped service version `2.5.0` → `2.5.1` (`app.py` FastAPI metadata + health payloads).

### Verified
- `GET /api/health`, `GET /health`, `GET /favicon.ico`, `POST /api/generate-pdf` (200, `%PDF-1.4`), and `POST /api/generate-docx` (200) on `http://127.0.0.1:8000`.

## [2.5.0]
- Previous release: document notes, math rendering fixes, and history drawer UI polish.
