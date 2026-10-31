/**
 * Gemini Canvas Extractor — Frontend logic v5.0 (monochrome, Hattrick-crispy)
 * Functionality preserved: extract, render (Markdown + KaTeX + ASCII),
 * PDF / Word / print export, history drawer, ASCII theme, stop server.
 * Adds: app light/dark theme toggle, drawer focus trap. No endpoint or payload changes.
 */

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  // ---------------- State ----------------
  let currentData = null;
  let activeArtifact = null;
  let historyCache = [];
  let currentHistoryFilter = 'all';
  let asciiTheme = localStorage.getItem('gemini_ascii_theme') || 'light';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ---------------- DOM ----------------
  const extractForm = document.getElementById('extractForm');
  const urlInput = document.getElementById('urlInput');
  const extractBtn = document.getElementById('extractBtn');
  const clearUrlBtn = document.getElementById('clearUrlBtn');
  const loadingState = document.getElementById('loadingState');
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const dismissErrorBtn = document.getElementById('dismissErrorBtn');
  const resultsSection = document.getElementById('resultsSection');

  const docTitle = document.getElementById('docTitle');
  const docSubtitle = document.getElementById('docSubtitle');
  const printHeaderTitle = document.getElementById('printHeaderTitle');
  const printHeaderMeta = document.getElementById('printHeaderMeta');

  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const exportDocxBtn = document.getElementById('exportDocxBtn');
  const printDocBtn = document.getElementById('printDocBtn');
  const copyMdBtn = document.getElementById('copyMdBtn');
  const starDocBtn = document.getElementById('starDocBtn');
  const starDocIcon = document.getElementById('starDocIcon');
  const starDocLabel = document.getElementById('starDocLabel');
  const noteDocBtn = document.getElementById('noteDocBtn');
  const noteDocLabel = document.getElementById('noteDocLabel');
  const renderedContainer = document.getElementById('renderedContainer');
  const printIframe = document.getElementById('printIframe');

  const asciiLightBtn = document.getElementById('asciiLightBtn');
  const asciiDarkBtn = document.getElementById('asciiDarkBtn');

  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const openHistoryBtn = document.getElementById('openHistoryBtn');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const historyDrawer = document.getElementById('historyDrawer');
  const historyDrawerOverlay = document.getElementById('historyDrawerOverlay');
  const historyBadge = document.getElementById('historyBadge');
  const historyFilterAllBtn = document.getElementById('historyFilterAllBtn');
  const historyFilterStarredBtn = document.getElementById('historyFilterStarredBtn');
  const historyCountAll = document.getElementById('historyCountAll');
  const historyCountStarred = document.getElementById('historyCountStarred');
  const historyItemsList = document.getElementById('historyItemsList');
  const historySearchInput = document.getElementById('historySearchInput');
  const historyItemCountText = document.getElementById('historyItemCountText');
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');

  const stopServerBtn = document.getElementById('stopServerBtn');

  // ---------------- Visibility helpers (Tailwind-safe) ----------------
  function show(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.remove('is-hidden');
  }
  function hide(el) {
    if (!el) return;
    el.classList.add('is-hidden');
    el.classList.remove('hidden');
  }

  // ---------------- App light/dark theme (only two themes) ----------------
  function getPreferredAppTheme() {
    const saved = localStorage.getItem('gemini_app_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function paintThemeToggle(theme) {
    if (!themeToggleBtn) return;
    const isDark = theme === 'dark';
    themeToggleBtn.setAttribute('aria-pressed', String(isDark));
    themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    themeToggleBtn.innerHTML =
      '<i data-lucide="' + (isDark ? 'sun' : 'moon') + '" id="themeToggleIcon"></i>' +
      '<span class="icon-btn-label" id="themeToggleLabel">' + (isDark ? 'Light' : 'Dark') + '</span>';
    lucide.createIcons();
  }

  function setAppTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('gemini_app_theme', theme); } catch (e) {}
    paintThemeToggle(theme);
  }

  setAppTheme(getPreferredAppTheme());
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setAppTheme(next);
      showToast(next === 'dark' ? 'Dark theme' : 'Light theme');
    });
  }

  // ---------------- ASCII theme (class-hook based, Tailwind-safe) ----------------
  function setAsciiTheme(theme) {
    asciiTheme = theme;
    try { localStorage.setItem('gemini_ascii_theme', theme); } catch (e) {}

    document.body.classList.remove('ascii-dark-mode', 'ascii-light-mode');
    document.body.classList.add(theme === 'light' ? 'ascii-light-mode' : 'ascii-dark-mode');

    if (asciiLightBtn && asciiDarkBtn) {
      const isLight = theme === 'light';
      asciiLightBtn.classList.toggle('is-active', isLight);
      asciiDarkBtn.classList.toggle('is-active', !isLight);
      asciiLightBtn.setAttribute('aria-pressed', String(isLight));
      asciiDarkBtn.setAttribute('aria-pressed', String(!isLight));
    }

    document.querySelectorAll('.code-block-wrapper').forEach((w) => {
      w.classList.remove('theme-light', 'theme-dark');
      w.classList.add('theme-' + theme);
    });
  }

  setAsciiTheme(asciiTheme);
  if (asciiLightBtn) asciiLightBtn.addEventListener('click', () => setAsciiTheme('light'));
  if (asciiDarkBtn) asciiDarkBtn.addEventListener('click', () => setAsciiTheme('dark'));

  // ---------------- Toast ----------------
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ---------------- Clipboard (with fallback for non-secure contexts) ----------------
  function fallbackCopy(text) {
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) resolve();
        else reject(new Error('Copy failed'));
      } catch (e) {
        ta.remove();
        reject(e);
      }
    });
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  // ---------------- URL input ----------------
  function syncClearBtn() {
    if (!clearUrlBtn) return;
    if (urlInput.value.trim()) clearUrlBtn.classList.remove('is-hidden');
    else clearUrlBtn.classList.add('is-hidden');
  }
  urlInput.addEventListener('input', syncClearBtn);
  syncClearBtn();

  if (clearUrlBtn) {
    clearUrlBtn.addEventListener('click', () => {
      urlInput.value = '';
      syncClearBtn();
      urlInput.focus();
    });
  }

  if (dismissErrorBtn) dismissErrorBtn.addEventListener('click', () => hide(errorAlert));

  // ---------------- Stop server (unchanged) ----------------
  if (stopServerBtn) {
    stopServerBtn.addEventListener('click', async () => {
      if (!confirm('Stop the local server?')) return;
      try {
        await fetch('/api/shutdown', { method: 'POST' });
      } catch (e) {}
      alert('Server stopped. Run start.bat to restart.');
    });
  }

  // ---------------- Extraction (unchanged endpoints) ----------------
  extractForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    hide(errorAlert);
    hide(resultsSection);
    show(loadingState);
    lucide.createIcons();
    extractBtn.disabled = true;
    extractBtn.setAttribute('aria-busy', 'true');

    try {
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.detail || 'Extraction failed. Check the link is public.');
      }

      currentData = json.data;
      displayResults(currentData);
      await fetchHistory();
      showToast('Extracted');
    } catch (err) {
      errorMessage.textContent = err.message;
      show(errorAlert);
      if (typeof errorAlert.focus === 'function') errorAlert.focus();
    } finally {
      hide(loadingState);
      extractBtn.disabled = false;
      extractBtn.removeAttribute('aria-busy');
      lucide.createIcons();
    }
  });

  // ---------------- Markdown + KaTeX + ASCII rendering (same pipeline) ----------------
  function renderMarkdownContent(content) {
    const codeBlocks = [];
    const inlineCodes = [];
    const mathBlocks = [];

    let text = content.replace(/```([\s\S]*?)```/g, (match) => {
      const id = '%%CODE_BLOCK_' + codeBlocks.length + '%%';
      codeBlocks.push({ id, code: match });
      return id;
    });

    text = text.replace(/`([^`\n]+?)`/g, (match) => {
      const id = '%%INLINE_CODE_' + inlineCodes.length + '%%';
      inlineCodes.push({ id, code: match });
      return id;
    });

    function cleanMath(math) {
      let m = math.trim();
      if (m.endsWith('\\')) {
        m = m + '$';
      }
      m = m.replace(/\\text\{([^{}]*)\}/g, (match, inner) => {
        return '\\text{' + inner.replace(/(?<!\\)&/g, '\\&') + '}';
      });
      return m;
    }

    text = text.replace(/(?<![\$\\])\$\$([\s\S]*?)\$\$/g, (match, math) => {
      const id = '%%KATEX_BLOCK_' + mathBlocks.length + '%%';
      const cleaned = cleanMath(math);
      try {
        const rendered = katex.renderToString(cleaned, { displayMode: true, throwOnError: false });
        mathBlocks.push({ id, html: '<div class="katex-display-wrapper">' + rendered + '</div>' });
      } catch (e) {
        mathBlocks.push({ id, html: '<div class="katex-display-wrapper katex-error">' + escapeHtml(math) + '</div>' });
      }
      return id;
    });

    text = text.replace(/(?<!\\)\$((?:\\\$|[^\$\n\r])+?)(?<!\\)\$/g, (match, math) => {
      if (!math.trim()) return match;
      const id = '%%KATEX_INLINE_' + mathBlocks.length + '%%';
      const cleaned = cleanMath(math);
      try {
        const rendered = katex.renderToString(cleaned, { displayMode: false, throwOnError: false });
        mathBlocks.push({ id, html: rendered });
      } catch (e) {
        mathBlocks.push({ id, html: '<span>' + escapeHtml(math) + '</span>' });
      }
      return id;
    });

    codeBlocks.forEach(({ id, code }) => { text = text.replaceAll(id, code); });
    inlineCodes.forEach(({ id, code }) => { text = text.replaceAll(id, code); });

    marked.setOptions({ gfm: true, breaks: true });
    let rawHtml = marked.parse(text);

    mathBlocks.forEach(({ id, html: mathHtml }) => { rawHtml = rawHtml.replaceAll(id, mathHtml); });

    renderedContainer.innerHTML = rawHtml;

    const preBlocks = renderedContainer.querySelectorAll('pre');
    preBlocks.forEach((pre, index) => {
      const code = pre.querySelector('code');
      const textVal = code ? code.innerText : pre.innerText;

      const currentMode = document.body.classList.contains('ascii-dark-mode') ? 'dark' : 'light';
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper theme-' + currentMode;

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML =
        '<span class="code-block-title">' +
          '<i data-lucide="terminal"></i>' +
          '<span>Diagram #' + (index + 1) + '</span>' +
        '</span>' +
        '<span class="code-block-actions">' +
          '<button type="button" class="mini-btn toggle-diagram-theme-btn" title="Toggle light / dark">' +
            '<i data-lucide="sun-medium"></i><span>Theme</span>' +
          '</button>' +
          '<button type="button" class="mini-btn copy-diagram-btn" data-code="' + encodeURIComponent(textVal) + '" title="Copy diagram">' +
            '<i data-lucide="copy"></i><span>Copy</span>' +
          '</button>' +
        '</span>';

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      header.querySelector('.toggle-diagram-theme-btn').addEventListener('click', () => {
        if (wrapper.classList.contains('theme-dark')) {
          wrapper.classList.remove('theme-dark');
          wrapper.classList.add('theme-light');
        } else {
          wrapper.classList.remove('theme-light');
          wrapper.classList.add('theme-dark');
        }
      });
    });

    renderedContainer.querySelectorAll('.copy-diagram-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = decodeURIComponent(btn.getAttribute('data-code'));
        copyTextToClipboard(raw).then(
          () => showToast('Diagram copied'),
          () => showToast('Copy failed — copy manually')
        );
      });
    });

    lucide.createIcons();
  }

  function displayResults(data) {
    if (!data.artifacts || data.artifacts.length === 0) {
      throw new Error('No document found in this link.');
    }

    activeArtifact = data.artifacts[0];

    docTitle.textContent = activeArtifact.title || data.title || 'Gemini Canvas Artifact';
    docSubtitle.textContent =
      (activeArtifact.word_count || 0).toLocaleString() + ' words • ' +
      (data.ascii_count || 0) + ' diagrams • ' + (data.table_count || 0) + ' tables';

    if (printHeaderTitle) printHeaderTitle.textContent = activeArtifact.title || 'Gemini Canvas Artifact';
    if (printHeaderMeta) {
      printHeaderMeta.textContent =
        'Source: ' + data.share_id + ' • ' +
        (activeArtifact.word_count || 0).toLocaleString() + ' words • ' +
        (data.ascii_count || 0) + ' diagrams';
    }

    renderMarkdownContent(activeArtifact.content);
    updateActionBarStar();

    show(resultsSection);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (docTitle && typeof docTitle.focus === 'function') docTitle.focus({ preventScroll: true });
  }

  // ---------------- Export actions (unchanged payloads) ----------------
  function spinnerHtml(label) {
    return '<span class="btn-spinner" aria-hidden="true"></span><span>' + label + '</span>';
  }

  function triggerBlobDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.style.position = 'fixed';
    a.style.top = '0';
    a.style.left = '0';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  let printSavedScrollY = 0;
  window.addEventListener('beforeprint', () => { printSavedScrollY = window.scrollY; });
  window.addEventListener('afterprint', () => { window.scrollTo(0, printSavedScrollY); });

  exportPdfBtn.addEventListener('click', async () => {
    if (!activeArtifact) return;
    const originalHtml = exportPdfBtn.innerHTML;
    const savedPdfWidth = exportPdfBtn.getBoundingClientRect().width;
    const savedPdfHeight = exportPdfBtn.getBoundingClientRect().height;
    exportPdfBtn.style.width = savedPdfWidth + 'px';
    exportPdfBtn.style.minWidth = savedPdfWidth + 'px';
    exportPdfBtn.style.maxWidth = savedPdfWidth + 'px';
    exportPdfBtn.style.minHeight = savedPdfHeight + 'px';
    exportPdfBtn.disabled = true;
    exportPdfBtn.innerHTML = spinnerHtml('Rendering…');

    try {
      const payload = {
        title: activeArtifact.title || currentData.title || 'Gemini Canvas Artifact',
        content: activeArtifact.content,
        theme: 'light',
        font_size: 'medium',
        ascii_light_theme: (asciiTheme === 'light'),
        metadata: {
          share_id: currentData.share_id,
          filename: activeArtifact.filename,
          word_count: activeArtifact.word_count,
          ascii_count: currentData.ascii_count
        }
      };

      const resp = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error('PDF generation failed on server');

      const blob = await resp.blob();
      const safeTitle = (activeArtifact.title || 'gemini_canvas').replace(/[^a-zA-Z0-9_-]/g, '_');
      triggerBlobDownload(blob, safeTitle + '.pdf');
      showToast('PDF downloaded');
    } catch (err) {
      alert('PDF generation error: ' + err.message);
    } finally {
      exportPdfBtn.style.width = '';
      exportPdfBtn.style.minWidth = '';
      exportPdfBtn.style.maxWidth = '';
      exportPdfBtn.style.minHeight = '';
      exportPdfBtn.disabled = false;
      exportPdfBtn.innerHTML = originalHtml;
      lucide.createIcons();
    }
  });

  exportDocxBtn.addEventListener('click', async () => {
    if (!activeArtifact) return;
    const originalHtml = exportDocxBtn.innerHTML;
    const savedDocxWidth = exportDocxBtn.getBoundingClientRect().width;
    const savedDocxHeight = exportDocxBtn.getBoundingClientRect().height;
    exportDocxBtn.style.width = savedDocxWidth + 'px';
    exportDocxBtn.style.minWidth = savedDocxWidth + 'px';
    exportDocxBtn.style.maxWidth = savedDocxWidth + 'px';
    exportDocxBtn.style.minHeight = savedDocxHeight + 'px';
    exportDocxBtn.disabled = true;
    exportDocxBtn.innerHTML = spinnerHtml('Generating…');

    try {
      const payload = {
        title: activeArtifact.title || currentData.title || 'Gemini Canvas Artifact',
        content: activeArtifact.content,
        ascii_light_theme: (asciiTheme === 'light'),
        metadata: {
          share_id: currentData.share_id,
          filename: activeArtifact.filename,
          word_count: activeArtifact.word_count,
          ascii_count: currentData.ascii_count
        }
      };

      const resp = await fetch('/api/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error('Word generation failed on server');

      const blob = await resp.blob();
      const safeTitle = (activeArtifact.title || 'gemini_canvas').replace(/[^a-zA-Z0-9_-]/g, '_');
      triggerBlobDownload(blob, safeTitle + '.docx');
      showToast('DOCX downloaded');
    } catch (err) {
      alert('Word export error: ' + err.message);
    } finally {
      exportDocxBtn.style.width = '';
      exportDocxBtn.style.minWidth = '';
      exportDocxBtn.style.maxWidth = '';
      exportDocxBtn.style.minHeight = '';
      exportDocxBtn.disabled = false;
      exportDocxBtn.innerHTML = originalHtml;
      lucide.createIcons();
    }
  });

  printDocBtn.addEventListener('click', async () => {
    if (!activeArtifact) return;
    const originalHtml = printDocBtn.innerHTML;
    const savedWidth = printDocBtn.getBoundingClientRect().width;
    const savedHeight = printDocBtn.getBoundingClientRect().height;
    printDocBtn.style.width = savedWidth + 'px';
    printDocBtn.style.minWidth = savedWidth + 'px';
    printDocBtn.style.maxWidth = savedWidth + 'px';
    printDocBtn.style.minHeight = savedHeight + 'px';
    printDocBtn.disabled = true;
    printDocBtn.innerHTML = spinnerHtml('Print');

    const savedX = window.scrollX;
    const savedY = window.scrollY;

    try {
      const payload = {
        title: activeArtifact.title || currentData.title || 'Gemini Canvas Artifact',
        content: activeArtifact.content,
        theme: 'light',
        font_size: 'medium',
        ascii_light_theme: (asciiTheme === 'light'),
        metadata: {
          share_id: currentData.share_id,
          filename: activeArtifact.filename,
          word_count: activeArtifact.word_count,
          ascii_count: currentData.ascii_count
        }
      };

      const resp = await fetch('/api/export-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error('Failed to prepare document');
      const printHtml = await resp.text();

      let oldIframe = document.getElementById('printIframe');
      if (oldIframe) oldIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'printIframe';
      iframe.title = 'Print preview';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '1000px';
      iframe.style.height = '1000px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(printHtml);
      iframeDoc.close();

      await new Promise((resolve) => setTimeout(resolve, 250));

      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.print();
      }
    } catch (err) {
      window.print();
    } finally {
      window.scrollTo(savedX, savedY);
      printDocBtn.style.width = '';
      printDocBtn.style.minWidth = '';
      printDocBtn.style.maxWidth = '';
      printDocBtn.style.minHeight = '';
      printDocBtn.disabled = false;
      printDocBtn.innerHTML = originalHtml;
      lucide.createIcons();
    }
  });

  copyMdBtn.addEventListener('click', () => {
    if (!activeArtifact) return;
    copyTextToClipboard(activeArtifact.content).then(
      () => showToast('Markdown copied'),
      () => showToast('Copy failed — copy manually')
    );
  });

  if (starDocBtn) {
    starDocBtn.addEventListener('click', async () => {
      if (!currentData) return;
      let itemId = currentData.history_id;
      if (!itemId && currentData.share_id) {
        const found = historyCache.find((i) => i.share_id === currentData.share_id);
        if (found) itemId = found.id;
      }
      if (itemId) {
        await toggleStar(itemId);
      } else {
        currentData.starred = !currentData.starred;
        updateActionBarStar();
      }
    });
  }

  if (noteDocBtn) {
    noteDocBtn.addEventListener('click', async () => {
      if (!currentData) return;
      let itemId = currentData.history_id;
      if (!itemId && currentData.share_id) {
        const found = historyCache.find((i) => i.share_id === currentData.share_id);
        if (found) itemId = found.id;
      }
      if (!itemId) return;
      const currentNote = currentData.notes || '';
      const promptText = currentNote ? 'Edit note for this document:' : 'Add a short note for this document:';
      const userNote = prompt(promptText, currentNote);
      if (userNote !== null) {
        await saveNote(itemId, userNote);
      }
    });
  }

  // ---------------- History drawer ----------------
  let lastDrawerFocus = null;

  function getDrawerFocusableElements() {
    return historyDrawer.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  function openDrawer() {
    lastDrawerFocus = document.activeElement;
    show(historyDrawerOverlay);
    requestAnimationFrame(() => historyDrawer.classList.add('open'));
    historyDrawer.setAttribute('aria-hidden', 'false');
    historyDrawer.removeAttribute('inert');
    if (currentHistoryFilter === 'starred') {
      historyDrawer.classList.add('is-starred-view');
    } else {
      historyDrawer.classList.remove('is-starred-view');
    }
    if (openHistoryBtn) openHistoryBtn.setAttribute('aria-expanded', 'true');
    fetchHistory();
    if (closeHistoryBtn) closeHistoryBtn.focus({ preventScroll: true });
  }

  function closeDrawer() {
    historyDrawer.classList.remove('open');
    historyDrawer.setAttribute('aria-hidden', 'true');
    historyDrawer.setAttribute('inert', '');
    if (openHistoryBtn) openHistoryBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => hide(historyDrawerOverlay), 240);
    if (lastDrawerFocus && document.contains(lastDrawerFocus)) lastDrawerFocus.focus({ preventScroll: true });
  }

  // Active focus trap inside drawer
  historyDrawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(getDrawerFocusableElements());
    if (focusables.length === 0) return;
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  });

  if (openHistoryBtn) openHistoryBtn.addEventListener('click', openDrawer);
  if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeDrawer);
  if (historyDrawerOverlay) historyDrawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (historyDrawer.classList.contains('open')) closeDrawer();
    else if (errorAlert && !errorAlert.classList.contains('is-hidden')) hide(errorAlert);
  });

  function updateActionBarStar() {
    if (!starDocBtn) return;
    const isStarred = Boolean(currentData && currentData.starred);
    starDocBtn.setAttribute('aria-pressed', String(isStarred));
    starDocBtn.setAttribute('aria-label', isStarred ? 'Unstar this document' : 'Star this document');
    starDocBtn.setAttribute('title', isStarred ? 'Unstar this document' : 'Star this document');
    if (isStarred) {
      starDocBtn.classList.add('is-starred');
      if (starDocLabel) starDocLabel.textContent = 'Starred';
      if (noteDocBtn) {
        noteDocBtn.classList.remove('is-hidden');
        const hasNotes = Boolean(currentData && currentData.notes && currentData.notes.trim());
        if (hasNotes) {
          noteDocBtn.classList.add('has-note');
          if (noteDocLabel) noteDocLabel.textContent = 'Note';
          noteDocBtn.setAttribute('title', 'Note: ' + currentData.notes);
        } else {
          noteDocBtn.classList.remove('has-note');
          if (noteDocLabel) noteDocLabel.textContent = 'Add note';
          noteDocBtn.setAttribute('title', 'Add note to this starred document');
        }
      }
    } else {
      starDocBtn.classList.remove('is-starred');
      if (starDocLabel) starDocLabel.textContent = 'Star';
      if (noteDocBtn) {
        noteDocBtn.classList.add('is-hidden');
      }
    }
    const currentStarWidth = starDocBtn.getBoundingClientRect().width;
    const currentStarHeight = starDocBtn.getBoundingClientRect().height;
    const previousStarMin = parseFloat(starDocBtn.dataset.minWidth || '0');
    const nextStarMin = Math.max(previousStarMin, currentStarWidth);
    starDocBtn.dataset.minWidth = String(nextStarMin);
    starDocBtn.style.minWidth = nextStarMin + 'px';
    starDocBtn.style.minHeight = currentStarHeight + 'px';
  }

  async function toggleStar(itemId) {
    try {
      const resp = await fetch('/api/history/' + encodeURIComponent(itemId) + '/star', {
        method: 'POST'
      });
      if (resp.ok) {
        const json = await resp.json();
        const updated = json.item;
        const idx = historyCache.findIndex((i) => i.id === itemId || (updated.share_id && i.share_id === updated.share_id));
        if (idx !== -1) {
          historyCache[idx].starred = updated.starred;
          if (updated.notes !== undefined) historyCache[idx].notes = updated.notes;
        } else {
          historyCache.unshift(updated);
        }
        if (currentData) {
          if (currentData.history_id === itemId || (updated.share_id && currentData.share_id === updated.share_id)) {
            currentData.starred = updated.starred;
            currentData.history_id = updated.id || itemId;
            if (updated.notes !== undefined) currentData.notes = updated.notes;
            updateActionBarStar();
          }
        }
        applyFilterAndSearch();
        updateHistoryBadge();
        showToast(updated.starred ? 'Starred' : 'Unstarred');
      } else {
        showToast('Could not update star');
      }
    } catch (e) {
      showToast('Could not update star');
    }
  }

  async function saveNote(itemId, noteText) {
    try {
      const resp = await fetch('/api/history/' + encodeURIComponent(itemId) + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText })
      });
      if (resp.ok) {
        const json = await resp.json();
        const updated = json.item;
        const idx = historyCache.findIndex((i) => i.id === itemId || (updated.share_id && i.share_id === updated.share_id));
        if (idx !== -1) {
          historyCache[idx].notes = updated.notes;
        } else {
          historyCache.unshift(updated);
        }
        if (currentData) {
          if (currentData.history_id === itemId || (updated.share_id && currentData.share_id === updated.share_id)) {
            currentData.notes = updated.notes;
            updateActionBarStar();
          }
        }
        applyFilterAndSearch();
        showToast(updated.notes ? 'Note saved' : 'Note cleared');
      } else {
        showToast('Could not save note');
      }
    } catch (e) {
      showToast('Could not save note');
    }
  }

  async function fetchHistory() {
    try {
      const resp = await fetch('/api/history');
      if (resp.ok) {
        const json = await resp.json();
        historyCache = json.history || [];
      } else {
        historyCache = JSON.parse(localStorage.getItem('gemini_history') || '[]');
      }
    } catch (e) {
      historyCache = JSON.parse(localStorage.getItem('gemini_history') || '[]');
    }
    applyFilterAndSearch();
  }

  function getFilteredHistory() {
    let list = historyCache || [];
    if (currentHistoryFilter === 'starred') {
      list = list.filter((item) => Boolean(item.starred));
    }
    const q = historySearchInput ? historySearchInput.value.toLowerCase().trim() : '';
    if (q) {
      list = list.filter((item) => (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.content && item.content.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      ));
    }
    return list;
  }

  function applyFilterAndSearch() {
    const filtered = getFilteredHistory();
    renderHistoryItems(filtered);
    updateHistoryBadge();
  }

  function updateHistoryBadge() {
    const total = historyCache.length;
    const starredCount = historyCache.filter((i) => Boolean(i.starred)).length;
    if (historyBadge) {
      historyBadge.textContent = total;
      historyBadge.setAttribute('aria-label', total + ' saved documents');
    }
    if (historyCountAll) historyCountAll.textContent = total;
    if (historyCountStarred) historyCountStarred.textContent = starredCount;

    if (historyItemCountText) {
      if (currentHistoryFilter === 'starred') {
        historyItemCountText.textContent = starredCount + ' starred';
      } else {
        historyItemCountText.textContent = total + ' saved';
      }
    }
  }

  if (historyFilterAllBtn) {
    historyFilterAllBtn.addEventListener('click', () => {
      currentHistoryFilter = 'all';
      if (historyDrawer) historyDrawer.classList.remove('is-starred-view');
      historyFilterAllBtn.classList.add('is-active');
      historyFilterAllBtn.setAttribute('aria-selected', 'true');
      if (historyFilterStarredBtn) {
        historyFilterStarredBtn.classList.remove('is-active');
        historyFilterStarredBtn.setAttribute('aria-selected', 'false');
      }
      applyFilterAndSearch();
    });
  }

  if (historyFilterStarredBtn) {
    historyFilterStarredBtn.addEventListener('click', () => {
      currentHistoryFilter = 'starred';
      if (historyDrawer) historyDrawer.classList.add('is-starred-view');
      historyFilterStarredBtn.classList.add('is-active');
      historyFilterStarredBtn.setAttribute('aria-selected', 'true');
      if (historyFilterAllBtn) {
        historyFilterAllBtn.classList.remove('is-active');
        historyFilterAllBtn.setAttribute('aria-selected', 'false');
      }
      applyFilterAndSearch();
    });
  }

  function renderHistoryItems(items) {
    historyItemsList.innerHTML = '';
    if (!items || items.length === 0) {
      const emptyMsg = currentHistoryFilter === 'starred'
        ? 'No starred documents yet. Star important documents to find them quickly.'
        : 'No documents yet. Extract a link.';
      historyItemsList.innerHTML = '<div class="drawer-empty">' + emptyMsg + '</div>';
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.dataset.id = item.id;
      const isStarred = Boolean(item.starred);
      const hasNotes = Boolean(item.notes && item.notes.trim());

      let metaBits = escapeHtml(item.timestamp || '') + ' • ' + (item.word_count || 0).toLocaleString() + ' words';
      if (item.ascii_count) metaBits += ' • ' + item.ascii_count + ' diagrams';
      if (item.table_count) metaBits += ' • ' + item.table_count + ' tables';

      let noteChipHtml = '';
      if (hasNotes) {
        noteChipHtml = '<div class="history-note-chip" title="Click to edit note"><i data-lucide="sticky-note"></i><span class="note-snippet">' + escapeHtml(item.notes) + '</span></div>';
      } else if (isStarred) {
        noteChipHtml = '<button type="button" class="history-add-note-action add-note-trigger"><i data-lucide="plus"></i><span>Add note</span></button>';
      }

      let hoverPanelHtml = '';
      if (hasNotes) {
        hoverPanelHtml =
          '<div class="history-hover-note-panel" title="Click to edit note">' +
            '<div class="history-hover-note-header"><span>Note</span><span>Click to edit</span></div>' +
            '<div class="history-hover-note-text">' + escapeHtml(item.notes) + '</div>' +
          '</div>';
      }

      card.innerHTML =
        '<div class="history-card-top">' +
          '<div style="min-width:0;flex:1">' +
            '<h4 class="history-card-title">' + escapeHtml(item.title) + '</h4>' +
            '<div class="history-card-meta">' + metaBits + '</div>' +
            noteChipHtml +
          '</div>' +
          '<div class="history-card-top-actions">' +
            (isStarred ? '<button type="button" class="history-note-btn note-btn-trigger ' + (hasNotes ? 'has-note' : '') + '" title="' + (hasNotes ? 'Edit note' : 'Add note') + '" aria-label="' + (hasNotes ? 'Edit note' : 'Add note') + '"><i data-lucide="sticky-note"></i></button>' : '') +
            '<button type="button" class="history-star star-history-btn ' + (isStarred ? 'is-starred' : '') + '" data-id="' + item.id + '" aria-label="' + (isStarred ? 'Unstar ' : 'Star ') + escapeHtml(item.title) + '" aria-pressed="' + (isStarred ? 'true' : 'false') + '" title="' + (isStarred ? 'Unstar' : 'Star') + '">' +
              '<i data-lucide="star"></i>' +
            '</button>' +
            '<button type="button" class="history-delete delete-history-btn" data-id="' + item.id + '" aria-label="Remove ' + escapeHtml(item.title) + '">' +
              '<i data-lucide="trash-2"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
        hoverPanelHtml +
        '<div class="history-note-editor is-hidden" id="editor_' + item.id + '">' +
          '<input type="text" class="history-note-input" placeholder="Add a short note… (e.g. CAT-2 Q15 key proof)" maxlength="200" value="' + escapeHtml(item.notes || '') + '">' +
          '<div class="history-note-actions">' +
            '<button type="button" class="btn-primary btn-xs save-note-action">Save</button>' +
            '<button type="button" class="btn-ghost btn-xs cancel-note-action">Cancel</button>' +
            (hasNotes ? '<button type="button" class="btn-ghost btn-xs clear-note-action" style="color:var(--danger)">Clear</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="history-card-foot">' +
          '<button type="button" class="history-open load-history-btn" data-id="' + item.id + '">' +
            '<i data-lucide="folder-open"></i><span>Open</span>' +
          '</button>' +
          '<div class="history-exports">' +
            '<button type="button" class="chip-btn history-pdf-btn" data-id="' + item.id + '">PDF</button>' +
            '<button type="button" class="chip-btn history-docx-btn" data-id="' + item.id + '">DOCX</button>' +
          '</div>' +
        '</div>';

      const editorEl = card.querySelector('#editor_' + item.id);
      const noteInput = card.querySelector('.history-note-input');

      function openNoteEditor() {
        if (!editorEl) return;
        show(editorEl);
        if (noteInput) {
          noteInput.focus();
          noteInput.select();
        }
      }

      function closeNoteEditor() {
        if (!editorEl) return;
        hide(editorEl);
      }

      const noteBtn = card.querySelector('.note-btn-trigger');
      if (noteBtn) noteBtn.addEventListener('click', (e) => { e.stopPropagation(); openNoteEditor(); });

      const addNoteAction = card.querySelector('.add-note-trigger');
      if (addNoteAction) addNoteAction.addEventListener('click', (e) => { e.stopPropagation(); openNoteEditor(); });

      const chipEl = card.querySelector('.history-note-chip');
      if (chipEl) chipEl.addEventListener('click', (e) => { e.stopPropagation(); openNoteEditor(); });

      const hoverPanel = card.querySelector('.history-hover-note-panel');
      if (hoverPanel) hoverPanel.addEventListener('click', (e) => { e.stopPropagation(); openNoteEditor(); });

      const saveBtn = card.querySelector('.save-note-action');
      if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const val = noteInput ? noteInput.value.trim() : '';
          await saveNote(item.id, val);
          closeNoteEditor();
        });
      }

      const cancelBtn = card.querySelector('.cancel-note-action');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeNoteEditor();
        });
      }

      const clearBtn = card.querySelector('.clear-note-action');
      if (clearBtn) {
        clearBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await saveNote(item.id, '');
          closeNoteEditor();
        });
      }

      if (noteInput) {
        noteInput.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            await saveNote(item.id, noteInput.value.trim());
            closeNoteEditor();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeNoteEditor();
          }
        });
      }

      card.querySelector('.star-history-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleStar(item.id);
      });

      card.querySelector('.load-history-btn').addEventListener('click', () => {
        loadHistoryItemIntoWorkspace(item);
        closeDrawer();
      });

      card.querySelector('.history-pdf-btn').addEventListener('click', async () => {
        const payload = {
          title: item.title,
          content: item.content,
          theme: 'light',
          font_size: 'medium',
          ascii_light_theme: (asciiTheme === 'light'),
          metadata: { share_id: item.share_id, word_count: item.word_count }
        };
        const resp = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (resp.ok) {
          const blob = await resp.blob();
          const safeTitle = (item.title || 'gemini_canvas').replace(/[^a-zA-Z0-9_-]/g, '_');
          triggerBlobDownload(blob, safeTitle + '.pdf');
        }
      });

      card.querySelector('.history-docx-btn').addEventListener('click', async () => {
        const payload = {
          title: item.title,
          content: item.content,
          ascii_light_theme: (asciiTheme === 'light'),
          metadata: { share_id: item.share_id, word_count: item.word_count }
        };
        const resp = await fetch('/api/generate-docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (resp.ok) {
          const blob = await resp.blob();
          const safeTitle = (item.title || 'gemini_canvas').replace(/[^a-zA-Z0-9_-]/g, '_');
          triggerBlobDownload(blob, safeTitle + '.docx');
        }
      });

      card.querySelector('.delete-history-btn').addEventListener('click', async () => {
        try { await fetch('/api/history/' + item.id, { method: 'DELETE' }); } catch (e) {}
        historyCache = historyCache.filter((i) => i.id !== item.id);
        applyFilterAndSearch();
        showToast('Removed');
      });

      historyItemsList.appendChild(card);
    });

    lucide.createIcons();
  }

  if (historySearchInput) {
    historySearchInput.addEventListener('input', () => {
      applyFilterAndSearch();
    });
  }

  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.addEventListener('click', async () => {
      if (!confirm('Clear all saved documents? This cannot be undone.')) return;
      try { await fetch('/api/history', { method: 'DELETE' }); } catch (e) {}
      historyCache = [];
      applyFilterAndSearch();
      showToast('History cleared');
    });
  }

  function loadHistoryItemIntoWorkspace(item) {
    currentData = {
      history_id: item.id,
      starred: Boolean(item.starred),
      notes: item.notes || '',
      share_id: item.share_id || 'history',
      title: item.title,
      ascii_count: item.ascii_count || 0,
      table_count: item.table_count || 0,
      artifacts: [{
        title: item.title,
        filename: item.filename || 'canvas_artifact.md',
        word_count: item.word_count || 0,
        content: item.content
      }]
    };
    displayResults(currentData);
    showToast('Opened "' + item.title + '"');
  }

  fetchHistory();

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
