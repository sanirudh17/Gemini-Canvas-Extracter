# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2026-11-19

### Added
- **Unified Math and LaTeX Renderer (`static/math_renderer.js`)**: Shared single-source-of-truth Markdown and KaTeX pipeline used across live web preview, print preview, and PDF export.
  - Escape-aware character scanner supporting `$$...$$` (including trailing escaped dollars such as `$$y_{k+1} = \$, z_{k+1} = * \$$$` and Gemini's truncated `\$$`), `$...$` (including `$\$$`, `$*\$$`, `\\$`, and currency protection for prose like `$5 and $10`), `\(...\)`, guarded `\[...\]` (without breaking escaped Markdown tags like `\[MCQ\]` or `\[CO3\]`), and standalone LaTeX environments (`align`, `equation`, `cases`, `gather`, `matrix`, `pmatrix`, `bmatrix`, `array`, etc.).
  - Full Unicode math and Greek normalization both in math mode and safely inside `\text{...}` commands, plus automatic escaping of `&`, `%`, `#`, and `$` inside text commands.
  - Extended KaTeX macros (`\R`, `\N`, `\Z`, `\Q`, `\C`, `\bigO`, `\argmax`, `\argmin`, `\Var`, `\Cov`, `\abs`, `\norm`, `\ceil`, `\floor`, `\dv`, `\pdv`, etc.) and bare LaTeX symbol recovery (`\neq`, `\Sigma`, `\sigma`, `\emptyset`, and related commands).
  - Callback-based placeholder restoration so `$&`, `$$`, and `$'` inside math HTML or code blocks never corrupt rendered output.
- **Embedded KaTeX Fonts for PDF and Print (`pdf_generator.py`, `generate_pdf_cli.py`)**: All 20 local KaTeX `.woff2` fonts are embedded as base64 data URIs into exported HTML and `document.fonts.ready` is awaited before PDF generation so mathematical glyphs render identically offline and on `about:blank`.
- **Chronological History Grouping**: Saved documents in the History drawer are automatically grouped into `Today`, `Yesterday`, `This Week`, and `Earlier` sections with live search across titles, notes, and content (`/` shortcut when open).
- **Smooth Sliding Segmented Controls**: Added GPU-composited `translate3d` sliding pill animations for `ASCII Light | ASCII Dark` and the History drawer `All | Starred` filter bar, plus copy-to-clipboard confirmation state swaps.

### Changed
- **Minimal Monochrome Design System (`static/index.html`, `static/style.css`, `static/app.js`)**:
  - Strengthened 5-step achromatic dark-mode contrast (`#090909` canvas, `#121212` recessed wells, `#1e1e1e` elevated cards with top hairline highlight, `#2a2a2a` hover state, `#333333` / `#525252` borders) alongside the archival light theme (`#f2f2f2` ground, `#ffffff` cards).
  - Softened segmented slider colors in both themes to calm elevated thumbs (`#ffffff` in light, `#2b2b2b` in dark) instead of stark black/white inversion.
  - Streamlined the landing page around the centered `Extract any Gemini Canvas.` hero, extract card, and minimal `PDF / DOCX / PRINT` footer, removing redundant eyebrows, helper text, and filler cards.
  - Replaced the Lucide `sparkles` icon in the brand mark, Extract button, and loading spinner with a custom outlined double four-point sparkle SVG.
  - Compacted and unified the document action bar (`PDF`, `Word | Print | Copy`, `Star`, `Note`) to matched proportions and single-line metadata.
  - Switched live preview scripts and styles in `static/index.html` to local `/static/vendor/` KaTeX and Marked assets and removed the unused `cdn.tailwindcss.com` Play-CDN script.
- **Service Version**: Bumped FastAPI metadata and health endpoints from `2.5.1` to `2.6.0`.

### Fixed
- **1.5-Second Light/Dark Theme Switch Lag**: Eliminated the delay by removing the unused Tailwind Play-CDN `MutationObserver` and replacing full-DOM `lucide.createIcons()` rescans on theme toggles with inline SVGs (measured at ~20-30 ms across paint frames).
- **History and Starred Drawer Scroll Lag**: Removed full-screen overlay `backdrop-filter: blur()`, added CSS containment (`contain: strict`, `content-visibility: auto`), eliminated hover-triggered height reflows on Starred note panels, switched to inline SVGs and single delegated event listeners, and opened from cache instead of re-fetching `history.json` on every click.
- **Word (.docx) OMML Conversion Failures (`docx_generator.py`)**:
  - Sanitized unescaped `&` and `<mtext>` LaTeX escapes (`\$`, `\%`, `\&`) before XML parsing so formulas like `\text{Halts & Accepts}` and `\begin{aligned}` convert cleanly to native Word OMML (`9,926 / 9,926` formulas verified across saved history with 0 failures).
  - Removed the regex that stripped `\\` row breaks inside multi-line environments, normalized `\not=` to `\neq` and `\not\in` to `\notin`, added math-aware table cell pipe splitting, preserved bold/italic around inline math, and expanded the Unicode fallback table.
- **Alignment and Focus Polish**:
  - Unified top bar control heights to `36px` with centered `line-height: 1` labels.
  - Removed uneven subpixel inset rings on count pills (`History`, `All`, `Starred`) so numbers sit centered inside every badge.
  - Removed harsh white focus borders/outlines on text inputs (note editor, search bar, URL input) so only a clean blinking caret is shown.
  - Fixed a stray closing `</div>` tag in `static/index.html`.

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
